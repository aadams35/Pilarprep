# PilarPrep Infrastructure

PilarPrep uses multiple CloudFormation stacks with templates co-located beside their deployable service code. This keeps code, IAM permissions, alarms, and environment variables reviewable as one unit.

## Stack inventory

| Deployment order | Stack | Template | Purpose |
| --- | --- | --- | --- |
| 1 | `pillarprep-deployment-role` | `backend/deployment_role/template.yaml` | Least-privilege deployment role |
| 2 | `pillarprep-bedrock` | `backend/bedrock_lambda/template.yaml` | Shared Cognito, S3, DynamoDB, Guardrail, and compatibility resources |
| 3 | `pillarprep-jobs` | `backend/jobs_pipeline/template.yaml` | Unified API, SQS, worker, RAG, meeting evidence, and observability |
| 4 | `pillarprep-agentcore` | `backend/agentcore/template.yaml` | Runtime, memory, gateway, tools, and governed handoff |
| 5 | `pillarprep-frontend` | `backend/frontend_static/template.yaml` | Private S3, CloudFront, OAC, headers, and API origin |

## Deployment

Use the commands in `../DEPLOYMENT.md`. Deployment scripts validate credentials, preserve existing stack integration, and print CloudFormation outputs.

## Design rules

- HTTPS-only public access
- Private S3 origins and public-access blocks
- One DynamoDB table for scoped project and job records
- One main SQS queue plus one DLQ
- Large payloads in S3; queue messages carry pointers
- Conditional writes for idempotency and version control
- Least-privilege browser, worker, AgentCore, and deployment roles
- Consistent project, environment, owner, cost-center, and data-classification tags
