# AWS Lambda Demo Runbook

Use this path when the team wants the shareable PillarPrep demo to run on AWS without putting an API key in the browser.

## Local Demo First

```bash
npm install
npm run lambda:test
npm run dev -- --host localhost --port 3002
```

Open:

```text
http://localhost:3002/
```

The app can run without AWS by using the deterministic demo provider. When the non-secret Cognito demo values are present in `.env.local`, local live mode uses the same no-key IAM path as CloudFront.

## AWS Sandbox Setup

1. Confirm AWS CLI credentials are active.
2. Confirm Amazon Bedrock model access is enabled in `us-east-1` for `us.amazon.nova-micro-v1:0`.
3. Deploy the backend first.
4. Deploy the frontend second so it can discover the API URL and Cognito Identity Pool ID from the backend stack outputs.

## Deploy Backend

```bash
.\scripts\deploy-aws-backend.ps1 `
  -Region us-east-1 `
  -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net `
  -PillarPrepApiKey "" `
  -DailyBudgetLimitUsd 1
```

Optional parameters:

```text
-StackName pillarprep-bedrock
-BedrockModelId us.amazon.nova-micro-v1:0
-BedrockFoundationModelId amazon.nova-micro-v1:0
-PermissionsBoundaryArn <boundary-arn>
-BudgetNotificationEmail <email>
-ResourcePrefix pillarprep-demo
-ProjectName PillarPrep
-EnvironmentName demo
-Owner austin-adams
-CostCenter hackathon
```

The backend stack creates:

- API Gateway HTTP API with IAM authorization on `POST /brief`
- Lambda Bedrock generator
- S3 brief artifact bucket
- DynamoDB project state table
- Cognito Identity Pool with an unauthenticated demo role
- Least-privilege IAM roles and policies
- Daily AWS Budget guardrail, default `$1/day`
- CloudWatch dashboard

Current deployed outputs:

```text
BriefApiUrl=https://pzgejfvvpa.execute-api.us-east-1.amazonaws.com/brief
DemoIdentityPoolId=us-east-1:51a31152-80e4-453f-b17e-5077109376fa
DemoInvokeRoleName=pillarprep-demo-demo-api-invoke-role
DemoDailyBudgetName=pillarprep-demo-daily-demo-budget
```

## Deploy Frontend

```bash
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
```

The script builds the static React app with:

```text
VITE_PILLARPREP_STATIC_DEMO=true
VITE_PILLARPREP_BACKEND_URL=<BriefApiUrl>
VITE_PILLARPREP_BACKEND_REGION=us-east-1
VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID=<DemoIdentityPoolId>
```

Current frontend URL:

```text
https://d2e0btay0ynyf.cloudfront.net
```

## Smoke Tests

Unsigned API calls should fail:

```text
POST /brief without SigV4 -> 403 Forbidden
```

CloudFront browser calls should succeed because the browser receives short-lived Cognito credentials and SigV4-signs the API Gateway request.

CORS should allow CloudFront with signed AWS headers:

```text
Origin=https://d2e0btay0ynyf.cloudfront.net
Allowed headers=accept,authorization,content-type,x-amz-content-sha256,x-amz-date,x-amz-security-token
Allowed methods=OPTIONS,POST
```

A successful live brief should return:

```text
provider=bedrock
modelId=us.amazon.nova-micro-v1:0
artifactKey=<S3 key>
stateKey=<DynamoDB key>
```

## Low-Cost Demo Guardrails

Use `us.amazon.nova-micro-v1:0` for the demo. Bedrock is on-demand, so model cost is token-based instead of hourly. The backend creates a daily AWS Budget, and there are no scheduled model calls.

Keep the public Cognito demo role limited to `execute-api:Invoke` on the single brief route. Do not grant the browser role direct Bedrock, S3, or DynamoDB access.

## Demo Fallback Plan

If Bedrock access is interrupted, leave AI model mode off and use the deterministic demo provider. The UI still exercises the full workflow: pre-brief refinement, stakeholder lens, Project model follow-on loop, two-week plan, risk register, stakeholder map, and follow-up email artifact.

## CloudWatch Dashboard

The backend stack outputs a `DashboardUrl`. Use it during the demo to show request count, success count, unauthorized requests, Lambda duration/errors, API Gateway counts, and recent Lambda logs.
