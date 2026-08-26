from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Mapping

from botocore.exceptions import ClientError

from jobs_pipeline.common import (
    PROJECT_TABLE,
    aws_client,
    deserialize_item,
    now_iso,
    metric,
    project_partition_key,
    require_identifier,
    require_string,
    s3_encryption_args,
    serialize,
    slugify,
)


EVIDENCE_BUCKET = os.getenv("MEETING_EVIDENCE_BUCKET", "")
KNOWLEDGE_BASE_ID = os.getenv("KNOWLEDGE_BASE_ID", "")
KNOWLEDGE_BASE_DATA_SOURCE_ID = os.getenv(
    "KNOWLEDGE_BASE_DATA_SOURCE_ID", ""
)
ALLOWED_DOCUMENT_TYPES = {
    "architecture",
    "business-objective",
    "company-profile",
    "compliance",
    "constraints-risks",
    "customer-notes",
    "meeting-notes",
    "policy",
    "requirements",
    "stakeholder-profile",
    "technical-inventory",
}
ALLOWED_EXTENSIONS = {".csv", ".json", ".md", ".txt"}
MAX_DOCUMENT_BYTES = 120_000


class EvidenceConflictError(ValueError):
    """The requested document mutation conflicts with durable evidence state."""


def evidence_record_key(
    scope: Mapping[str, str], document_id: str
) -> dict[str, dict[str, str]]:
    return {
        "projectId": {"S": project_partition_key(scope)},
        "sortKey": {"S": f"EVIDENCE#{document_id}"},
    }


def _safe_filename(value: object) -> str:
    filename = require_string(value, "input.fileName", maximum=180)
    lowered = filename.lower()
    extension = next(
        (item for item in ALLOWED_EXTENSIONS if lowered.endswith(item)),
        "",
    )
    if not extension:
        raise ValueError("Evidence files must be TXT, Markdown, JSON, or CSV")
    stem = slugify(filename[: -len(extension)], "evidence")
    return f"{stem}{extension}"


def _document_keys(
    scope: Mapping[str, str],
    document_id: str,
    filename: str,
) -> tuple[str, str]:
    prefix = (
        f"evidence/tenants/{scope['tenantId']}/clients/{scope['clientId']}/"
        f"projects/{scope['projectId']}/documents/{document_id}"
    )
    document_key = f"{prefix}/{filename}"
    return document_key, f"{document_key}.metadata.json"


def _record(
    scope: Mapping[str, str], document_id: str
) -> dict[str, Any]:
    item = aws_client("dynamodb").get_item(
        TableName=PROJECT_TABLE,
        Key=evidence_record_key(scope, document_id),
        ConsistentRead=True,
    ).get("Item")
    return deserialize_item(item)


def _public_record(item: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: item.get(key)
        for key in (
            "documentId",
            "fileName",
            "sourceTitle",
            "documentType",
            "source",
            "approvalStatus",
            "status",
            "version",
            "checksumSha256",
            "createdAt",
            "updatedAt",
            "approvedAt",
            "ingestionJobId",
            "ingestionStatus",
            "failureReasons",
        )
        if item.get(key) not in (None, "", [])
    }


def _put_record(
    scope: Mapping[str, str],
    item: Mapping[str, Any],
    *,
    allow_deleted: bool,
) -> None:
    values = {
        **evidence_record_key(scope, str(item["documentId"])),
        **{
            key: serialize(value)
            for key, value in item.items()
            if value is not None
        },
    }
    arguments: dict[str, Any] = {
        "TableName": PROJECT_TABLE,
        "Item": values,
        "ConditionExpression": "attribute_not_exists(sortKey)",
    }
    if allow_deleted:
        arguments.update(
            {
                "ConditionExpression": (
                    "attribute_not_exists(sortKey) OR #status = :deleted"
                ),
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {":deleted": {"S": "DELETED"}},
            }
        )
    aws_client("dynamodb").put_item(**arguments)


