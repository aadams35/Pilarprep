# PilarPrep Secured Meeting Audio Deployment Runbook

Status: implemented and verified locally on 2026-08-26. Not deployed, committed, or pushed.

Region: us-east-1

Affected stacks:

- pillarprep-jobs
- pillarprep-agentcore
- pillarprep-frontend

The existing pillarprep-bedrock stack remains a dependency because it supplies the shared table, artifact bucket, identity configuration, and Bedrock Guardrail outputs.

## 1. Verified Current Architecture

Before this change, PilarPrep already used a private React frontend, IAM-signed API calls, one SQS queue and DLQ, a unified AI worker, Amazon Transcribe, Amazon Bedrock, AgentCore with Strands, one DynamoDB table, and private S3 storage.

The original meeting path accepted an authorized upload, created a meeting job, started Transcribe, delivered Transcribe completion through EventBridge to the shared queue, analyzed the transcript, and saved project state and artifacts.

## 2. Root Causes And Security Gaps

The original implementation had four material gaps:

1. Uploaded audio could reach Transcribe without an independent malware verdict.
2. Transcribe PII redaction was controlled by request input, so a client could attempt to disable it.
3. Content-bearing AI actions did not all pass through one reusable PII and Guardrail gate.
4. Output safety checks were not uniformly enforced immediately before persistence.

There was also no explicit user-visible scan lifecycle and no Event 1 path for GuardDuty scan results.

## 3. Final Target Architecture

The secured meeting path is:

1. An authenticated browser requests a scoped upload form.
2. Audio is uploaded to audio/uploads/ in the private meeting-audio bucket.
3. GuardDuty Malware Protection for S3 scans only that prefix and writes the managed GuardDutyMalwareScanStatus tag.
4. EventBridge Event 1 sends the scan result to the existing SQS queue.
5. The AI worker verifies account, bucket, prefix, upload record, scope, version, ETag, event identity, and object tag.
6. A clean scan starts Transcribe only when a matching authorized process request exists. Otherwise it records clean and waits.
7. Transcribe creates only a PII-redacted transcript.
8. EventBridge Event 2 sends Transcribe completion to the same queue.
9. The worker validates the continuation and reads only the expected redacted transcript.
10. Amazon Comprehend detects remaining PII and replaces permitted values with stable typed placeholders.
11. Bedrock ApplyGuardrail with source INPUT evaluates the sanitized content.
12. Bedrock or AgentCore/Strands performs analysis.
13. Bedrock ApplyGuardrail with source OUTPUT runs before schema, business validation, and persistence.
14. Only accepted results update DynamoDB and private S3.

Architecture artifacts:

- SVG: architecture/PilarPrep-Two-Event-Audio-Infrastructure.svg
- PNG: architecture/PilarPrep-Two-Event-Audio-Infrastructure.png

## 4. Files Changed For This Work

Core safety and processing:

- backend/shared/__init__.py
- backend/shared/content_safety.py
- backend/jobs_pipeline/api.py
- backend/jobs_pipeline/common.py
- backend/jobs_pipeline/meeting.py
- backend/jobs_pipeline/worker.py
- backend/jobs_pipeline/template.yaml
- backend/jobs_pipeline/tests/test_pipeline.py

Agent processing:

- backend/agentcore/runtime/service.py
- backend/agentcore/runtime/meeting.py
- backend/agentcore/template.yaml
- backend/agentcore/tests/test_evidence.py
- backend/agentcore/tests/test_runtime.py

Frontend and contracts:

- frontend/app/page.tsx
- frontend/app/components/meeting-intelligence.tsx
- frontend/lib/pillarprep/jobs-client.ts
- frontend/lib/pillarprep/types.ts

Deployment, verification, and documentation:

- scripts/deploy-agentcore.ps1
- scripts/smoke-meeting-live.mjs
- docs/architecture/PilarPrep-Two-Event-Audio-Infrastructure.svg
- docs/architecture/PilarPrep-Two-Event-Audio-Infrastructure.png
- docs/secured-meeting-audio-deployment-runbook.md

