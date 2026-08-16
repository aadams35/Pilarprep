# PilarPrep

PilarPrep is an AWS-focused SA briefing generator for hackathon demos.

The app has two loops:

1. Pre-brief refinement: generate, review, refine, and approve a customer-ready SA brief.
2. Follow-on project model: automatically turn the final brief, decision-maker context, and meeting notes into a Project model for sales, executives, PMs, engineers, and new project members.

Live demos:

- AWS CloudFront static frontend: pilarprep.app

## Current Shape

- Frontend: React, Next-compatible Vinext app plus a static Vite build for AWS hosting
- Hosted demo: private S3 static assets behind CloudFront
- AWS auth: API Gateway IAM auth with short-lived Cognito Identity demo credentials, no API key in the browser
- Backend: API Gateway HTTP API, Lambda, Amazon Bedrock, Bedrock Guardrails, S3 artifacts, DynamoDB project state
- Demo provider: deterministic local generator in `lib/pillarprep/generator.ts`
- Decision-maker context: manual/customer-approved profile notes, not automated LinkedIn scraping
- Working Project model loop: role-based follow-on answers plus generated handoff artifacts
- Local workspace persistence: browser saves the current demo workspace until reset
- Prompt contract: `docs/prompt-contract.md`
- Architecture notes: `docs/aws-infrastructure-design.md`
- Demo architecture slide: `docs/pilarprep-architecture-slide.pptx`
- AWS Lambda demo runbook: `docs/aws-lambda-demo-runbook.md`
- Demo script: `docs/demo-script.md`
- Demo-day checklist: `docs/demo-day-readiness-checklist.md`
- Judge walkthrough: `docs/judge-walkthrough.md`
- Presentation talk track: `docs/presentation-talk-track.md`
- Project model tools: `docs/project-model-tools.md`
- Brief quality eval: `npm run eval:briefs`

## Why Bedrock First

Amazon Bedrock is the core v1 choice because PilarPrep needs managed generation, role-aware refinement, guardrails, and a Knowledge Bases path for the Project model. It avoids custom model hosting while keeping the architecture AWS-native. The demo default is Amazon Nova Micro through Bedrock so there is no always-on model server cost.

Recommended production path:

```text
React app
  -> CloudFront + S3
  -> Cognito Identity demo role
  -> API Gateway IAM auth
  -> Lambda
  -> Amazon Bedrock
  -> S3 approved brief artifacts
  -> DynamoDB project state
  -> Bedrock Knowledge Bases
  -> Project model answers
```

## Where Strands Fits

Strands is the optional agent layer for Phase 2. Use it when the Project model needs tool use, multi-step project workflows, role-aware implementation planning, or retrieval-backed follow-up actions.

Recommended split:

- Bedrock: brief generation, refinement, structured outputs, guardrails
- Strands: follow-on agent orchestration for the Project model
- SageMaker: out of scope for v1 unless the team decides to train, fine-tune, or host custom models

## API Contract

`POST /api/brief` locally or `POST /brief` through API Gateway.

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
  "provider": "bedrock",
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
  "citations": [],
  "metadata": {
    "modelId": "us.amazon.nova-micro-v1:0",
    "artifactKey": "clients/apex-mutual/brief/latest.json",
    "docxArtifactKey": "clients/apex-mutual/brief/latest.docx",
    "artifactRetention": "latest-only",
    "projectId": "...",
    "clientId": "...",
    "stateKey": "..."
  }
}
```

## Model And Memory Storage

PilarPrep does not store or host the foundation model. Amazon Bedrock manages the Amazon Nova Micro model and PilarPrep invokes it on demand through Lambda.

What PilarPrep stores:

- Prompt contract and fallback rules: versioned in the Lambda code and GitHub repo.
- Generated brief artifacts: one latest JSON packet and one latest DOCX packet per project in S3.
- Project state index: projectId, sortKey, company, meeting type, provider, and createdAt in DynamoDB.
- Browser workspace: local draft state only, stored in the user's browser until reset.

Future Project model memory should use Bedrock Knowledge Bases over approved S3 artifacts and meeting notes. That is retrieval over project documents, not fine-tuning or custom model training.

## Cost Posture

The demo uses Amazon Bedrock on-demand inference with Amazon Nova Micro, so there is no always-on model endpoint. The backend stack also creates a daily AWS Budget guardrail, defaulting to `$1/day`. Normal hackathon demo usage should stay well under that as long as there are no automated refresh loops or public load tests.

Avoid Provisioned Throughput, Nova Act, batch jobs, broad unauthenticated model access, or scheduled model calls until stronger quotas and alarms are added.

## AWS Frontend

The AWS-hosted frontend uses a static Vite build of the existing React UI. It is deployed to a private S3 bucket behind CloudFront. The browser can call the live model path without an API key by getting short-lived credentials from the Cognito Identity Pool demo role and SigV4-signing the API Gateway request.

```bash
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
```

Current AWS frontend URL:

```text
https://d2e0btay0ynyf.cloudfront.net
```

Static frontend infrastructure lives in `backend/frontend_static/template.yaml`. Resource naming and tagging standard: `docs/aws-resource-tags-and-names.md`.

## AWS Backend

The Lambda reference lives in `backend/bedrock_lambda/app.py`.

The CloudFormation/SAM-compatible template lives in `backend/bedrock_lambda/template.yaml`.

Deploy the backend first so the frontend deploy script can discover the API URL and Cognito Identity Pool ID:

```bash
.\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net -PillarPrepApiKey "" -DailyBudgetLimitUsd 1
```

That script packages and deploys API Gateway, Lambda, Bedrock Guardrails, S3, DynamoDB, IAM controls, a Cognito Identity Pool demo role, a daily AWS Budget, CloudWatch alarms, and a CloudWatch dashboard. Full deployment steps are in `docs/aws-lambda-demo-runbook.md`, the IAM control summary is in `docs/aws-iam-controls.md`, and the current infrastructure map is in `docs/aws-infrastructure-design.md`.

The backend stack outputs `BriefApiUrl`, `DemoIdentityPoolId`, `DashboardUrl`, `ArtifactBucketName`, and `ProjectStateTableName`. Live Bedrock responses include metadata with `artifactKey`, `docxArtifactKey`, `projectId`, and `stateKey` so the UI can show where the latest project packet was saved.

For local no-key model testing, use these non-secret values:

```bash
PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
PILLARPREP_BACKEND_AUTH_MODE=iam
PILLARPREP_COGNITO_IDENTITY_POOL_ID=us-east-1:example
VITE_PILLARPREP_STATIC_DEMO=true
VITE_PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
VITE_PILLARPREP_BACKEND_REGION=us-east-1
VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID=us-east-1:example
```

For production, replace the public unauthenticated demo identity with real user auth, keep API Gateway IAM authorization, route users into authorized client workspaces, connect CloudWatch alarms to notifications, and tighten model quotas before broader sharing.

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
npm run lambda:test
npm run smoke:aws
```

When the Cognito demo variables are present, AI model mode signs API Gateway requests with a limited IAM role. When backend settings are absent, the app falls back to the deterministic demo provider.

The browser also stores the current workspace locally so the demo can survive refreshes. Use `Reset workspace` in the UI when you want to return to the default scenario.