def _start_sync(document_id: str, operation: str) -> dict[str, str]:
    if not KNOWLEDGE_BASE_ID or not KNOWLEDGE_BASE_DATA_SOURCE_ID:
        raise RuntimeError("The tenant Knowledge Base data source is not configured")
    try:
        response = aws_client("bedrock-agent").start_ingestion_job(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=KNOWLEDGE_BASE_DATA_SOURCE_ID,
            description=(
                f"PilarPrep {operation} for approved evidence {document_id}"
            )[:200],
        )
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code") or "")
        if code == "ConflictException":
            return {
                "ingestionStatus": "WAITING_FOR_SYNC",
                "ingestionJobId": "",
            }
        raise
    job = response.get("ingestionJob")
    if not isinstance(job, Mapping):
        raise RuntimeError("Bedrock did not return an ingestion job")
    job_id = require_string(
        job.get("ingestionJobId"), "ingestionJobId", maximum=80
    )
    return {
        "ingestionStatus": str(job.get("status") or "STARTING"),
        "ingestionJobId": job_id,
    }


def _update_status(
    scope: Mapping[str, str],
    document_id: str,
    *,
    status: str,
    ingestion_status: str,
    ingestion_job_id: str = "",
    failure_reasons: list[str] | None = None,
) -> None:
    values: dict[str, dict[str, Any]] = {
        ":status": {"S": status},
        ":ingestion": {"S": ingestion_status},
        ":updated": {"S": now_iso()},
    }
    update = (
        "SET #status = :status, ingestionStatus = :ingestion, "
        "ingestionJobId = :job, updatedAt = :updated"
    )
    values[":job"] = {"S": ingestion_job_id}
    if failure_reasons:
        update += ", failureReasons = :reasons"
        values[":reasons"] = serialize(failure_reasons[:5])
    aws_client("dynamodb").update_item(
        TableName=PROJECT_TABLE,
        Key=evidence_record_key(scope, document_id),
        UpdateExpression=update,
        ConditionExpression=(
            "tenantId = :tenant AND clientId = :client AND projectScopeId = :project"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            **values,
            ":tenant": {"S": scope["tenantId"]},
            ":client": {"S": scope["clientId"]},
            ":project": {"S": scope["projectId"]},
        },
    )