The worktree already contains many unrelated local changes. Review and stage only the files intended for this release.

## 5. GuardDuty And EventBridge Event 1

backend/jobs_pipeline/template.yaml now defines:

- GuardDutyMalwareProtectionRole
- MeetingAudioMalwareProtectionPlan
- GuardDutyScanResultRule
- a queue policy restricted to that rule ARN and the current AWS account
- managed result tagging through GuardDutyMalwareScanStatus

The plan is scoped to audio/uploads/. The trusted packaged Blue Mesa demo audio remains separately authorized and does not grant access to arbitrary uploaded objects.

Event 1 is treated as at-least-once delivery. The worker uses the event ID plus object identity as an idempotency key. A clean event is necessary but not sufficient: the worker also verifies the S3 tag and matching upload record before Transcribe can read the object.

The only accepted result is NO_THREATS_FOUND.

The pipeline fails closed for threats, unsupported or skipped scans, access denied, failed scans, malformed or unknown results, and any account, bucket, prefix, version, ETag, or scope mismatch.

## 6. Transcribe And EventBridge Event 2

The existing TranscribeCompletionRule is retained. Both EventBridge rules target the same SQS queue, where the worker identifies the event shape before routing it.

Every meeting transcription now forces this server-side configuration:

    ContentRedaction:
      RedactionType: PII
      RedactionOutput: redacted
      PiiEntityTypes:
        - ALL

The browser cannot disable redaction. The worker accepts only the expected redacted transcript object and verifies the Transcribe job, output key, tenant scope, approved packet version, and continuation record.

## 7. PII Input And Output Controls

backend/shared/content_safety.py is the common safety boundary for Lambda and AgentCore.

Input sequence:

1. Validate identity, tenant, client, project, session, and action scope.
2. Normalize content without logging it.
3. Chunk deterministically for service limits.
4. Call Amazon Comprehend DetectPiiEntities.
5. Replace permitted PII with stable placeholders such as [PII:EMAIL:001].
6. Block high-risk values such as credentials, AWS access keys, card secrets, bank details, PINs, and SSNs.
7. Call Bedrock ApplyGuardrail with source INPUT.
8. Send only accepted, sanitized content to Bedrock, AgentCore, Strands, tools, or retrieval.

Output sequence:

1. Call Bedrock ApplyGuardrail with source OUTPUT.
2. Apply existing schema, completeness, contradiction, scope, and target-tab rules.
3. Reject unsafe or malformed output.
4. Preserve the prior valid packet when validation fails.
5. Store only minimal status metadata, never rejected content.

The gate fails closed when enabled but not configured with a Guardrail ID and version.

## 8. DynamoDB State Transitions

PilarPrep continues to use exactly one physical DynamoDB table.

Upload lifecycle:

    pending_scan -> clean
    pending_scan -> blocked
    pending_scan -> scan_failed

Meeting job lifecycle:

    queued -> waiting_for_scan -> transcribing -> screening -> analyzing -> complete
    queued -> transcribing -> screening -> analyzing -> complete
    any active state -> failed

Temporary records cover upload identity and scope, bucket/key/version/ETag, waiting process intent, GuardDuty event idempotency, Transcribe continuation, screening and validation outcomes, retry classification, and TTL.

Conditional writes prevent duplicate EventBridge or SQS deliveries from starting multiple transcription jobs, repeating analysis, overwriting a newer packet, or creating duplicate artifacts.

## 9. IAM And Data Boundaries

