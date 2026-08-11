import base64
import json
import os
from datetime import datetime, timezone

import boto3


MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
REGION = os.getenv("AWS_REGION", "us-east-1")
ARTIFACT_BUCKET = os.getenv("ARTIFACT_BUCKET", "")
PROJECT_TABLE = os.getenv("PROJECT_TABLE", "")
PILLARPREP_API_KEY = os.getenv("PILLARPREP_API_KEY", "")


def _metric(name, value=1, **dimensions):
    metric_dimensions = dimensions or {"Service": "BriefFunction"}
    metric = {
        "_aws": {
            "Timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "PillarPrep",
                    "Dimensions": [list(metric_dimensions.keys())],
                    "Metrics": [{"Name": name, "Unit": "Count"}],
                }
            ],
        },
        name: value,
        **metric_dimensions,
    }
    print(json.dumps(metric))


def _request_header(event, name):
    headers = event.get("headers") if isinstance(event, dict) else None
    if not isinstance(headers, dict):
        return ""

    target = name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return str(value or "")

    return ""


def _is_authorized(event):
    if not PILLARPREP_API_KEY:
        return True

    return _request_header(event, "x-api-key") == PILLARPREP_API_KEY


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": os.getenv("ALLOWED_ORIGIN", "*"),
        },
        "body": json.dumps(body),
    }


def _load_payload(event):
    body = event.get("body") if isinstance(event, dict) else None

    if isinstance(body, dict):
        return body

    if body is None:
        return {}

    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    return json.loads(body or "{}")


def _build_prompt(payload):
    decision_makers = json.dumps(
        payload.get("decisionMakers", []),
        ensure_ascii=True,
    )

    return f"""
You are PillarPrep, an AWS Solutions Architect briefing assistant.

Return strict JSON with these keys:
technical, executive, stakeholders, gameplan, objections, projectAnswer, projectArtifacts, citations.
Each of technical/executive/stakeholders/gameplan/objections/citations must be an array of strings.
projectArtifacts must be an object with these keys:
twoWeekPlan, riskRegister, stakeholderMap, followUpEmail.
twoWeekPlan/riskRegister/stakeholderMap must be arrays of objects with title, detail, owner, and status.
followUpEmail must be an object with subject and body.

Company: {payload.get("company")}
Industry: {payload.get("industry")}
Meeting type: {payload.get("meetingType")}
Company size: {payload.get("companySize")}
AWS pillar priorities: {", ".join(payload.get("pillars", []))}
Known context: {payload.get("context")}
Decision-maker context: {decision_makers}
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
- Treat decision-maker context as user-provided or customer-approved notes.
- Do not claim to scrape, browse, or verify LinkedIn or any external profile.
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
            "maxTokens": 2400,
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
        "stakeholders": _as_string_list(parsed.get("stakeholders")),
        "gameplan": _as_string_list(parsed.get("gameplan")),
        "objections": _as_string_list(parsed.get("objections")),
        "projectAnswer": str(parsed.get("projectAnswer", "")),
        "projectArtifacts": parsed.get("projectArtifacts")
        if isinstance(parsed.get("projectArtifacts"), dict)
        else {},
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
        _metric("BriefErrors", ErrorType="Storage")

    return metadata


def handler(event, _context):
    if not _is_authorized(event):
        _metric("UnauthorizedRequests")
        return _response(401, {"error": "Unauthorized"})

    _metric("BriefRequests")

    try:
        payload = _load_payload(event)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        _metric("BriefErrors", ErrorType="InvalidJson")
        return _response(400, {"error": "Invalid JSON payload"})

    required = ["company", "industry", "meetingType", "companySize", "pillars", "context"]
    missing = [field for field in required if not payload.get(field)]

    if missing:
        _metric("BriefErrors", ErrorType="MissingFields")
        return _response(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    if "decisionMakers" in payload and not isinstance(payload["decisionMakers"], list):
        _metric("BriefErrors", ErrorType="InvalidDecisionMakers")
        return _response(400, {"error": "decisionMakers must be an array"})

    if not isinstance(payload.get("pillars"), list):
        _metric("BriefErrors", ErrorType="InvalidPillars")
        return _response(400, {"error": "pillars must be an array"})

    prompt = _build_prompt(payload)
    model_text = _invoke_bedrock(prompt)

    try:
        generated = _parse_model_response(model_text)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        _metric("BriefErrors", ErrorType="ModelJsonFallback")
        generated = {
            "technical": [model_text],
            "executive": [],
            "stakeholders": [],
            "gameplan": [],
            "objections": [],
            "projectAnswer": "",
            "projectArtifacts": {},
            "citations": ["Amazon Bedrock model response"],
        }

    generated["provider"] = "bedrock"
    generated["generatedAt"] = datetime.now(timezone.utc).isoformat()
    generated["metadata"] = _store_project_artifacts(payload, generated)
    _metric("BriefSuccess")

    return _response(200, generated)