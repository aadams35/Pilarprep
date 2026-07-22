# PillarPrep

PillarPrep is an AWS-focused SA briefing generator for hackathon demos.

The app has two loops:

1. Pre-brief refinement: generate, review, refine, and approve a customer-ready SA brief.
2. Follow-on project model: promote the final brief and meeting notes into Project Brain for sales, executives, PMs, engineers, and new project members.

Live demo:

https://pillarprep-console.adamsaustin35.chatgpt.site

## Current Shape

- Frontend: React, Next-compatible Vinext app
- Hosted demo: OpenAI Sites
- Local API contract: `POST /api/brief`
- Demo provider: deterministic local generator in `lib/pillarprep/generator.ts`
- AWS implementation target: `backend/bedrock_lambda/`
- Prompt contract: `docs/prompt-contract.md`

## Why Bedrock First

Amazon Bedrock is the core v1 choice because PillarPrep needs managed generation, role-aware refinement, guardrails, and a Knowledge Bases path for Project Brain. It avoids custom model hosting while keeping the architecture AWS-native.

Recommended production path:

```text
React app
  -> API Gateway
  -> Lambda
  -> Amazon Bedrock
  -> S3 approved brief artifacts
  -> DynamoDB project state
  -> Bedrock Knowledge Bases
  -> Project Brain answers
```

## Where Strands Fits

Strands is the optional agent layer for Phase 2. Use it when Project Brain needs tool use, multi-step project workflows, role-aware implementation planning, or retrieval-backed follow-up actions.

Recommended split:

- Bedrock: brief generation, refinement, structured outputs, guardrails
- Strands: follow-on agent orchestration for Project Brain
- SageMaker: out of scope for v1 unless the team decides to train, fine-tune, or host custom models

## API Contract

`POST /api/brief`

```json
{
  "mode": "prebrief",
  "company": "Apex Mutual",
  "industry": "Financial Services",
  "meetingType": "Executive Briefing",
  "companySize": "Enterprise",
  "pillars": ["Security", "Reliability"],
  "context": "Modernizing a customer portal with audit and migration risk.",
  "meetingNotes": "",
  "feedback": ["Reduce AWS jargon"],
  "role": "PM",
  "prompt": "Create the first two-week plan."
}
```

Response:

```json
{
  "provider": "demo",
  "generatedAt": "2026-07-22T00:00:00.000Z",
  "technical": [],
  "executive": [],
  "gameplan": [],
  "objections": [],
  "projectAnswer": "",
  "citations": []
}
```

## AWS Backend

The Lambda reference lives in `backend/bedrock_lambda/app.py`.

The SAM template lives in `backend/bedrock_lambda/template.yaml`.

Deploy from that folder when the AWS sandbox is ready:

```bash
cd backend/bedrock_lambda
sam build
sam deploy --guided
```

After deployment, set the frontend environment variable to the SAM output URL:

```bash
PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
```

If API Gateway is protected with an API key, also set:

```bash
PILLARPREP_BACKEND_API_KEY=...
```

When `PILLARPREP_BACKEND_URL` is absent, the app uses the local demo generator.

Minimum IAM permissions for the Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": ["bedrock:InvokeModel"],
  "Resource": "*"
}
```

For production, scope `Resource` to the selected model ARN and add permissions for S3, DynamoDB, CloudWatch Logs, and Knowledge Bases as those features are implemented.

Optional Strands reference:

```text
backend/bedrock_lambda/strands_agent.py
```

## Local Development

```bash
npm install
npm run dev
npm test
```

The local app works without AWS credentials because `/api/brief` currently uses the demo provider. Swap the API implementation to the Bedrock Lambda once the AWS sandbox is ready.
