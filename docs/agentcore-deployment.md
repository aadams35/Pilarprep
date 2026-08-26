# AgentCore Deployment and Rollback

> **Rollback-only direct-path runbook.** AgentCore is deployed and the active
> browser path reaches it through the unified Jobs API, SQS, and AI worker.
> Direct Agent API instructions below are retained only for rollback review.

## Prerequisites

- AWS CLI authenticated to the intended account in `us-east-1` through an IAM deployment role or SSO session; all deploy scripts refuse account-root credentials
- Python 3 with `venv` and `pip`; the deployment script bootstraps pinned `uv` 0.11.32 into the ignored `work` cache for reproducible ARM64 packaging
- Bedrock access for `us.amazon.nova-pro-v1:0` and `us.amazon.nova-micro-v1:0`
- AgentCore Runtime, Memory, Gateway, and CloudFormation resource types available in the account and Region
- Existing `pillarprep-bedrock` and `pillarprep-frontend` stacks
- The exact CloudFront origin passed as `AllowedOrigin`; do not use `*` outside a temporary demo

Verify identity first, and confirm the returned ARN does not end in `:root`:

```powershell
aws sts get-caller-identity
```

## Review gate

Run this from the repository root before any deployment:

```powershell
npm.cmd run verify:demo
npm.cmd run lint
aws cloudformation validate-template --template-body file://backend/bedrock_lambda/template.yaml --region us-east-1
aws cloudformation validate-template --template-body file://backend/agentcore/template.yaml --region us-east-1
```

Expected result: all checks pass and `git diff --check` reports no whitespace errors. Review the IAM policies, demo identity scope, `AllowLegacyDemoBrief`, and the generated CloudFormation change sets before execution.

## Deployment order

1. Update the existing backend. This preserves `POST /brief` and exposes the artifact bucket, table, demo role, fallback Lambda ARN, and Guardrail outputs required by AgentCore.

```powershell
.\scripts\deploy-aws-backend.ps1 `
  -Region us-east-1 `
  -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net `
  -PillarPrepApiKey "" `
  -DailyBudgetLimitUsd 1
```

2. Deploy the isolated AgentCore stack.

```powershell
.\scripts\deploy-agentcore.ps1 `
  -Region us-east-1 `
  -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net `
  -DemoAllowedClientIds bluemesa-payments `
  -DemoLegacyClientId bluemesa-payments `
  -BedrockModelId us.amazon.nova-pro-v1:0 `
  -BedrockAlternateModelId us.amazon.nova-micro-v1:0
```

The script packages an ARM64 Python 3.12 direct-code artifact plus a pinned Boto3 Lambda layer, reuses the private S3 artifact bucket and DynamoDB table, imports the existing Guardrail ID/version, and deploys a separate `pillarprep-agentcore` stack. Pinning the Lambda SDK prevents Router and Gateway tool behavior from depending on the runtime-bundled Boto3 version.

3. Publish the static frontend so the AgentCore API output is compiled into the CloudFront build.

```powershell
.\scripts\deploy-aws-frontend.ps1 `
  -Region us-east-1 `
  -AgentStackName pillarprep-agentcore
```

4. Run live smoke checks and the BlueMesa rehearsal in `docs/agentcore-demo-runbook.md`.

## Model selection

Nova Pro is the default for final handoff quality. Nova Micro remains selectable in the UI and request contract for low-cost rehearsals. Both inference profile IDs and foundation model ARN segments are CloudFormation and script parameters, so a future model change does not require changing agent logic.

## Rollback

The fastest rollback leaves all approved briefs and project state intact and removes AgentCore from the browser path:

```powershell
.\scripts\deploy-aws-frontend.ps1 `
  -Region us-east-1 `
  -DisableAgentCore
```

That build omits `VITE_PILLARPREP_AGENT_URL`; handoff and catch-up use the existing Lambda path. Once the frontend is verified, the isolated stack can be removed without touching the base backend:

```powershell
aws cloudformation delete-stack --stack-name pillarprep-agentcore --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name pillarprep-agentcore --region us-east-1
```

Do not delete `pillarprep-bedrock` or its private artifact bucket during an AgentCore rollback.

## Production transition

- Replace the unauthenticated Cognito demo identity with Cognito User Pools, IAM Identity Center, or enterprise OIDC/SAML.
- Issue tenant/client/project claims from an authoritative entitlement service.
- Change `AllowLegacyDemoBrief` to `false` after Loop 1 writes tenant-scoped brief keys; this removes the conditional legacy-object IAM statement.
- Restrict CORS to the final CloudFront/custom domain and add WAF/rate controls before broad public sharing.
- Connect alarms to SNS or the team's incident channel.
- Rotate the scope-signing secret and establish a normal secrets rotation procedure.

## Cost controls

AgentCore Runtime, Gateway, and Memory are consumption priced with no always-on server in this design. Current AWS rates and details are published on the [AgentCore pricing page](https://aws.amazon.com/bedrock/agentcore/pricing/), while model token rates are on the [Amazon Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/).

For the hackathon:

- Use Nova Micro for repeated rehearsals and Nova Pro only for the final quality run.
- Keep Memory event expiry at seven days.
- Keep DynamoDB on demand and Lambda/Runtime invocation driven.
- Keep 14-day log retention and avoid verbose customer payload logging.
- Do not add a VPC/NAT Gateway, provisioned model throughput, scheduled jobs, Browser, or Code Interpreter.
- Treat `$1/day` as a monitored target, not a guaranteed cap. Model input/output tokens and Guardrail text units are the main variable costs.
- Delete or disable the AgentCore stack after the event if it is not being actively evaluated.

At the published Nova rates, a representative 20,000-input/5,000-output-token Nova Pro call is roughly three cents for model inference before Guardrails and supporting services. The same token shape on Nova Micro is well below one cent. Recheck pricing immediately before the demo because AWS rates can change.
