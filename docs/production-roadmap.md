# Production Roadmap

## Current score target

After local verification:

- Architecture: 8.5/10
- Demo readiness: 9/10
- Production readiness: 7/10

These are engineering estimates, not live evidence. Production readiness cannot move
higher until the current branch passes live identity, KMS, RAG, DLQ, and edge tests.

## Phase 0: live proof and rollback safety

- Deploy all stacks with a least-privilege role.
- Capture stack outputs and security smoke evidence.
- Prove two-identity guest isolation.
- Prove workspace JWT and client assignment isolation.
- Prove direct S3 and direct workspace API denial.
- Prove immutable approval history.
- Prove authorized RAG ingestion/retrieval and injection rejection.
- Prove bounded DLQ replay and poison quarantine.
- Confirm alarms reach an owned SNS subscription.
- Keep rollback stacks untouched.

Exit: all active stacks healthy and the public bundle uses the new contracts.

## Phase 1: identity administration

- Add enterprise SAML/OIDC federation through Cognito.
- Build administrator-controlled tenant/client/project assignment.
- Remove synthetic assignment fallback for production users.
- Require MFA for operators and privileged tiers.
- Add global sign-out/revocation on role changes.
- Add tenant onboarding/offboarding and legal-hold workflow.

Exit: no production authorization depends on demo defaults.

## Phase 2: data governance

- Add malware scanning and content-type verification for evidence.
- Add PII classification/redaction policies by tenant.
- Enable CloudTrail data events for sensitive buckets after cost review.
- Add per-tenant retention and deletion policy.
- Run DynamoDB PITR and S3 artifact restore drills.
- Consider per-tenant KMS keys for higher-isolation customers.
- Add evidence lineage and approval-revocation workflow.

Exit: documented data owner, retention, restore, export, and deletion controls.

## Phase 3: reliability and delivery

- Add CI/CD with signed artifacts, change sets, approvals, and automatic rollback.
- Define SLOs for job acceptance, completion, and retrieval.
- Load test API throttles, SQS concurrency, Lambda memory, and model latency.
- Add canary synthetic generation and retrieval.
- Add cross-region recovery design based on agreed RTO/RPO.
- Retire legacy APIs/workers through reviewed IaC once traffic is zero.

Exit: repeatable deployment and tested recovery objectives.

## Phase 4: GenAI quality

- Expand golden scenarios across industries and meeting types.
- Evaluate chunking, hybrid retrieval, reranking, and evidence freshness.
- Add human quality labels and regression thresholds in CI.
- Calibrate unsupported-claim and citation scoring.
- Tune server routing using measured quality/cost/latency.
- Evaluate GraphRAG only if multi-document relationship traversal improves decisions.
- Add model/prompt version release notes and rollback.

Exit: model changes cannot ship without measurable quality and safety evidence.

## Phase 5: product operations

- Add tenant usage/cost dashboard and administrator quotas.
- Add approval and evidence audit export.
- Add integrations only through governed, idempotent tools.
- Add customer-specific terminology/policy packs without model fine-tuning.
- Add accessibility and supported-device test matrix.
- Add support escalation and incident communications.

Exit: owned operational model for real users and customer support.

## Highest-value next three changes

1. Complete and record live identity/edge/RAG/DLQ security smoke tests.
2. Build explicit tenant/client assignment administration with mandatory operator MFA.
3. Add evidence malware/PII scanning plus auditable deletion and restore drills.
