# PillarPrep IAM Controls

PillarPrep uses explicit IAM controls for the AWS model demo instead of relying on broad generated permissions or a browser API key.

## Public Demo Auth Boundary

The CloudFront demo can be public, but the model API is not open. The browser receives short-lived credentials from a Cognito Identity Pool unauthenticated identity and assumes `DemoInvokeRole`.

That role can only do one thing:

```text
execute-api:Invoke on arn:aws:execute-api:<region>:<account>:<api-id>/*/POST/brief
```

The demo browser role has no direct permission for:

- Amazon Bedrock
- S3 brief artifacts
- DynamoDB project state
- CloudWatch Logs
- IAM changes

API Gateway uses IAM authorization, so unsigned requests fail with `403 Forbidden`.

## Lambda Execution Role

The backend stack creates `BriefFunctionRole` and attaches it directly to the Lambda function. The role trust policy allows only `lambda.amazonaws.com` to assume it.

Allowed actions are split into small inline policies:

- CloudWatch Logs: create streams and write events only for the PillarPrep Lambda log group.
- AWS X-Ray: publish trace segments and telemetry for active Lambda tracing.
- Amazon Bedrock: invoke the configured model path using the selected foundation model and inference profile ARNs.
- Amazon S3: read and write objects only in the brief artifact bucket.
- Amazon DynamoDB: read, write, query, and update only the project state table.

The template also creates the Lambda log group with 14-day retention so logging does not require broad log-group creation rights during normal execution.

## Optional Permissions Boundary

Use `PermissionsBoundaryArn` when the AWS sandbox has an account-level boundary policy for hackathon workloads:

```powershell
.\scripts\deploy-aws-backend.ps1 `
  -Region us-east-1 `
  -PermissionsBoundaryArn arn:aws:iam::<account-id>:policy/<boundary-policy-name>
```

If the parameter is empty, CloudFormation omits the boundary.

## Model Scope

The default Bedrock settings are:

```text
BedrockModelId=us.amazon.nova-micro-v1:0
BedrockFoundationModelId=amazon.nova-micro-v1:0
```

`BedrockModelId` is the model identifier passed to Bedrock at runtime. `BedrockFoundationModelId` is used in IAM so the role has permission to invoke the underlying foundation model associated with the inference profile.

## Cost Guardrail

The backend stack creates `DemoDailyBudget`, defaulting to `$1/day`. Add `-BudgetNotificationEmail <email>` during deploy if you want AWS Budget threshold emails at 80 percent and 100 percent actual spend.

## Demo Talking Point

The public URL is shareable for the hackathon because public users receive only a narrow, temporary IAM identity that can invoke one API route. Bedrock, S3, DynamoDB, and logs stay behind Lambda's server-side role.