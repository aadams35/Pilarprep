# Portfolio Deployment Guide

This guide deploys the hardened PilarPrep branch using AWS SAM/CloudFormation. It
does not delete rollback stacks.

## Prerequisites

- AWS CLI v2 and SAM CLI
- Node.js version from package.json
- Python 3.12-compatible tooling
- A least-privilege assumed deployment role, never root
- Bedrock model access in us-east-1
- An HTTPS domain/certificate if using pilarprep.app
- A confirmed SNS email if operations alerts should reach a mailbox

Confirm identity without printing credentials:

~~~powershell
aws sts get-caller-identity --profile pillarprep-deployer
~~~

Set the profile for scripts that inherit AWS_PROFILE:

~~~powershell
$env:AWS_PROFILE = "pillarprep-deployer"
~~~

## Local release gate

~~~powershell
npm ci
npm run lint
npm test
npm run lambda:test
npm run pipeline:test
npm run agentcore:test
npm run eval:briefs
sam validate --lint --template-file backend/bedrock_lambda/template.yaml
sam validate --lint --template-file backend/agentcore/template.yaml
sam validate --lint --template-file backend/jobs_pipeline/template.yaml
sam validate --lint --template-file backend/frontend_static/template.yaml
~~~

Run Playwright after starting the local application:

~~~powershell
npm run test:e2e
~~~

## Deployment order

### 1. Base data and Bedrock stack

~~~powershell
.\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin https://pilarprep.app
~~~

This creates or updates the private artifact bucket, one DynamoDB table, Cognito
Identity Pool, Bedrock Guardrail, optional retained KMS key, budget, and rollback
Brief resources.

### 2. Initial AgentCore stack

~~~powershell
.\scripts\deploy-agentcore.ps1 -Region us-east-1 -AllowedOrigin https://pilarprep.app
~~~

The script packages the Runtime, including runtime/evidence.py, and the governed
tool Lambda. It reuses the base stack KMS output when configured.

### 3. Unified Jobs and RAG stack

~~~powershell
.\scripts\deploy-jobs-pipeline.ps1 -Region us-east-1 -AllowedOrigin https://pilarprep.app
~~~

The script deploys the User Pool, Jobs API, SQS/DLQ, unified worker, meeting evidence,
S3 Vectors, Knowledge Base, alarms, and dashboard. Unless skipped, it prepares the
synthetic corpus and redeploys AgentCore with the exact worker role and Knowledge
Base authorization.

### 4. CloudFront frontend

~~~powershell
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
~~~

The script reads stack outputs, builds with HTTPS endpoints, uploads the static
bundle, updates the private S3/CloudFront/WAF stack, and invalidates CloudFront.

## Post-deployment verification

~~~powershell
npm run smoke:pipeline
npm run smoke:meeting
~~~

Then verify:

- pilarprep.app returns the current bundle over HTTPS
- HTTP redirects to HTTPS
- security headers and WAF are attached
- direct frontend S3 object access returns AccessDenied
- direct /workspace execute-api calls fail origin verification
- unsigned guest calls fail
- guest Blue Mesa generation and approval complete
- a second Cognito guest cannot poll or download the first guest job
- workspace login returns to the HTTPS callback
- workspace user cannot access another tenant/client
- quota records survive session/localStorage changes
- approved immutable JSON/DOCX keys and audit record exist
- evidence ingestion reaches AVAILABLE
- AgentCore retrieval returns only matching metadata
- a controlled transient failure reaches the DLQ and operator replay succeeds once
- all active stacks end in CREATE_COMPLETE or UPDATE_COMPLETE

Record command output, UTC timestamp, stack ID, CloudFront distribution ID, and
smoke trace IDs in the release evidence. Never record tokens, credentials, secret
values, signed URLs, or customer content.

## Rollback

1. Stop frontend cutover by restoring the prior CloudFront build.
2. Set the generation kill switch false if model behavior is unsafe.
3. Leave immutable approvals, DynamoDB, evidence, and queues intact.
4. Use CloudFormation change sets to revert the affected stack.
5. Keep legacy Brief and Agent stacks until the new path has an agreed observation
   period and zero legitimate legacy traffic.
6. Do not manually delete retained KMS keys, buckets, tables, or Knowledge Base data.

## Legacy removal gate

Removal is a separate approved change after:

- public bundle uses only current contracts
- live guest and workspace tests pass
- CloudWatch shows no required legacy API traffic
- shared generation implementation no longer depends on the rollback package
- logs needed for rollback are exported
- a destructive CloudFormation change set is reviewed
