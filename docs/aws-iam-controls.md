# PillarPrep IAM Controls

PillarPrep uses explicit IAM controls for the AWS model demo instead of relying on broad generated permissions.

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

## Demo Talking Point

This gives the hackathon demo a security lane: the app generates briefs with Bedrock, but the Lambda role is limited to the model, artifact bucket, project state table, logs, and tracing it needs for the workflow.