- The browser receives temporary Cognito credentials and signs API Gateway requests with SigV4.
- The API creates scoped upload forms and job records but does not process AI content.
- GuardDuty can inspect and tag only the configured upload prefix and its validation object.
- EventBridge can send only from the two named rules to the named queue, restricted by source ARN and account.
- The worker can read uploaded audio only when GuardDutyMalwareScanStatus is NO_THREATS_FOUND.
- The trusted synthetic Blue Mesa prefix has a separate read permission.
- Worker and AgentCore roles can call Comprehend DetectPiiEntities and the configured Bedrock Guardrail.
- Customer content remains in private S3 and scoped DynamoDB records.
- Customer content, prompts, transcripts, PII, and rejected output are excluded from application logs.

## 10. Local Test Results

Completed locally:

| Verification | Result |
| --- | --- |
| Jobs pipeline unit and contract tests | 91 passed |
| AgentCore tests | 68 passed, 1 skipped |
| Bedrock Lambda tests | 56 passed |
| Frontend/Node tests | 41 passed |
| Playwright browser workflows | 7 passed |
| Production dependency audit | 0 vulnerabilities |
| TypeScript type checking | Passed |
| ESLint | Passed |
| vinext production build | Passed |
| AWS static frontend build | Passed, 255 modules |
| Jobs SAM validation with lint | Passed |
| AgentCore SAM validation with lint | Passed |
| Final SVG XML validation | Passed |

No live AWS smoke test was run because deployment was explicitly excluded.

## 11. Cost Implications

The design remains pay-per-use and adds no always-on compute.

New or increased charges can come from:

- GuardDuty Malware Protection for S3: objects evaluated and GB scanned.
- S3: upload, tag, transcript, artifact, and lifecycle requests/storage.
- EventBridge and SQS: two event transitions and queue requests, plus retries.
- Lambda: Event 1 and Event 2 worker execution.
- Amazon Transcribe: audio duration plus PII-redaction usage.
- Amazon Comprehend: text units evaluated for remaining PII.
- Bedrock Guardrails: text units for configured INPUT and OUTPUT safeguards.
- Bedrock or AgentCore model inference: tokens processed for analysis.

Practical controls:

- Keep meeting audio Blue Mesa-only for the demo.
- Enforce file size and content-type limits.
- Expire temporary uploads and transcripts with S3 lifecycle rules.
- Alarm on queue age, DLQ depth, blocked scans, safety interventions, and estimated model spend.
- Preserve worker concurrency and model-routing limits.

Verify current regional rates immediately before deployment:

- https://aws.amazon.com/guardduty/pricing/
- https://aws.amazon.com/transcribe/pricing/
- https://aws.amazon.com/comprehend/pricing/
- https://aws.amazon.com/bedrock/pricing/

## 12. Exact Deployment Commands

Run from PowerShell after reviewing the diff and authenticating the existing deployment role.

    Set-Location 'C:\Users\Austin\Documents\Codex\2026-08-19\now-you-know-how-it-works\PilarPrep-agentic-rag'
    $env:AWS_PROFILE = 'pillarprep-deployer'
    $env:AWS_REGION = 'us-east-1'
    aws sts get-caller-identity --profile pillarprep-deployer

Re-run local validation:

    npm run pipeline:test
    npm run agentcore:test
    npm run lambda:test
    npm test
    npm run lint
    npx tsc --noEmit
    npm run build:aws-frontend
    sam validate --lint --template-file backend/jobs_pipeline/template.yaml
    sam validate --lint --template-file backend/agentcore/template.yaml

Deploy AgentCore first so the shared safety module is packaged while the existing jobs outputs are still available:

    .\scripts\deploy-agentcore.ps1 -Region us-east-1 -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net -SecondaryAllowedOrigin https://pilarprep.app

Deploy the jobs stack. This adds GuardDuty, Event 1, IAM, upload status routes, worker changes, metrics, and alarms. The script refreshes AgentCore authorization unless SkipAgentCoreAuthorization is supplied.

    .\scripts\deploy-jobs-pipeline.ps1 -Region us-east-1 -Profile pillarprep-deployer -AllowedOrigin https://pilarprep.app -SecondaryAllowedOrigin https://d2e0btay0ynyf.cloudfront.net -LiveAiEnabled true

