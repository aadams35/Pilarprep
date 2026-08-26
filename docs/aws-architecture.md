# AWS Architecture

The current source of truth is
[PilarPrep Unified Jobs Architecture](unified-jobs-architecture.md).

PilarPrep now uses one public application path:

```text
React on CloudFront/private S3
  -> Cognito temporary credentials + SigV4
  -> one IAM-authorized Jobs HTTP API
  -> one Jobs API Lambda
  -> one SQS queue with a DLQ
  -> one unified AI worker
  -> Bedrock for brief generation/refinement
  -> AgentCore for handoff/catch-up
  -> one DynamoDB table and one private artifact bucket
```

The earlier Brief and Agent APIs remain deployed only as a rollback path. Their
URLs are omitted from the production frontend bundle and they are not part of
the active customer workflow.
