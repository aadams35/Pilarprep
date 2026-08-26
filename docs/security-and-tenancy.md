# Security and Tenancy Model

Status: implemented in repository and locally verified. Live AWS verification is
required before production-readiness claims.

## Security goals

- Public visitors can use only approved synthetic demo scenarios.
- Two visitors using the same customer label receive different guest tenants.
- Verified users are isolated by trusted Cognito subject or assigned tenant claim.
- Browser-supplied tenant, owner, model tier, and authorization fields are never
  treated as authority.
- Bedrock, S3, DynamoDB, Knowledge Bases, AgentCore, and Secrets Manager remain
  server-side.
- Approval, evidence, and project-state writes are scoped, versioned, and auditable.

## Access modes

| Mode | Identity | API authorization | Effective tenant | Data policy |
| --- | --- | --- | --- | --- |
| Guest demo | Cognito Identity Pool identity | IAM/SigV4 | SHA-256-derived guest tenant | Synthetic allowlist; custom output is identity-isolated and temporary |
| Workspace | Cognito User Pool verified user | JWT through CloudFront | custom tenant claim or subject-derived personal tenant | Assigned clients/projects inside that tenant |
| Operator | Workspace JWT plus PilarPrepOperators group | JWT, origin secret, group check | Operator identity | Bounded DLQ inspection/replay only |
| Premium | Workspace JWT plus PilarPrepPremium group | Same workspace routes | Same tenant boundary | Claude premium routing and stricter quota |

The application does not use browser API keys.

## Route authorization

| Route family | Authorizer | Additional checks |
| --- | --- | --- |
| /jobs, /clients, /artifacts | AWS_IAM | HTTPS, approved origin, guest identity scope, client allowlist, quotas |
| /workspace/jobs | Cognito JWT | CloudFront origin secret, tenant/client/project claims, user/tenant quotas |
| /workspace/evidence | Cognito JWT | Verified workspace, exact tenant/client/project metadata |
| /workspace/operations/dlq/replay | Cognito JWT | CloudFront origin secret and PilarPrepOperators group |

CloudFront strips the /api prefix before forwarding workspace calls and injects a
Secrets Manager-backed origin-verification header. Direct execute-api requests to
workspace routes lack that header and are rejected. Guest IAM routes remain direct
HTTPS API Gateway calls because SigV4 binds the request host; they are constrained
by IAM, API throttling, synthetic allowlists, and server-side quotas.

## Scope derivation

The Jobs API reads trusted authorizer context and derives:

- tenantId from custom:tenantId or a non-reversible hash of the verified subject.
- userId from the verified subject or Cognito identity.
- client assignments from custom:clientIds, with demo clients as the current
  portfolio fallback.
- project assignments from custom:projectIds when present.
- user tier from trusted Cognito groups.
- guest tenant from the stable Cognito identity, never from sessionId.

The effective storage boundary is:

~~~text
TENANT#{tenantId}|CLIENT#{clientId}|PROJECT#{projectId}
~~~

S3 uses the matching prefix:

~~~text
tenants/{tenantId}/clients/{clientId}/projects/{projectId}/
~~~

AgentCore receives an HMAC-signed ten-minute scope token. Every governed tool verifies
the token, expiration, and event fields before accessing data.

## Tenant-isolation enforcement points

- Job creation and polling
- Client directory and latest packet reads
- Artifact downloads
- Draft and immutable approval writes
- Selected-tab refinement
- Meeting proposal processing and approval
- Handoff and read-only catch-up
- AgentCore Memory session identifiers
- Gateway tool arguments
- Evidence upload, status, deletion, and re-index
- Knowledge Base metadata filters and post-retrieval checks
- Usage and idempotency records

Cross-scope requests return a non-revealing response and emit a safe metric. RAG
metadata mismatches are rejected even if the vector service returned them.

## Encryption and transport

- CloudFront redirects HTTP to HTTPS and uses TLS 1.2 or newer.
- S3 bucket policies deny insecure transport and block all public access.
- CloudFront reads frontend assets through Origin Access Control.
- API origins use HTTPS only.
- S3, SQS, DLQ, DynamoDB, meeting evidence, and AgentCore secrets accept the shared
  customer-managed KMS key when enabled.
- AgentCore handoff writes no longer override bucket KMS encryption with AES-256.
- Secrets and credentials are never included in frontend variables or logs.

## Application security controls

- Request-size, identifier, action, model, and schema validation
- Server-selected model routing and allowlists
- Atomic DynamoDB identity quotas and emergency generation kill switch
- SQS pointer-only payloads
- Conditional idempotency writes and optimistic version locks
- Bedrock Guardrails on model calls
- One focused repair attempt, then explicit failure
- Human approval before project-state mutation
- Immutable version-specific approved JSON and DOCX objects
- WAF IP rate blocking plus AWS managed reputation/common/bad-input rules
- Shield Standard on eligible CloudFront and Route 53 resources
- Structured logs containing hashes and identifiers needed for operations, not
  customer prose or raw tenant names

## Known security limitations

- The demo client-assignment fallback is appropriate only for synthetic portfolio data.
- Enterprise tenant provisioning and role assignment are not automated.
- Uploaded evidence is type/size constrained but does not yet have malware scanning.
- CloudTrail S3 data events are not enabled by default because they add variable cost.
- Managed WAF groups are initially count mode except the explicit rate rule.
- Legacy Brief and Agent APIs remain deployed for rollback until live replacement
  verification and an approved CloudFormation removal.
- There is no cross-region disaster recovery or customer-managed key per tenant.
