# AWS Lambda Demo Runbook

Use this path when the team is ready to run PillarPrep on AWS Lambda. The public site does not need to be redeployed until you decide.

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
3. Deploy the backend with the AWS CLI script. This packages and deploys API Gateway, Lambda, S3, and DynamoDB through CloudFormation.

```bash
.\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin http://127.0.0.1:3002
```

Optional parameters:

```text
-StackName pillarprep-bedrock
-Region us-east-1
-AllowedOrigin http://127.0.0.1:3002
-BedrockModelId anthropic.claude-3-5-sonnet-20241022-v2:0
```

## Connect Frontend To Lambda

After the script deploys, copy the `BriefApiUrl` output into local env:

```text
PILLARPREP_BACKEND_URL=https://example.execute-api.us-east-1.amazonaws.com/brief
PILLARPREP_BACKEND_API_KEY=
```

Restart the local app, generate a brief, and confirm the provider badge says `bedrock provider`.

## Demo Fallback Plan

If Bedrock access or AWS credentials are not ready, leave `PILLARPREP_BACKEND_URL` blank. The local demo provider still exercises the full workflow: pre-brief refinement, stakeholder lens, Project Brain ask loop, two-week plan, risk register, stakeholder map, and follow-up email artifact.

