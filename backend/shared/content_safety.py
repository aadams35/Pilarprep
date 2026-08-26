from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

import boto3


MAX_COMPREHEND_CHARS = 4_500
MAX_GUARDRAIL_CHARS = 8_000
PII_SCORE_THRESHOLD = float(os.getenv("PII_SCORE_THRESHOLD", "0.75"))

HIGH_RISK_PII_TYPES = {
    "AWS_ACCESS_KEY",
    "AWS_SECRET_KEY",
    "BANK_ACCOUNT_NUMBER",
    "BANK_ROUTING",
    "CREDIT_DEBIT_CVV",
    "CREDIT_DEBIT_EXPIRY",
    "CREDIT_DEBIT_NUMBER",
    "PASSWORD",
    "PIN",
    "SSN",
}
CONTROL_FIELDS = {
    "action",
    "approvedBrief",
    "audienceRole",
    "briefRequest",
    "clientId",
    "confirmWrite",
    "contentType",
    "idempotencyKey",
    "identityType",
    "inputVersion",
    "meetingId",
    "mode",
    "modelId",
    "modelPreference",
    "phase",
    "projectId",
    "provider",
    "role",
    "scenarioId",
    "scopeToken",
    "sessionId",
    "source",
    "status",
    "tenantId",
    "traceId",
    "userId",
}
_CLIENTS: dict[str, Any] = {}


class ContentSafetyError(RuntimeError):
    pass


class ContentSafetyConfigurationError(ContentSafetyError):
    pass


class ContentPolicyViolation(ContentSafetyError):
    pass


class HighRiskPiiViolation(ContentPolicyViolation):
    pass


class GuardrailIntervention(ContentPolicyViolation):
    pass


def clear_client_cache() -> None:
    _CLIENTS.clear()


def aws_client(service_name: str) -> Any:
    if service_name not in _CLIENTS:
        _CLIENTS[service_name] = boto3.client(
            service_name,
            region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"),
        )
    return _CLIENTS[service_name]


def enabled() -> bool:
    return os.getenv("PII_SCREENING_ENABLED", "false").strip().lower() == "true"


def _guardrail_configuration() -> tuple[str, str]:
    identifier = os.getenv("BEDROCK_GUARDRAIL_ID", "").strip()
    version = os.getenv("BEDROCK_GUARDRAIL_VERSION", "").strip()
    if not identifier or not version:
        raise ContentSafetyConfigurationError(
            "Required AI content-safety controls are not configured"
        )
    return identifier, version


def _chunks(text: str, maximum: int) -> list[str]:
    chunks: list[str] = []
    cursor = 0
    while cursor < len(text):
        end = min(len(text), cursor + maximum)
        if end < len(text):
            split = max(text.rfind("\n", cursor, end), text.rfind(" ", cursor, end))
            if split > cursor:
                end = split + 1
        chunks.append(text[cursor:end])
        cursor = end
    return chunks


def _placeholder(
    pii_type: str,
    raw_value: str,
    placeholders: dict[tuple[str, str], str],
) -> str:
    key = (pii_type, raw_value.casefold())
    if key not in placeholders:
        sequence = sum(1 for known_type, _ in placeholders if known_type == pii_type) + 1
        placeholders[key] = f"[PII:{pii_type}:{sequence:03d}]"
    return placeholders[key]


def _redact_text(
    text: str,
    placeholders: dict[tuple[str, str], str],
    pii_types: set[str],
) -> tuple[str, int, int]:
    output: list[str] = []
    redactions = 0
    chunks_processed = 0
    for chunk in _chunks(text, MAX_COMPREHEND_CHARS):
        chunks_processed += 1
        response = aws_client("comprehend").detect_pii_entities(
            Text=chunk,
            LanguageCode="en",
        )
        candidates: list[tuple[int, int, str]] = []
        for entity in response.get("Entities", []):
            if not isinstance(entity, Mapping):
                continue
            pii_type = str(entity.get("Type") or "").upper()
            begin = int(entity.get("BeginOffset") or 0)
            end = int(entity.get("EndOffset") or 0)
            if (
                float(entity.get("Score") or 0) < PII_SCORE_THRESHOLD
                or not pii_type
                or begin < 0
                or end <= begin
            ):
                continue
            if end > len(chunk):
                raise ContentSafetyError("PII detector returned invalid offsets")
            if pii_type in HIGH_RISK_PII_TYPES:
                raise HighRiskPiiViolation(
                    "High-risk sensitive information must be removed before processing"
                )
            candidates.append((begin, end, pii_type))

        selected: list[tuple[int, int, str]] = []
        for candidate in sorted(candidates, key=lambda item: (item[0], -item[1])):
            if selected and candidate[0] < selected[-1][1]:
                continue
            selected.append(candidate)

        cursor = 0
        transformed: list[str] = []
        for begin, end, pii_type in selected:
            transformed.append(chunk[cursor:begin])
            transformed.append(
                _placeholder(pii_type, chunk[begin:end], placeholders)
            )
            cursor = end
            redactions += 1
            pii_types.add(pii_type)
        transformed.append(chunk[cursor:])
        output.append("".join(transformed))
    return "".join(output), redactions, chunks_processed


