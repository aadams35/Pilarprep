# AWS Lambda Demo Runbook

Use this path when the team is ready to run PillarPrep on AWS Lambda. The public CloudFront frontend can stay demo-only while live Bedrock mode runs through the local/server-backed route.

## Local Demo First

```bash
npm install
npm run verify:demo
npm run start -- --host 127.0.0.1 --port 3002
```

Open:

```text
http://127.0.0.1:3002/
```

The app works without AWS credentials when `PILLARPREP_BACKEND_URL` is empty.

## Lambda Smoke Test Without AWS

```bash
npm run lambda:test
```

This mocks Bedrock and verifies that the Lambda handler accepts API Gateway events, including base64 bodies, validates malformed input, and returns structured project artifacts.

## AWS Sandbox Setup

If `aws sts get-caller-identity` says credentials are missing, run your normal AWS sign-in first. On this machine the AWS CLI is installed, but credentials were not active during the last check.

1. Confirm the AWS account has Amazon Bedrock model access enabled for the selected model.
2. Confirm local AWS credentials are active.
3. Deploy the backend with the AWS CLI script. This packages and deploys API Gateway, Lambda, S3, DynamoDB, API-key enforcement, and a CloudWatch dashboard through CloudFormation.

```bash
.\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin http://127.0.0.1:3002
```

Optional parameters:

```text
-StackName pillarprep-bedrock
-Region us-east-1
-AllowedOrigin http://127.0.0.1:3002
-BedrockModelId us.amazon.nova-micro-v1:0
-PillarPrepApiKey <private-demo-key>
-ResourcePrefix pillarprep-demo
-ProjectName PillarPrep
-EnvironmentName demo
-Owner austin-adams
-CostCenter hackathon
```

The deploy script applies the shared tag standard to the CloudFormation stack and to the packaging bucket. The application resources receive matching tags from the SAM template. See `docs/aws-resource-tags-and-names.md` for the full naming and tagging standard.

The low-cost demo path uses `us.amazon.nova-micro-v1:0`. Anthropic Sonnet profiles were visible in the account, but Lambda calls required the Anthropic use-case details form before they could be used reliably.

## Low-Cost Demo Guardrails

Use `us.amazon.nova-micro-v1:0` for the default demo. Bedrock is on-demand, so model cost is token-based instead of hourly. Keep the public CloudFront bundle demo-only, keep the API key server-side, and avoid automated repeated calls. Add AWS Budgets or CloudWatch billing alarms before opening AI model mode beyond the hackathon team.
## Connect Frontend To Lambda

After the script deploys, copy the `BriefApiUrl` output into local env:

```text
PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
PILLARPREP_BACKEND_API_KEY=<private-demo-key>
```

Restart the local app. If `PILLARPREP_BACKEND_URL` is configured, the UI selects `AI model` mode by default. Generate a brief and confirm the provider badge says `bedrock provider`. The UI should also show the S3 artifact key, DynamoDB state key, Bedrock model ID, token count, and latency after a live generation.

## Demo Fallback Plan

If Bedrock access or AWS credentials are not ready, leave `PILLARPREP_BACKEND_URL` blank. The local demo provider still exercises the full workflow: pre-brief refinement, stakeholder lens, Project Brain ask loop, two-week plan, risk register, stakeholder map, and follow-up email artifact.

## CloudWatch Dashboard

The backend stack outputs a `DashboardUrl`. Use it during the demo to show real AWS operations: request count, success count, unauthorized requests, Lambda duration/errors, API Gateway counts, and recent Lambda logs.
