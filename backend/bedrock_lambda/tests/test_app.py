import base64
import json
import sys
from io import BytesIO
from zipfile import ZipFile
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


MODEL_TECHNICAL = (
    "For Apex Mutual, validate identity boundaries, audit evidence, data movement, recovery expectations, and operational ownership before proposing the target architecture. "
    "Use the ranked pillar order to keep Security first while Reliability and Cost Optimization shape the secondary tradeoffs. "
    "Tie each AWS service mention to an approval decision, control proof, or measurable reduction in migration risk. "
    "Ask: \"Which current-state assumption would change the plan most if it proved wrong?\""
)
MODEL_EXECUTIVE = (
    "Apex Mutual should treat the briefing as a decision-quality exercise, not a platform presentation. "
    "The business value is reduced migration risk, clearer ownership, faster evidence collection, and better confidence before expanding beyond a pilot. "
    "Keep the conversation focused on trust, governance, time to value, and the cost of avoidable rework. "
    "Ask: \"What outcome would make the next thirty days visibly better for the business?\""
)
MODEL_STAKEHOLDER = (
    "Lena Ortiz should be treated as the sponsor whose priorities need validation around board visibility, modernization governance, and customer trust. "
    "Use the approved notes as hypotheses, then confirm what has changed before turning them into a talk track. "
    "Map her success criteria to the first pilot decision and the evidence needed for approval. "
    "Ask: \"What would make this initiative worth supporting now, and what risk would stop it?\""
)
MODEL_GAMEPLAN = (
    "Open the meeting by confirming the business event driving urgency, then read back the ranked pillar order so the team can correct it early. "
    "Move from business goals to current-state evidence, then from evidence to a bounded pilot decision. "
    "Capture owners, open questions, risks, and next actions while the customer is still present. "
    "Ask: \"Which unresolved question is most likely to block approval this week?\""
)
MODEL_OBJECTION = (
    "Concern: \"We cannot risk disruption during the migration.\" Response: keep the first step bounded, name rollback criteria, and require evidence before expanding the scope. "
    "Position the brief as a validation plan rather than a commitment to a final architecture. "
    "Ask: \"Which workflow is small enough to validate safely but important enough to prove value?\""
)
MODEL_PROJECT_ANSWER = (
    "For the PM, turn the approved brief into a two-week validation sprint with named owners, evidence checkpoints, and a visible decision log. "
    "Start by confirming the sponsor, technical owner, security approver, and project driver. "
    "Then validate the top Security assumptions with customer artifacts before architecture decisions harden. "
    "Use the project model to track risks, dependencies, meeting notes, and open decisions so new contributors do not rediscover context. "
    "Escalate first if the team cannot identify who owns approval for the pilot scope."
)

MODEL_RESPONSE = json.dumps(
    {
        "technical": [f"{MODEL_TECHNICAL} Item {index + 1}." for index in range(4)],
        "executive": [f"{MODEL_EXECUTIVE} Item {index + 1}." for index in range(4)],
        "stakeholders": [f"{MODEL_STAKEHOLDER} Item {index + 1}." for index in range(4)],
        "gameplan": [f"{MODEL_GAMEPLAN} Item {index + 1}." for index in range(4)],
        "objections": [f"{MODEL_OBJECTION} Item {index + 1}." for index in range(4)],
        "projectAnswer": MODEL_PROJECT_ANSWER,
        "projectArtifacts": {
            "twoWeekPlan": [
                {
                    "title": f"Sprint step {index + 1}",
                    "detail": "Confirm owners, validate evidence, document risks, and prepare the next decision checkpoint.",
                    "owner": "SA / PM",
                    "status": "Ready",
                }
                for index in range(4)
            ],
            "riskRegister": [
                {
                    "title": f"Risk {index + 1}",
                    "detail": "Track assumptions that could delay approval if customer evidence is not captured.",
                    "owner": "SA",
                    "status": "Medium",
                }
                for index in range(4)
            ],
            "stakeholderMap": [
                {
                    "title": f"Stakeholder {index + 1}",
                    "detail": "Validate the role, approval concern, needed evidence, and follow-through owner.",
                    "owner": "Customer team",
                    "status": "Validate",
                }
                for index in range(4)
            ],
            "followUpEmail": {
                "subject": "Follow-up from PilarPrep briefing for Apex Mutual",
                "body": "Thanks for the conversation. We captured owners, risks, evidence needs, and the next validation sprint.",
            },
        },
        "citations": ["Customer context", "Decision-maker notes", "AWS Well-Architected pillars"],
    }
)

