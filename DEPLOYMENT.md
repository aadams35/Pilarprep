# PilarPrep Deployment

This is the concise deployment entry point. The detailed console-oriented guide is in `docs/deployment-guide.md`.

## Prerequisites

- AWS CLI v2
- AWS SAM CLI
- Node.js 22+
- Python 3.12+
- An assumed deployment role; never use account root credentials
- Bedrock model access in `us-east-1`

## 1. Authenticate

```powershell
aws sts get-caller-identity --profile pillarprep-deployer
$env:AWS_PROFILE = "pillarprep-deployer"
```

Confirm the returned ARN is an assumed role and not `:root`.

## 2. Install and verify

```powershell
npm ci
npm run lint
npm test
npm run pipeline:test
npm run agentcore:test
npm run lambda:test
npm run test:e2e
```

## 3. Deploy core resources

```powershell
.\scripts\deploy-aws-backend.ps1 -Region us-east-1
```

This creates the shared artifact bucket, DynamoDB table, Cognito demo identity path, Bedrock Guardrail, and core IAM resources.

## 4. Deploy the unified jobs pipeline

```powershell
.\scripts\deploy-jobs-pipeline.ps1 `
  -Region us-east-1 `
  -Profile pillarprep-deployer
```

This deploys API Gateway, SQS and DLQ, the Jobs API Lambda, unified worker, Knowledge Base resources, meeting evidence, alarms, and dashboards.

## 5. Deploy AgentCore

```powershell
.\scripts\deploy-agentcore.ps1 `
  -Region us-east-1 `
  -Profile pillarprep-deployer
```

## 6. Publish the frontend

```powershell
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
```

The script builds from `frontend/`, uploads immutable assets to private S3, publishes `index.html` without caching, and invalidates CloudFront.

## 7. Smoke test

```powershell
npm run smoke:pipeline
npm run smoke:meeting
```

## Rollback

CloudFormation stacks remain separate rollback boundaries. Preserve the previous CloudFront bundle and stack versions until live smoke tests pass. Do not delete the shared S3 bucket or DynamoDB table during application rollback.
