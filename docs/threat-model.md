# Threat Model

## Assets

- Customer and stakeholder context
- Approved briefing and handoff artifacts
- Project decisions, risks, actions, and ownership state
- Uploaded evidence and vectors
- Meeting transcript and proposed changes
- Cognito tokens and temporary AWS credentials
- Scope-signing and CloudFront origin secrets
- Model quota and cost budget
- Audit and approval history

## Trust boundaries

- Browser to CloudFront/API Gateway
- API Gateway authorizer to Jobs API
- Jobs API to S3/DynamoDB/SQS
- SQS to unified worker
- Worker to Bedrock/AgentCore/Transcribe
- AgentCore to Gateway/tool Lambda
- Knowledge Base retrieval to model prompt
- Human review to authoritative approval

## Threats and controls

| Threat | Control | Residual risk |
| --- | --- | --- |
| Guest changes session ID to evade limits | Quotas keyed to Cognito identity/user/tenant | New anonymous identities can still be created; WAF and aggregate limits needed |
| User requests another tenant/client | Trusted claim derivation, assignment checks, scoped keys, generic 403 | Incorrect admin claims could authorize excess access |
| Job ID enumeration | Scope included in DynamoDB key and polling checks | Job IDs remain visible to their owner |
| Direct frontend S3 access | Public block, bucket policy, CloudFront OAC | Misconfigured future bucket policy |
| Direct workspace API bypass | JWT plus CloudFront origin secret | Guest IAM routes intentionally use direct API Gateway |
| Browser selects expensive model | Server allowlist, routing policy, premium group, Claude quota | Compromised premium user can consume its quota |
| Duplicate SQS delivery | Job lease, idempotency, immutable keys, conditional transactions | External non-idempotent integrations must follow same rule |
| Poison message replay loop | Receive/replay/total limits, operator gate, quarantine | Manual operator misclassification |
| Model contradicts corrected fact | Full target regeneration, fact hierarchy, contradiction validator, one repair | Novel contradictions outside deterministic rules |
| Model changes wrong tab | Backend target merge and deep equality for non-target tabs | Schema evolution must update isolation tests |
| Prompt injection in evidence | Metadata authorization, untrusted-evidence label, allowed source labels, post-check | Indirect semantic manipulation may still influence tone |
| RAG leaks another tenant | Exact filter plus post-retrieval rejection and alarm | Service/metadata defect; required zero in tests |
| Draft silently becomes project truth | Human approval, expected versions, immutable audit | Reviewer error |
| Stale brief used for handoff | Current approval/version comparison | Concurrent UI may require reload |
| Presigned URL disclosed | Short expiry, HTTPS, no logging | Recipient can share until expiry |
| Secret exposed in build | Secrets only in CloudFront/Lambda configuration | Deployment logs must remain protected |
| Raw customer content in logs | Safe structured telemetry and tenant hash | Library exceptions may include unexpected text; monitor |
| KMS key unavailable | Retained key, exact role permissions, alarms/runbook | Regional KMS outage or accidental policy change |
| Denial of service | WAF rate rule, API throttling, quotas, SQS buffering | Distributed identities/IPs and long model latency |
| Excess spend | Quotas, model routing, estimated cost alarm, Budget, kill switch | Budgets are not hard caps |
| Legacy API bypass | Frontend references removed; IAM remains bounded for rollback | Deployed legacy surface persists until retirement |

## STRIDE summary

- Spoofing: Cognito verification, JWT issuer/audience, IAM SigV4, PKCE.
- Tampering: KMS, TLS, immutable keys, hashes, conditional writes.
- Repudiation: approver/source/model/prompt/input/version audit and replay audit.
- Information disclosure: private S3, scoped keys, metadata filters, generic failures.
- Denial of service: WAF, throttles, quotas, queue, concurrency, kill switch.
- Elevation of privilege: trusted groups, route authorization, least-privilege roles,
  expiring scope tokens, tool revalidation.

## Abuse cases to test live

1. Two guest identities use custom-demo and attempt to exchange job IDs.
2. Workspace JWT changes browser tenantId/clientId.
3. Direct execute-api workspace call omits origin secret.
4. Unsigned guest API call.
5. Guest requests Claude and premium quality.
6. Session/localStorage reset after exhausting quota.
7. Uploaded document tells the agent to ignore scope and reveal another client.
8. Retrieval service returns a deliberately mismatched metadata object.
9. Duplicate delivery of approval, meeting approval, and handoff.
10. Poison DLQ message is replayed beyond the configured limit.

## Risk acceptance

The public demo accepts anonymous identity creation and synthetic-output abuse within
strict limits. It does not accept real customer data, shared guest partitions,
cross-tenant retrieval, silent fallback, unbounded replay, or model output becoming
authoritative without human approval.
