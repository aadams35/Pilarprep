import json
import os
from datetime import datetime, timezone

import boto3


MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
REGION = os.getenv("AWS_REGION", "us-east-1")
ARTIFACT_BUCKET = os.getenv("ARTIFACT_BUCKET", "")
PROJECT_TABLE = os.getenv("PROJECT_TABLE", "")


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": os.getenv("ALLOWED_ORIGIN", "*"),
        },
        "body": json.dumps(body),
    }


def _build_prompt(payload):
    return f"""
You are PillarPrep, an AWS Solutions Architect briefing assistant.

Return strict JSON with these keys:
technical, executive, gameplan, objections, projectAnswer, citations.
Each of technical/executive/gameplan/objections/citations must be an array of strings.

Company: {payload.get("company")}
Industry: {payload.get("industry")}
Meeting type: {payload.get("meetingType")}
Company size: {payload.get("companySize")}
AWS pillar priorities: {", ".join(payload.get("pillars", []))}
Known context: {payload.get("context")}
Meeting notes: {payload.get("meetingNotes", "")}
Feedback: {", ".join(payload.get("feedback", []))}
Follow-on role: {payload.get("role", "")}
Follow-on prompt: {payload.get("prompt", "")}

Rules:
- Generate both technical and executive material.
- Keep the executive brief low-jargon.
- Tie recommendations to AWS Well-Architected pillars.
- Include practical AWS services only when useful.
- Treat unknowns as assumptions to validate.
"""


def _invoke_bedrock(prompt):
    client = boto3.client("bedrock-runtime", region_name=REGION)
    result = client.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "temperature": 0.3,
            "maxTokens": 1800,
        },
    )
    return result["output"]["message"]["content"][0]["text"]


def _as_string_list(value):
    if isinstance(value, list):
        return [str(item) for item in value if item]

    if value:
        return [str(value)]

    return []


def _parse_model_response(model_text):
    cleaned = model_text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]

    parsed = json.loads(cleaned)

    return {
        "technical": _as_string_list(parsed.get("technical")),
        "executive": _as_string_list(parsed.get("executive")),
        "gameplan": _as_string_list(parsed.get("gameplan")),
        "objections": _as_string_list(parsed.get("objections")),
        "projectAnswer": str(parsed.get("projectAnswer", "")),
        "citations": _as_string_list(parsed.get("citations")),
    }


def _project_id(payload):
    company = payload.get("company") or "customer"
    slug = "".join(char.lower() if char.isalnum() else "-" for char in company)
    slug = "-".join(part for part in slug.split("-") if part)
    return payload.get("projectId") or slug or "customer"


def _store_project_artifacts(payload, generated):
    metadata = {"projectId": _project_id(payload)}
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    document = {
        "request": payload,
        "response": generated,
        "storedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if ARTIFACT_BUCKET:
            artifact_key = f"projects/{metadata['projectId']}/briefs/{timestamp}.json"
            s3 = boto3.client("s3", region_name=REGION)
            s3.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=artifact_key,
                Body=json.dumps(document).encode("utf-8"),
                ContentType="application/json",
            )
            metadata["artifactKey"] = artifact_key

        if PROJECT_TABLE:
            state_key = f"BRIEF#{timestamp}"
            dynamodb = boto3.client("dynamodb", region_name=REGION)
            dynamodb.put_item(
                TableName=PROJECT_TABLE,
                Item={
                    "projectId": {"S": metadata["projectId"]},
                    "sortKey": {"S": state_key},
                    "company": {"S": payload.get("company", "")},
                    "industry": {"S": payload.get("industry", "")},
                    "meetingType": {"S": payload.get("meetingType", "")},
                    "provider": {"S": "bedrock"},
                    "createdAt": {"S": document["storedAt"]},
                },
            )
            metadata["stateKey"] = state_key
    except Exception as error:  # Keep generation useful even if storage is misconfigured.
        metadata["storageWarning"] = str(error)

    return metadata


def handler(event, _context):
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON payload"})

    required = ["company", "industry", "meetingType", "companySize", "pillars", "context"]
    missing = [field for field in required if not payload.get(field)]

    if missing:
        return _response(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    prompt = _build_prompt(payload)
    model_text = _invoke_bedrock(prompt)

    try:
        generated = _parse_model_response(model_text)
    except json.JSONDecodeError:
        generated = {
            "technical": [model_text],
            "executive": [],
            "gameplan": [],
            "objections": [],
            "projectAnswer": "",
            "citations": ["Amazon Bedrock model response"],
        }

    generated["provider"] = "bedrock"
    generated["generatedAt"] = datetime.now(timezone.utc).isoformat()
    generated["metadata"] = _store_project_artifacts(payload, generated)

    return _response(200, generated)
