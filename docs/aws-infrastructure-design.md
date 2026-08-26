# PilarPrep AWS Infrastructure Design

> **Historical pre-cutover design.** The active application uses one Jobs API,
> one SQS queue, and one unified worker. Use
> [Portfolio Architecture](portfolio-architecture.md) for the hardened target.
> [Unified Jobs Architecture](unified-jobs-architecture.md) records the last
> verified live baseline. Legacy APIs below are retained only for rollback and
> are absent from the public frontend bundle.

This document summarizes the deployable stacks. The full request flow and security map are in [PilarPrep AgentCore Architecture](agentcore-architecture.md).

## Frontend stack

- Private, encrypted, versioned S3 static-asset bucket
- CloudFront distribution with HTTPS and Origin Access Control
- S3 bucket policy allowing only the CloudFront distribution
- Static React build configured with backend URLs at publish time

The S3 origin is not public. The CloudFront website is intentionally shareable for the hackathon.

## Brief backend stack

- API Gateway HTTP API with AWS IAM authorization on POST /brief
- Cognito Identity Pool and a narrowly scoped public demo role
- Python 3.12 request Lambda that validates, scopes, queues, and serves job status
- Python 3.12 asynchronous packet worker with a separate least-privilege IAM role
- DynamoDB job records with one-hour TTL and Cognito identity ownership checks
- Amazon Bedrock Nova Pro or Nova Micro
- Versioned Bedrock Guardrail
- Private S3 latest brief JSON and DOCX
- DynamoDB project-state and latest-record metadata
- CloudWatch logs, metrics, alarms, and dashboard
- Account-level daily AWS Budget warning

## AgentCore follow-on stack

- API Gateway HTTP API with AWS IAM authorization on POST /agent
- Router Lambda that derives identity, queues owner/session-bound jobs, and serves authenticated status polls
- 180-second worker Lambda that signs project scope, invokes Runtime, and owns fallback
- DynamoDB AgentCore job records with one-hour TTL and client/project/user/session isolation
- AgentCore Runtime with the Strands project agent
- AgentCore Memory with seven-day event expiry
- IAM-authenticated AgentCore Gateway with five Lambda-backed tools
- Tool Lambda with scoped S3, DynamoDB, Secrets Manager, logs, and X-Ray access
- Separate IAM roles and resource policies for router, worker, Runtime, Gateway, and tools
- CloudWatch dashboard and error alarms

The AgentCore stack reuses the existing private artifact bucket, DynamoDB table, Guardrail, demo role, and brief Lambda. It does not replace Loop 1.

## Client and tenant model

For the public demo, Cognito issues short-lived credentials to a role that can invoke only the two PilarPrep API routes. The AgentCore router allows that identity to select only BlueMesa Payments.

For a pilot, replace the public identity with Cognito User Pools or enterprise federation. Authenticated claims must identify the tenant and list authorized clients/projects. Users log into a client workspace; they do not log into a separate model.

Every AgentCore data operation is partitioned by tenant, client, and project. DynamoDB is authoritative, S3 keeps only current artifacts, AgentCore Memory provides conversation continuity, and Bedrock performs inference without storing a per-customer model.

## Deployment boundary

The stacks deploy independently:

1. pillarprep-bedrock
2. pillarprep-agentcore
3. pillarprep-frontend

This order preserves the existing brief path and makes AgentCore rollback a frontend configuration change plus deletion of only the isolated AgentCore stack. See [AgentCore Deployment and Rollback](agentcore-deployment.md).