def ingest_document(
    scope: Mapping[str, str],
    inputs: Mapping[str, Any],
    *,
    source_job_id: str,
) -> dict[str, Any]:
    if not EVIDENCE_BUCKET or not PROJECT_TABLE:
        raise RuntimeError("Tenant evidence storage is not configured")
    document_id = require_identifier(inputs.get("documentId"), "input.documentId")
    existing = _record(scope, document_id)
    if existing and existing.get("sourceJobId") == source_job_id:
        return _public_record(existing)
    if existing and existing.get("status") != "DELETED":
        raise EvidenceConflictError(
            "This evidence document already exists; delete it before replacing it"
        )

    filename = _safe_filename(inputs.get("fileName"))
    source_title = require_string(
        inputs.get("sourceTitle"), "input.sourceTitle", maximum=240
    )
    document_type = require_string(
        inputs.get("documentType"), "input.documentType", maximum=64
    )
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise ValueError("input.documentType is not supported")
    content = require_string(
        inputs.get("content"),
        "input.content",
        minimum=20,
        maximum=MAX_DOCUMENT_BYTES,
    )
    content_body = content.encode("utf-8")
    if len(content_body) > MAX_DOCUMENT_BYTES:
        raise ValueError("Evidence content exceeds 120 KB")

    timestamp = now_iso()
    version = int(existing.get("version") or 0) + 1
    document_key, metadata_key = _document_keys(
        scope, document_id, filename
    )
    checksum = hashlib.sha256(content_body).hexdigest()
    metadata = {
        "tenantId": scope["tenantId"],
        "clientId": scope["clientId"],
        "projectId": scope["projectId"],
        "documentId": document_id,
        "documentType": document_type,
        "sourceTitle": source_title,
        "source": str(inputs.get("source") or "customer-upload")[:80],
        "approved": True,
        "status": "approved",
        "visibility": "tenant-private",
        "version": version,
        "uploadedAt": timestamp,
        "contentTrust": "untrusted-evidence",
    }
    sidecar = json.dumps(
        {"metadataAttributes": metadata},
        separators=(",", ":"),
    ).encode("utf-8")
    s3 = aws_client("s3")
    s3.put_object(
        Bucket=EVIDENCE_BUCKET,
        Key=document_key,
        Body=content_body,
        ContentType="text/plain; charset=utf-8",
        Metadata={
            "document-id": document_id,
            "checksum-sha256": checksum,
            "approval-status": "approved",
        },
        **s3_encryption_args(),
    )
    s3.put_object(
        Bucket=EVIDENCE_BUCKET,
        Key=metadata_key,
        Body=sidecar,
        ContentType="application/json",
        **s3_encryption_args(),
    )

    record = {
        "entityType": "EVIDENCE_DOCUMENT",
        "tenantId": scope["tenantId"],
        "clientId": scope["clientId"],
        "projectScopeId": scope["projectId"],
        "ownerId": scope["userId"],
        "documentId": document_id,
        "fileName": filename,
        "sourceTitle": source_title,
        "documentType": document_type,
        "source": metadata["source"],
        "approvalStatus": "approved",
        "status": "STORED",
        "version": version,
        "checksumSha256": checksum,
        "objectKey": document_key,
        "metadataKey": metadata_key,
        "sourceJobId": source_job_id,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "approvedAt": timestamp,
    }
    try:
        _put_record(scope, record, allow_deleted=bool(existing))
    except ClientError as exc:
        current = _record(scope, document_id)
        if current.get("sourceJobId") == source_job_id:
            return _public_record(current)
        raise EvidenceConflictError(
            "A concurrent evidence upload used this document ID"
        ) from exc

    sync = _start_sync(document_id, "ingestion")
    status = (
        "INGESTING"
        if sync["ingestionStatus"] != "WAITING_FOR_SYNC"
        else "INGESTION_PENDING"
    )
    _update_status(
        scope,
        document_id,
        status=status,
        ingestion_status=sync["ingestionStatus"],
        ingestion_job_id=sync["ingestionJobId"],
    )
    return _public_record(
        {
            **record,
            **sync,
            "status": status,
            "updatedAt": now_iso(),
        }
    )


def delete_document(
    scope: Mapping[str, str],
    inputs: Mapping[str, Any],
) -> dict[str, Any]:
    document_id = require_identifier(inputs.get("documentId"), "input.documentId")
    record = _record(scope, document_id)
    if not record:
        raise EvidenceConflictError("The evidence document does not exist")
    if record.get("status") == "DELETED":
        return _public_record(record)
    if record.get("status") == "DELETING" and record.get("ingestionJobId"):
        return _public_record(record)

    object_keys = [
        str(record.get("objectKey") or ""),
        str(record.get("metadataKey") or ""),
    ]
    objects = [{"Key": key} for key in object_keys if key]
    if objects:
        aws_client("s3").delete_objects(
            Bucket=EVIDENCE_BUCKET,
            Delete={"Objects": objects, "Quiet": True},
        )

    _update_status(
        scope,
        document_id,
        status="DELETION_PENDING",
        ingestion_status="START_REQUESTED",
    )
    sync = _start_sync(document_id, "deletion")
    status = (
        "DELETING"
        if sync["ingestionStatus"] != "WAITING_FOR_SYNC"
        else "DELETION_PENDING"
    )
    _update_status(
        scope,
        document_id,
        status=status,
        ingestion_status=sync["ingestionStatus"],
        ingestion_job_id=sync["ingestionJobId"],
    )
    return _public_record(
        {
            **record,
            **sync,
            "status": status,
            "updatedAt": now_iso(),
        }
    )