VALID_PAYLOAD = {
    "mode": "project",
    "company": "Apex Mutual",
    "industry": "Financial Services",
    "meetingType": "Executive Briefing",
    "companySize": "Enterprise",
    "pillars": ["Security", "Reliability", "Cost Optimization"],
    "pillarRanking": [
        {"rank": 1, "pillar": "Security"},
        {"rank": 2, "pillar": "Reliability"},
        {"rank": 3, "pillar": "Cost Optimization"},
    ],
    "context": "Modernizing a customer portal with audit and migration risk.",
    "companyValues": "Trust, transparent governance, careful change management, and measurable customer impact.",
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
    "approvedBrief": {
        "technical": [f"{MODEL_TECHNICAL} Approved {index + 1}." for index in range(4)],
        "executive": [f"{MODEL_EXECUTIVE} Approved {index + 1}." for index in range(4)],
        "stakeholders": [f"{MODEL_STAKEHOLDER} Approved {index + 1}." for index in range(4)],
        "gameplan": [f"{MODEL_GAMEPLAN} Approved {index + 1}." for index in range(4)],
        "objections": [f"{MODEL_OBJECTION} Approved {index + 1}." for index in range(4)],
        "citations": ["Approved packet", "Customer context"],
    },
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
        self.assertEqual(len(body["technical"]), 4)
        self.assertEqual(len(body["executive"]), 4)
        self.assertEqual(len(body["stakeholders"]), 4)
        self.assertEqual(len(body["gameplan"]), 4)
        self.assertEqual(len(body["objections"]), 4)
        self.assertEqual(len(body["projectArtifacts"]["twoWeekPlan"]), 4)
        self.assertEqual(len(body["projectArtifacts"]["riskRegister"]), 4)
        self.assertEqual(len(body["projectArtifacts"]["stakeholderMap"]), 4)
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

    def test_rejects_malformed_pillar_ranking(self):
        payload = dict(VALID_PAYLOAD, pillarRanking="Security")
        response = self.invoke(payload)

        self.assertEqual(response["statusCode"], 400)
        self.assertIn("pillarRanking", response["json"]["error"])

    def test_prompt_includes_ranked_pillar_contract(self):
        prompt = app._build_prompt(VALID_PAYLOAD)

        self.assertIn('"pillarRanking"', prompt)
        self.assertIn('"rank": 1', prompt)
        self.assertIn('"approvedBrief"', prompt)
        self.assertIn('"companyValues"', prompt)
        self.assertIn("treat it as the approved pre-brief packet", prompt)
        self.assertIn("morning-after handoff", prompt)
        self.assertIn("rank 1 is the primary discovery lens", prompt)
        self.assertIn("hard anchors, not optional flavor", prompt)
        self.assertIn("Do not write a paragraph that could be reused unchanged", prompt)
        self.assertIn("exactly 4 SA-facing paragraphs", prompt)
        self.assertIn("Ask:", prompt)

    def test_docx_export_contains_brief_sections(self):
        generated = json.loads(MODEL_RESPONSE)
        docx_bytes = app._brief_docx_bytes(VALID_PAYLOAD, generated, {"projectId": "apex-mutual"})

        with ZipFile(BytesIO(docx_bytes)) as docx:
            self.assertIn("word/document.xml", docx.namelist())
            document_xml = docx.read("word/document.xml").decode("utf-8")

        self.assertIn("PilarPrep Brief - Apex Mutual", document_xml)
        self.assertIn("Technical Brief", document_xml)
        self.assertIn("Executive Brief", document_xml)
        self.assertIn("Two-Week Plan", document_xml)

    def test_store_project_artifacts_replaces_previous_s3_outputs(self):
        generated = json.loads(MODEL_RESPONSE)
        put_objects = []
        presigned_requests = []
        delete_batches = []
        dynamodb_items = []

        paginator_calls = []

        class FakePaginator:
            def paginate(self, **kwargs):
                paginator_calls.append(kwargs)
                return [
                    {
                        "Contents": [
                            {"Key": "clients/apex-mutual/brief/old.json"},
                            {"Key": "clients/apex-mutual/brief/old.docx"},
                        ]
                    }
                ]

        paginator_names = []

        class FakeS3:
            def get_paginator(self, name):
                paginator_names.append(name)
                return FakePaginator()

            def delete_objects(self, **kwargs):
                delete_batches.append(kwargs)

            def put_object(self, **kwargs):
                put_objects.append(kwargs)

            def generate_presigned_url(self, operation, **kwargs):
                presigned_requests.append({"operation": operation, **kwargs})
                return "https://download.example/latest.docx"

        class FakeDynamoDB:
            def put_item(self, **kwargs):
                dynamodb_items.append(kwargs)

        def fake_client(service_name, **_kwargs):
            if service_name == "s3":
                return FakeS3()
            if service_name == "dynamodb":
                return FakeDynamoDB()
            raise AssertionError(f"Unexpected client: {service_name}")

        with (
            patch.object(app, "ARTIFACT_BUCKET", "artifact-bucket"),
            patch.object(app, "PROJECT_TABLE", "project-table"),
            patch.object(app.boto3, "client", side_effect=fake_client),
        ):
            metadata = app._store_project_artifacts(VALID_PAYLOAD, generated)

        self.assertEqual(paginator_names, ["list_objects_v2"])
        self.assertEqual(paginator_calls[0]["Bucket"], "artifact-bucket")
        self.assertEqual(paginator_calls[0]["Prefix"], "clients/apex-mutual/brief/")
        self.assertEqual(metadata["artifactKey"], "clients/apex-mutual/brief/latest.json")
        self.assertEqual(metadata["docxArtifactKey"], "clients/apex-mutual/brief/latest.docx")
        self.assertEqual(metadata["docxDownloadUrl"], "https://download.example/latest.docx")
        self.assertEqual(metadata["stateKey"], "BRIEF#LATEST")
        self.assertEqual(metadata["artifactRetention"], "latest-only")
        self.assertEqual(delete_batches[0]["Delete"]["Objects"][0]["Key"], "clients/apex-mutual/brief/old.json")
        self.assertEqual(len(put_objects), 2)
        self.assertEqual(presigned_requests[0]["operation"], "get_object")
        self.assertEqual(presigned_requests[0]["Params"]["Key"], "clients/apex-mutual/brief/latest.docx")
        self.assertEqual(presigned_requests[0]["ExpiresIn"], 3600)
        self.assertEqual(put_objects[0]["ContentType"], "application/json")
        self.assertEqual(put_objects[1]["ContentType"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertTrue(put_objects[1]["Body"].startswith(b"PK"))
        self.assertEqual(dynamodb_items[0]["Item"]["sortKey"]["S"], "BRIEF#LATEST")

    def test_bedrock_invocation_uses_guardrail_when_configured(self):
        captured = {}

        class FakeBedrockClient:
            def converse(self, **kwargs):
                captured.update(kwargs)
                return {
                    "output": {"message": {"content": [{"text": MODEL_RESPONSE}]}},
                    "usage": {"inputTokens": 10, "outputTokens": 20, "totalTokens": 30},
                    "metrics": {"latencyMs": 1234},
                }

        with (
            patch.object(app.boto3, "client", return_value=FakeBedrockClient()),
            patch.object(app, "GUARDRAIL_ID", "guardrail-abc123"),
            patch.object(app, "GUARDRAIL_VERSION", "1"),
        ):
            result = app._invoke_bedrock("Generate the demo brief")

        self.assertEqual(result["text"], MODEL_RESPONSE)
        self.assertEqual(captured["guardrailConfig"]["guardrailIdentifier"], "guardrail-abc123")
        self.assertEqual(captured["guardrailConfig"]["guardrailVersion"], "1")
        self.assertEqual(captured["guardrailConfig"]["trace"], "enabled")

    def test_uses_safe_fallback_when_model_returns_plain_text(self):
        response = self.invoke(VALID_PAYLOAD, "Here is a useful brief, but not JSON.")

        self.assertEqual(response["statusCode"], 200)
        body = response["json"]
        self.assertEqual(body["provider"], "bedrock")
        self.assertEqual(len(body["technical"]), 4)
        self.assertEqual(len(body["projectArtifacts"]["twoWeekPlan"]), 4)
        self.assertIn("Customer context", body["citations"])

    def test_parses_markdown_fenced_json(self):
        response = self.invoke(VALID_PAYLOAD, f"```json\n{MODEL_RESPONSE}\n```")

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["json"]["projectAnswer"], MODEL_PROJECT_ANSWER)

    def test_bedrock_invocation_failure_returns_502(self):
        event = {"body": json.dumps(VALID_PAYLOAD)}

        with patch.object(app, "_invoke_bedrock", side_effect=RuntimeError("model unavailable")):
            response = app.handler(event, None)

        response["json"] = json.loads(response["body"])
        self.assertEqual(response["statusCode"], 502)
        self.assertIn("Bedrock invocation failed", response["json"]["error"])


if __name__ == "__main__":
    unittest.main()