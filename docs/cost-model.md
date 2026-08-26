# Cost Model and Controls

Pricing changes. Check the official AWS pricing pages and the Pricing Calculator
before publishing numeric estimates. This document explains the cost shape without
inventing current prices.

## Cost shape

| Service | Cost type | Primary driver |
| --- | --- | --- |
| CloudFront | Usage-based, with plan/free-tier considerations | Requests and data transfer |
| AWS WAF | Web ACL/rule/request charges | Rule count and inspected requests |
| S3 | Usage-based | Stored bytes, versions, requests, transfer |
| API Gateway HTTP API | Usage-based | API requests |
| Lambda | Usage-based | Invocations, memory, duration |
| SQS | Usage-based | Requests and payload chunks |
| DynamoDB on-demand | Usage-based | Reads, writes, storage, backups |
| Bedrock | Usage-based | Input/output tokens by model |
| Bedrock Knowledge Bases | Usage-based | Ingestion, embeddings, retrieval |
| S3 Vectors | Usage-based | Vector storage and query operations |
| AgentCore | Usage-based | Runtime, memory, gateway/tool consumption |
| Transcribe | Usage-based | Audio minutes and optional features |
| KMS | Small fixed plus usage when CMK enabled | Key and API operations |
| Secrets Manager | Small fixed plus usage | Secret count and reads |
| CloudWatch/X-Ray | Usage-based | Logs, metrics, alarms, traces |
| SNS | Usage-based | Notifications |
| Cognito | Usage-based/free-tier dependent | Active users and authentication events |
| AWS Budgets | Budget/action pricing rules | Budget count and notifications |

There is no always-on model endpoint, database capacity, EC2 host, ECS service, NAT
Gateway, or provisioned vector cluster.

## Model routing policy

- Nova Micro: concise, low-risk catch-up by default.
- Nova Pro: standard generation and refinement.
- Claude Sonnet 4.6: verified premium users and premium/difficult actions only.
- AgentCore: handoff/catch-up orchestration and governed tools, not every brief tab.

The API overrides unsupported or unauthorized browser model requests. One structured
model call is preferred over premium section-by-section calls.

## Server cost controls

- Guest hourly and daily identity limits
- Authenticated user and tenant daily limits
- Separate Claude daily limit
- Atomic conditional DynamoDB counters with TTL
- Model allowlists by identity mode
- Trusted premium group requirement
- Emergency generation kill switch
- API and WAF rate limits
- SQS maximum concurrency
- Bounded model repair attempt
- Seven-day guest artifact retention
- One-day job payload and two-day transcript retention
- Seven-day AgentCore Memory
- Fourteen-day logs
- Estimated token/cost metadata and CloudWatch alarm
- AWS Budget alerts

Session ID, localStorage reset, and private browsing do not reset server quotas.

## Per-action estimate method

For a model action:

~~~text
estimated cost =
  (input tokens / 1,000,000 * current input price)
+ (output tokens / 1,000,000 * current output price)
+ supporting request/storage/retrieval costs
~~~

PilarPrep records inputTokens, outputTokens, model ID, latency, and
estimatedModelCostUsd. The code estimate is an operational signal, not an invoice.
Update pricing constants and re-run evaluation before interviews or public cost claims.

For meeting processing, include Transcribe audio minutes, embeddings/retrieval, and
AgentCore execution. For evidence ingestion, include embedding and vector operations.

## Demo cost posture

A low-traffic portfolio demo can remain inexpensive because all expensive components
are request driven and quotas are strict. The largest variable is model output tokens,
especially premium Claude packets. KMS, Secrets Manager, WAF, alarms, and retained
artifacts can create small non-zero baseline costs even with no generation.

To target approximately one dollar per day:

1. Keep guest scenarios synthetic and bounded.
2. Route standard work to Nova Pro and short catch-up to Micro.
3. Reserve Claude for a small verified premium quota.
4. Keep generation disabled outside interview/demo windows if traffic is unknown.
5. Confirm the SNS budget subscription and estimated-spend alarm.
6. Review Cost Explorer by Project, Environment, and CostCenter tags.
7. Delete temporary evidence and disable unused retained rollback resources only
   through an approved change.

## Cost claim for interviews

Use: "The design is request-driven and has no always-on model or compute fleet. We
control model access by identity, action, tier, token usage, and daily quotas, and we
can stop generation centrally. Exact per-run and daily cost is measured from live
token telemetry and validated against current AWS pricing."