def reindex_document(
    scope: Mapping[str, str],
    inputs: Mapping[str, Any],
) -> dict[str, Any]:
    document_id = require_identifier(inputs.get("documentId"), "input.documentId")
    record = _record(scope, document_id)
    if not record or record.get("status") == "DELETED":
        raise EvidenceConflictError("The evidence document does not exist")

    sync = _start_sync(document_id, "re-index")
    status = (
        "INGESTING"
        if sync["ingestionStatus"] != "WAITING_FOR_SYNC"
        else "INGESTION_PENDING"
    )
    _update_status(
        scope,
        document_id,
        status=status,
        ingestion_status=sync["ingestionStatus"],
        ingestion_job_id=sync["ingestionJobId"],
    )
    return _public_record(
        {
            **record,
            **sync,
            "status": status,
            "updatedAt": now_iso(),
        }
    )


def _refresh_ingestion_status(
    scope: Mapping[str, str], record: Mapping[str, Any]
) -> dict[str, Any]:
    ingestion_job_id = str(record.get("ingestionJobId") or "")
    if not ingestion_job_id or record.get("status") not in {
        "INGESTING",
        "DELETING",
    }:
        return dict(record)

    try:
        response = aws_client("bedrock-agent").get_ingestion_job(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=KNOWLEDGE_BASE_DATA_SOURCE_ID,
            ingestionJobId=ingestion_job_id,
        )
    except ClientError:
        metric("RagIngestionStatusFailures", Action="evidence.status")
        return {
            **record,
            "ingestionStatus": "STATUS_CHECK_FAILED",
        }
    job = response.get("ingestionJob")
    if not isinstance(job, Mapping):
        return dict(record)

    ingestion_status = str(
        job.get("status") or record.get("ingestionStatus") or ""
    )
    failure_reasons = [
        str(reason)[:300]
        for reason in job.get("failureReasons", [])
        if str(reason).strip()
    ]
    current_status = str(record.get("status") or "")
    next_status = current_status
    if ingestion_status == "COMPLETE":
        next_status = "DELETED" if current_status == "DELETING" else "AVAILABLE"
    elif ingestion_status in {"FAILED", "STOPPED"}:
        next_status = (
            "DELETION_FAILED"
            if current_status == "DELETING"
            else "INGESTION_FAILED"
        )

    if (
        next_status != current_status
        or ingestion_status != record.get("ingestionStatus")
        or failure_reasons != record.get("failureReasons", [])
    ):
        _update_status(
            scope,
            str(record["documentId"]),
            status=next_status,
            ingestion_status=ingestion_status,
            ingestion_job_id=ingestion_job_id,
            failure_reasons=failure_reasons,
        )
    return {
        **record,
        "status": next_status,
        "ingestionStatus": ingestion_status,
        "failureReasons": failure_reasons,
        "updatedAt": now_iso(),
    }


def list_documents(scope: Mapping[str, str]) -> list[dict[str, Any]]:
    if not PROJECT_TABLE:
        raise RuntimeError("Tenant evidence storage is not configured")
    result = aws_client("dynamodb").query(
        TableName=PROJECT_TABLE,
        KeyConditionExpression=(
            "projectId = :project AND begins_with(sortKey, :evidence)"
        ),
        ExpressionAttributeValues={
            ":project": {"S": project_partition_key(scope)},
            ":evidence": {"S": "EVIDENCE#"},
        },
        ConsistentRead=True,
        Limit=100,
    )
    records = [
        deserialize_item(item)
        for item in result.get("Items", [])
        if isinstance(item, Mapping)
    ]
    refreshed = [
        _refresh_ingestion_status(scope, record)
        for record in records
    ]
    visible = [
        _public_record(record)
        for record in refreshed
        if record.get("status") != "DELETED"
    ]
    return sorted(
        visible,
        key=lambda item: str(item.get("updatedAt") or ""),
        reverse=True,
    )
