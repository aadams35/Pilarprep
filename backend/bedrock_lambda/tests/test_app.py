import base64
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if "boto3" not in sys.modules:
    fake_boto3 = types.ModuleType("boto3")
    fake_boto3.client = lambda *args, **kwargs: None
    sys.modules["boto3"] = fake_boto3

import app


MODEL_RESPONSE = json.dumps(
    {
        "technical": ["Validate current state."],
        "executive": ["Reduce delivery risk."],
        "stakeholders": ["Lena Ortiz: validate sponsor priorities."],
        "gameplan": ["Confirm success criteria."],
        "objections": ["Concern: disruption. Response: pilot safely."],
        "projectAnswer": "Run a two-week sprint with Lena Ortiz aligned.",
        "projectArtifacts": {
            "twoWeekPlan": [
                {
                    "title": "Days 1-2",
                    "detail": "Confirm stakeholders.",
                    "owner": "SA",
                    "status": "Ready",
                }
            ],
            "riskRegister": [],
            "stakeholderMap": [],
            "followUpEmail": {
                "subject": "Follow-up from PillarPrep briefing for Apex Mutual",
                "body": "Thanks for the conversation.",
            },
        },
        "citations": ["Customer context"],
    }
)


VALID_PAYLOAD = {
    "mode": "project",
    "company": "Apex Mutual",
    "industry": "Financial Services",
    "meetingType": "Executive Briefing",
    "companySize": "Enterprise",
    "pillars": ["Security", "Reliability"],
    "context": "Modernizing a customer portal with audit and migration risk.",
    "decisionMakers": [
        {
            "name": "Lena Ortiz",
            "title": "CIO",
            "source": "Customer-approved profile notes",
            "context": "Modernization governance and board visibility.",
        }
    ],
    "meetingNotes": "CIO approved a pilot if evidence is clear.",
    "role": "PM",
    "prompt": "Create the first two-week plan.",
}


class LambdaHandlerTest(unittest.TestCase):
    def invoke(self, payload, model_response=MODEL_RESPONSE):
        event = {"body": json.dumps(payload)}
        with patch.object(app, "_invoke_bedrock", return_value=model_response):
            response = app.handler(event, None)
        response["json"] = json.loads(response["body"])
        return response

    def test_generates_structured_brief(self):
        response = self.invoke(VALID_PAYLOAD)

        self.assertEqual(response["statusCode"], 200)
        body = response["json"]
        self.assertEqual(body["provider"], "bedrock")
        self.assertEqual(len(body["technical"]), 3)
        self.assertEqual(len(body["executive"]), 3)
        self.assertEqual(len(body["stakeholders"]), 3)
        self.assertEqual(len(body["gameplan"]), 3)
        self.assertEqual(len(body["objections"]), 3)
        self.assertEqual(len(body["projectArtifacts"]["twoWeekPlan"]), 3)
        self.assertEqual(len(body["projectArtifacts"]["riskRegister"]), 3)
        self.assertEqual(len(body["projectArtifacts"]["stakeholderMap"]), 3)
        self.assertTrue(body["projectArtifacts"]["followUpEmail"]["subject"].startswith("Follow-up"))
        self.assertEqual(body["metadata"]["projectId"], "apex-mutual")

    def test_accepts_base64_api_gateway_body(self):
        encoded = base64.b64encode(json.dumps(VALID_PAYLOAD).encode("utf-8")).decode("utf-8")
        event = {"body": encoded, "isBase64Encoded": True}

        with patch.object(app, "_invoke_bedrock", return_value=MODEL_RESPONSE):
            response = app.handler(event, None)

        self.assertEqual(response["statusCode"], 200)

    def test_rejects_missing_api_key_when_configured(self):
        event = {"body": json.dumps(VALID_PAYLOAD), "headers": {}}

        with patch.object(app, "PILLARPREP_API_KEY", "test-secret"):
            response = app.handler(event, None)

        response["json"] = json.loads(response["body"])
        self.assertEqual(response["statusCode"], 401)
        self.assertEqual(response["json"]["error"], "Unauthorized")

    def test_rejects_malformed_decision_makers(self):
        payload = dict(VALID_PAYLOAD, decisionMakers="bad")
        response = self.invoke(payload)

        self.assertEqual(response["statusCode"], 400)
        self.assertIn("decisionMakers", response["json"]["error"])

    def test_rejects_malformed_pillars(self):
        payload = dict(VALID_PAYLOAD, pillars="Security")
        response = self.invoke(payload)

        self.assertEqual(response["statusCode"], 400)
        self.assertIn("pillars", response["json"]["error"])

    def test_uses_safe_fallback_when_model_returns_plain_text(self):
        response = self.invoke(VALID_PAYLOAD, "Here is a useful brief, but not JSON.")

        self.assertEqual(response["statusCode"], 200)
        body = response["json"]
        self.assertEqual(body["provider"], "bedrock")
        self.assertEqual(len(body["technical"]), 3)
        self.assertEqual(len(body["projectArtifacts"]["twoWeekPlan"]), 3)
        self.assertIn("Customer context", body["citations"])

    def test_parses_markdown_fenced_json(self):
        response = self.invoke(VALID_PAYLOAD, f"```json\n{MODEL_RESPONSE}\n```")

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["json"]["projectAnswer"], "Run a two-week sprint with Lena Ortiz aligned.")

    def test_bedrock_invocation_failure_returns_502(self):
        event = {"body": json.dumps(VALID_PAYLOAD)}

        with patch.object(app, "_invoke_bedrock", side_effect=RuntimeError("model unavailable")):
            response = app.handler(event, None)

        response["json"] = json.loads(response["body"])
        self.assertEqual(response["statusCode"], 502)
        self.assertIn("Bedrock invocation failed", response["json"]["error"])


if __name__ == "__main__":
    unittest.main()