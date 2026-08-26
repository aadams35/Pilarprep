# Operations Runbook

## First response

1. Identify action, jobId, traceId, tenantHash, final status, and UTC time.
2. Open the pillarprep-demo-jobs-pipeline dashboard.
3. Check API errors, queue depth/age, DLQ, worker duration, Bedrock, AgentCore, RAG,
   authorization, quota, Guardrail, and estimated-spend panels.
4. Query safe logs by traceId or jobId. Do not paste customer content into tickets.
5. Decide whether the issue is user-correctable, transient, security-related, or poison.
6. Use the kill switch if repeated generation could cause cost or data risk.

## Generation or refinement failed

- Confirm the job reached the worker and inspect queueWaitMs.
- Check selected model, modelLatencyMs, retryCount, stop reason, and validation error.
- For refinement, verify refinementTarget and baseBriefVersion.
- Confirm non-target tabs remained unchanged.
- If corrected facts still conflict, do not approve or manually patch the artifact.
- A single focused repair is allowed; repeated model or schema failure should remain failed.
- Re-run only with a new idempotency key after correcting input or configuration.

## Approval failed

- Compare expected packetVersion with BRIEF#LATEST.
- Confirm approvalStatus and approvedPacketVersion.
- If refinement happened after review, reload and reapprove the new version.
- Verify immutable key absence/presence and SHA-256 before retrying.
- Never overwrite an existing immutable version with different bytes.

## Handoff or catch-up failed

- Verify a current server-side approved brief exists.
- Check AgentCoreFailures and AgentCoreLatencyMs.
- Confirm worker role may invoke the exact Runtime ARN.
- Confirm Runtime received runtime/evidence.py and the Knowledge Base environment.
- Check scope token expiration and governed tool authorization.
- For catch-up, verify project-state version did not change.
- No local or deterministic fallback is acceptable for a hosted failure.

## Meeting processing failed

- Confirm the approved packet version supplied at start still matches.
- Check Transcribe job state and EventBridge delivery to the main queue.
- Confirm transcript object exists under the scoped synthetic path.
- Inspect continuation receive count and proposal status.
- A proposal is non-authoritative until every item is accepted, edited, or rejected.
- Failed or stale proposals expire after two days.

## Evidence ingestion failed

- Check EVIDENCE# status and ingestion job ID.
- Check RagIngestionStatusFailures and the Knowledge Base ingestion failure reason.
- Confirm source object and metadata sidecar share the same document prefix.
- Confirm approved/status/visibility and tenant/client/project metadata.
- Re-index only after correcting the cause.
- Do not mark deletion complete before service synchronization.

## Download failed

- Confirm the caller can read the exact tenant/client/project latest pointer.
- Confirm the key remains inside that prefix.
- Generate a new short-lived presigned URL; never reuse or log an expired signature.
- Verify KMS key policy and role decrypt permission.
- Direct S3 access should remain denied.

## DLQ investigation and replay

Automatic replay is intentionally disabled.

1. Alarm identifies one or more DLQ messages.
2. Inspect the scoped job record, safe failure reason, receive count, and prior replay audit.
3. Classify:
   - transient service/configuration issue: eligible after correction
   - stale version/user-correctable input: acknowledge without replay
   - malformed pointer, scope mismatch, unknown action, or exhausted attempts: quarantine
4. Sign in as a user in the PilarPrepOperators group.
5. Call POST /api/workspace/operations/dlq/replay with:
   - reason: 8-240 character investigation note
   - maxMessages: 1-10
6. The API conditionally records operator, reason, token hash, replay count, and status.
7. Eligible messages return to the main queue with the same pointer/idempotency.
8. Maximum replay count is one by default and total attempts are bounded at six.
9. Poison messages receive a long visibility quarantine and an audit record.
10. Confirm the message was deleted from the DLQ only after successful dispatch or
    explicit acknowledgement.

## Security response

- CrossScopeAuthorizationAttempts or RagCrossScopeAttempts at one is actionable.
- Repeated UnauthorizedRequests may indicate direct-origin or token probing.
- Disable the affected user, rotate the origin/scope secret when warranted, and
  preserve safe logs.
- Do not reveal whether another tenant/client/project exists.
- For suspected data exposure, stop generation, block access, preserve evidence, and
  follow the account incident process.

## Cost response

- Check BriefEstimatedCostUsd, model routes, token counts, and quota metrics.
- Disable Claude tier or generation globally if spend is unexpected.
- Lower per-user/per-tenant limits only through deployment parameters.
- AWS Budget is an alert, not a hard cap.

## Alarm ownership

Every active alarm publishes to the Jobs stack SNS topic. A subscription must be
confirmed before relying on email delivery. Alarm descriptions identify the first
runbook section. Resolve the root cause before closing the alarm; do not silence DLQ,
cross-scope, KMS, or immutable-approval failures during a demo.
