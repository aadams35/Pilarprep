import json
import os
from datetime import datetime, timezone

import boto3


MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
REGION = os.getenv("AWS_REGION", "us-east-1")


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
        generated = json.loads(model_text)
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

    return _response(200, generated)