def _sanitize(
    value: object,
    placeholders: dict[tuple[str, str], str],
    pii_types: set[str],
    text_sink: list[str],
    field_name: str = "",
) -> tuple[object, int, int]:
    if field_name in CONTROL_FIELDS:
        return value, 0, 0
    if isinstance(value, str):
        sanitized, redactions, chunks_processed = _redact_text(
            value, placeholders, pii_types
        )
        if sanitized.strip():
            text_sink.append(sanitized)
        return sanitized, redactions, chunks_processed
    if isinstance(value, Mapping):
        result: dict[object, object] = {}
        redactions = 0
        chunks_processed = 0
        for key, item in value.items():
            sanitized, count, chunk_count = _sanitize(
                item, placeholders, pii_types, text_sink, str(key)
            )
            result[key] = sanitized
            redactions += count
            chunks_processed += chunk_count
        return result, redactions, chunks_processed
    if isinstance(value, (list, tuple)):
        result_list: list[object] = []
        redactions = 0
        chunks_processed = 0
        for item in value:
            sanitized, count, chunk_count = _sanitize(
                item, placeholders, pii_types, text_sink
            )
            result_list.append(sanitized)
            redactions += count
            chunks_processed += chunk_count
        result: object = tuple(result_list) if isinstance(value, tuple) else result_list
        return result, redactions, chunks_processed
    return value, 0, 0


def _apply_guardrail(texts: list[str], source: str) -> int:
    identifier, version = _guardrail_configuration()
    chunks_processed = 0
    for text in texts:
        for chunk in _chunks(text, MAX_GUARDRAIL_CHARS):
            chunks_processed += 1
            response = aws_client("bedrock-runtime").apply_guardrail(
                guardrailIdentifier=identifier,
                guardrailVersion=version,
                source=source,
                content=[{"text": {"text": chunk}}],
            )
            action = str(response.get("action") or "")
            if action == "GUARDRAIL_INTERVENED":
                raise GuardrailIntervention(
                    "Content did not pass the configured AI safety policy"
                )
            if action != "NONE":
                raise ContentSafetyError(
                    "Guardrail returned an unknown policy result"
                )
    return chunks_processed


def screen_payload(
    value: object,
    *,
    source: str,
    action: str,
    trace_id: str = "",
) -> tuple[object, dict[str, object]]:
    del action, trace_id
    normalized_source = source.strip().upper()
    if normalized_source not in {"INPUT", "OUTPUT"}:
        raise ValueError("Content-safety source must be INPUT or OUTPUT")
    if not enabled():
        return value, {
            "source": normalized_source,
            "policyResult": "disabled",
            "redactionCount": 0,
            "piiTypes": [],
            "comprehendChunks": 0,
            "guardrailChunks": 0,
        }

    placeholders: dict[tuple[str, str], str] = {}
    pii_types: set[str] = set()
    texts: list[str] = []
    sanitized, redactions, comprehend_chunks = _sanitize(
        value, placeholders, pii_types, texts
    )
    guardrail_chunks = _apply_guardrail(texts, normalized_source)
    return sanitized, {
        "source": normalized_source,
        "policyResult": "passed",
        "redactionCount": redactions,
        "piiTypes": sorted(pii_types),
        "comprehendChunks": comprehend_chunks,
        "guardrailChunks": guardrail_chunks,
    }