Publish the frontend last so it receives current stack outputs:

    .\scripts\deploy-aws-frontend.ps1 -Region us-east-1

The backend stack has no task-specific code change. Redeploy it only if its deployed Guardrail outputs are missing or differ from the local template:

    .\scripts\deploy-aws-backend.ps1 -Region us-east-1 -AllowedOrigin https://d2e0btay0ynyf.cloudfront.net -SecondaryAllowedOrigin https://pilarprep.app

## 13. Rollback Procedure

Before deployment:

1. Record affected stack outputs and current stack templates.
2. Preserve the CloudFront distribution ID and current frontend object version.
3. Create your own known-good pre-change Git tag or commit.
4. Confirm the DLQ is empty or export message metadata without content.

If CloudFormation fails, allow automatic rollback to finish. Inspect the failed resource event, especially the GuardDuty role and protection plan. Do not manually delete the shared table, buckets, or queues.

If deployment completes but smoke tests fail:

1. Stop new AI submissions with the existing deployment control if immediate containment is needed.
2. Redeploy the known-good previous AgentCore and jobs packages/templates.
3. Restore the previous frontend build and invalidate CloudFront.
4. Inspect the queue and DLQ before replay. Never replay blocked or unknown scan results.
5. Confirm stack status is stable and direct S3 access remains denied.

Existing unverified audio must not be grandfathered in. Re-upload it through the secured path.

## 14. Post-Deployment Smoke-Test Checklist

Infrastructure:

- [ ] pillarprep-agentcore, pillarprep-jobs, and pillarprep-frontend finish in a complete state.
- [ ] MeetingAudioMalwareProtectionPlanStatus is active.
- [ ] GuardDuty scope is exactly the meeting bucket and audio/uploads/ prefix.
- [ ] Event 1 and Event 2 rules are enabled and target the existing queue.
- [ ] The queue policy has only the two expected EventBridge source ARNs/accounts.
- [ ] Uploaded-audio reads require the clean managed tag.
- [ ] Direct S3 access remains denied.

Application:

- [ ] The public app loads over HTTPS with the current frontend bundle.
- [ ] Brief generation, refinement, handoff, catch-up, and custom scenarios still complete.
- [ ] Blue Mesa remains the only scenario with meeting audio.
- [ ] Upload shows Scanning for threats.
- [ ] Process during scanning shows Waiting for scan and does not start Transcribe early.
- [ ] A clean upload advances through Transcribing, Screening transcript, Analyzing meeting, and Complete.
- [ ] No unredacted transcript object is created or consumed.
- [ ] A blocked or failed object never reaches Transcribe and reveals no internal finding details.
- [ ] Duplicate Event 1 and Event 2 deliveries do not repeat work.
- [ ] Existing unverified uploads are rejected and require re-upload.

Automated live checks:

    $env:PILLARPREP_PUBLIC_ORIGIN = 'https://pilarprep.app'
    $env:PILLARPREP_REUSE_APPROVED_BRIEF = 'true'
    npm run smoke:pipeline
    npm run smoke:meeting

Operations:

- [ ] CloudWatch shows Event 1, transcription start, Event 2, PII, Guardrail, and end-to-end latency metrics without customer text.
- [ ] Queue age and DLQ depth return to zero.
- [ ] DynamoDB records show upload, waiting-job, continuation, and terminal states.
- [ ] Private S3 contains only the expected upload, redacted transcript, and accepted artifacts.

## 15. Architecture Artifacts

- docs/architecture/PilarPrep-Two-Event-Audio-Infrastructure.svg
- docs/architecture/PilarPrep-Two-Event-Audio-Infrastructure.png

The diagram keeps the existing infrastructure style. Blue identifies Event 1 malware-scan routing, teal identifies Event 2 transcript-completion routing, and the shared orange queue/worker path shows where both events converge.
