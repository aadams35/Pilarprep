# PillarPrep

PillarPrep is an AWS-focused SA briefing generator for hackathon demos.

The app has two loops:

1. Pre-brief refinement: generate, review, refine, and approve a customer-ready SA brief.
2. Follow-on project model: promote the final brief, decision-maker context, and meeting notes into Project Brain for sales, executives, PMs, engineers, and new project members.

Live demos:

- AWS CloudFront static frontend: https://d2e0btay0ynyf.cloudfront.net
- OpenAI Sites demo: https://pillarprep-console.adamsaustin35.chatgpt.site

## Current Shape

- Frontend: React, Next-compatible Vinext app
- Hosted demo: AWS CloudFront static frontend and OpenAI Sites
- Local API contract: `POST /api/brief`
- Demo provider: deterministic local generator in `lib/pillarprep/generator.ts`
- Decision-maker context: manual/customer-approved profile notes, not automated LinkedIn scraping
- Working Project Brain loop: role/prompt ask flow plus generated handoff artifacts
- Local workspace persistence: browser saves the current demo workspace until reset
- AWS implementation target: `backend/bedrock_lambda/`
- Prompt contract: `docs/prompt-contract.md`
- Architecture notes: `docs/aws-infrastructure-design.md`
- AWS Lambda demo runbook: `docs/aws-lambda-demo-runbook.md`
- Demo script: `docs/demo-script.md`
- Project Brain tools: `docs/project-brain-tools.md`
- Brief quality eval: `npm run eval:briefs`

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
  "decisionMakers": [
    {
      "name": "Lena Ortiz",
      "title": "CIO",
      "source": "Customer-approved profile notes",
      "context": "Prior notes emphasize board visibility, customer trust, modernization governance, and avoiding a risky big-bang migration."
    }
  ],
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
  "stakeholders": [],
  "gameplan": [],
  "objections": [],
  "projectAnswer": "",
  "projectArtifacts": {
    "twoWeekPlan": [],
    "riskRegister": [],
    "stakeholderMap": [],
    "followUpEmail": {
      "subject": "",
      "body": ""
    }
  },
  "citations": []
}
```

## AWS Frontend

The AWS-hosted frontend uses a static Vite build of the existing React UI. It is deployed to a private S3 bucket behind CloudFront and runs in browser-only demo mode, so it does not call Bedrock or `/api/brief` from the public bundle. Live AWS mode is kept behind the server-backed local/Vinext route so the API key stays private.

```bash
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
```

Current AWS frontend URL:

```text
https://d2e0btay0ynyf.cloudfront.net
```

Static frontend infrastructure lives in `backend/frontend_static/template.yaml`.
## AWS Backend

The Lambda reference lives in `backend/bedrock_lambda/app.py`.

The CloudFormation/SAM-compatible template lives in `backend/bedrock_lambda/template.yaml`.

The fastest deployment path for this machine is the AWS CLI script:

```bash
.\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin http://127.0.0.1:3002
```

That script packages and deploys API Gateway, Lambda, S3, DynamoDB, optional API-key enforcement, and a CloudWatch dashboard. Full deployment steps are in `docs/aws-lambda-demo-runbook.md`, and the current infrastructure map is in `docs/aws-infrastructure-design.md`.

After deployment, set the frontend environment variable to the stack output URL:

```bash
PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
```

For Live AWS mode, set the protected API key on the server only:

```bash
PILLARPREP_BACKEND_API_KEY=...
```

When `PILLARPREP_BACKEND_URL` is absent, or when the UI is in Demo mode, the app uses the local demo generator. Live AWS mode forwards through the server route with the private API key.

The backend stack outputs `DashboardUrl` for the CloudWatch operations view. Live Bedrock responses also include metadata with `artifactKey`, `projectId`, and `stateKey` so the UI can show where the project artifact was saved.

The Lambda reference writes generated output to S3 and DynamoDB when these environment variables are present:

```bash
ARTIFACT_BUCKET=...
PROJECT_TABLE=...
```

For production, scope Bedrock IAM permissions to the selected model ARN and add alarms, guardrails, and stronger auth before public sharing.

Optional Strands reference:

```text
backend/bedrock_lambda/strands_agent.py
```

## Local Development

```bash
npm install
npm run dev
npm test
npm run eval:briefs
```

The local app works without AWS credentials because `/api/brief` currently uses the demo provider. Swap the API implementation to the Bedrock Lambda once the AWS sandbox is ready.

The browser also stores the current workspace locally so the demo can survive refreshes. Use `Reset workspace` in the UI when you want to return to the default scenario.
