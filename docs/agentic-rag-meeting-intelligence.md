# PilarPrep Agentic RAG and Meeting Intelligence

Status: locally implemented and verified. Live AWS deployment evidence must be added only after the public HTTPS smoke test passes.

## 1. Verified Starting Architecture

Repository verification shows PilarPrep begins with:

- React/Vite static frontend hosted from private Amazon S3 through CloudFront Origin Access Control.
- Short-lived Cognito Identity credentials that SigV4-sign requests to an IAM-authorized API Gateway HTTP API.
- One Jobs API Lambda that validates scope, stores a private input object, records the job, and sends a pointer-only SQS message.
- One encrypted SQS Standard queue, one DLQ, and one unified AI worker Lambda.
- Amazon Bedrock Nova Pro and Nova Micro with Bedrock Guardrails for brief generation and refinement.
- Bedrock AgentCore Runtime, Memory, Gateway, governed tools, and Strands for handoff and catch-up.
- One DynamoDB table for jobs, versions, project state, idempotency, and latest pointers.
- One private S3 artifact bucket for latest JSON and DOCX artifacts.
- CloudWatch logs, metrics, alarms, dashboards, and X-Ray tracing.

The feature preserves that architecture. It adds a bounded meeting workflow rather than introducing a second API, queue, worker, table, or general-purpose agent.

## 2. Root Implementation Plan

1. Curate one synthetic Blue Mesa corpus with strict metadata.
2. Create a private Bedrock Knowledge Base backed by S3 Vectors.
3. Require recording authorization before issuing a scoped direct-upload form.
4. Store audio in a private quarantine prefix and require a clean GuardDuty malware verdict.
5. Start an asynchronous Amazon Transcribe job without PII redaction.
6. Resume the exact job through EventBridge and the same SQS queue.
7. Apply Bedrock Guardrails to the full private transcript before AI analysis.
8. Retrieve only approved Blue Mesa evidence with bounded tools.
9. Use Nova Pro to compare the transcript with the approved brief.
10. Validate timestamps, transcript evidence, payroll scope, and the existing-AWS correction.
11. Persist proposed changes without mutating approved state.
12. Require human accept, edit, or reject decisions.
13. Apply accepted changes with an optimistic DynamoDB transaction.
14. Generate the handoff only after approval and keep catch-up read-only.

## 3. Files Changed

Core feature files:

- backend/jobs_pipeline/meeting.py
- backend/jobs_pipeline/meeting_contracts.py
- backend/jobs_pipeline/worker.py
- backend/jobs_pipeline/api.py
- backend/jobs_pipeline/common.py
- backend/jobs_pipeline/template.yaml
- backend/agentcore/runtime/meeting.py
- backend/agentcore/runtime/service.py
- backend/agentcore/common/contracts.py
- backend/agentcore/template.yaml
- frontend/app/components/meeting-intelligence.tsx
- frontend/app/page.tsx
- frontend/app/product.css
- frontend/lib/pillarprep/types.ts
- frontend/lib/pillarprep/jobs-client.ts
- data/blue-mesa-evidence/*
- data/blue-mesa-meeting-script.json
- scripts/prepare-blue-mesa-rag.ps1
- scripts/deploy-jobs-pipeline.ps1
- scripts/deploy-agentcore.ps1
- backend/frontend_static/template.yaml
- scripts/deploy-aws-frontend.ps1
- backend/jobs_pipeline/tests/test_pipeline.py
- backend/agentcore/tests/test_runtime.py
- tests/jobs-client.test.mjs
- tests/e2e/meeting-intelligence.spec.ts

## 4. Infrastructure Added or Modified

New resources in the Jobs stack:

| Resource | Purpose | Important configuration |
| --- | --- | --- |
| Private meeting evidence bucket | Corpus, prepared MP3, and Transcribe output | Public access blocked, AES-256 encryption, TLS-only policy, versioning, transcript expiry |
| S3 Vectors vector bucket | Private vector storage for the KB | AES-256 encryption and retained data |
| S3 Vectors index | Semantic index | 1,024 dimensions, float32, cosine distance |
| Bedrock Knowledge Base role | KB access | Exact source bucket/prefix, embedding model, and exact vector index permissions |
| Bedrock Knowledge Base | Scenario retrieval | Titan Text Embeddings v2 and S3 Vectors |
| Bedrock data source | Corpus ingestion | Fixed Blue Mesa evidence prefix |
| EventBridge rule | Transcribe completion routing | Only COMPLETED and FAILED Transcribe job events |
| SQS queue policy | EventBridge delivery | Exact rule ARN and account conditions |
| Worker permissions | Meeting processing | Fixed evidence prefixes, Transcribe batch APIs, DynamoDB transactions, AgentCore invoke |
| Session quota records | Public-demo cost control | Twelve expensive AI actions per session per hour by default, two-hour TTL |
| Managed CloudFront Web ACL | Edge rate control | Blocks above 100 requests per IP in five minutes; AWS managed groups stay in count mode |

Existing SQS, DLQ, worker, API, table, artifact bucket, Guardrail, and AgentCore resources are reused.

## 5. RAG Corpus and Metadata Design

The corpus is synthetic and fixed to evidence/public-demo/blue-mesa-payments/.

Documents:

- company-profile
- company-values
- business-objective
- stakeholder-profiles
- meeting-objective
- current-aws-environment
- technical-inventory
- compliance
- constraints-risks
- previous-meeting-notes
- aws-reference-excerpts

Every source has a Bedrock metadata sidecar containing:

- scenarioId: blue-mesa-payments
- documentType: a controlled document type
- version: 1
- approved: true
- visibility: public-demo
- sourceTitle: a human-readable synthetic source name

Retrieval uses an AND filter for the exact scenario, approved=true, and visibility=public-demo. Results are then post-filtered in code. A mismatched result is rejected rather than merely hidden from the model.

Prompts, credentials, visitor content, arbitrary URLs, unapproved model output, and raw uploads are never ingested.

## 6. Agent Tools and Limits

Governed read tools have strict scenario and scope validation:

- retrieve_scenario_evidence
- get_latest_approved_brief
- get_project_state
- get_meeting_transcript_evidence
- get_stakeholder_profile
- compare_meeting_to_brief

Meeting analysis is a bounded Strands orchestration, not an autonomous agent:

- Maximum three tool calls.
- Maximum two retrieval rounds.
- No web, shell, or filesystem tools.
- No write-capable tools.
- Exact client and scenario boundary.
- Retrieval metadata filter plus post-filter rejection.
- Nova Pro reasons over the approved brief, current state, transcript, and retrieved evidence.
- Material claims require transcript or RAG support, otherwise they remain assumptions.

Authority order:

1. Current explicit correction.
2. Approved structured scenario facts.
3. Approved meeting evidence.
4. Approved RAG evidence.
5. Previous generated brief.
6. Model assumptions.

## 7. Transcription Workflow

~~~mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant API as Jobs API
    participant DDB as DynamoDB
    participant Q as SQS
    participant W as AI Worker
    participant GD as GuardDuty Malware Protection
    participant T as Amazon Transcribe
    participant EB as EventBridge
    participant GR as Bedrock Guardrails
    participant AC as AgentCore + Strands
    participant S3 as Private S3

    User->>UI: Confirm authorization and choose synthetic audio
    UI->>API: Request scoped upload
    API-->>UI: Short-lived private upload form
    UI->>S3: Upload to quarantine prefix
    S3-->>GD: New upload
    GD-->>EB: Malware scan result
    EB->>Q: Send scan event
    UI->>API: POST meeting.process with upload/version
    API->>DDB: Create scoped queued job
    API->>S3: Store validated input
    API->>Q: Send job and S3 pointer
    Q->>W: Deliver job
    W->>DDB: Verify clean scan, scope, and waiting request
    W->>T: Start batch transcription with speakers
    W->>DDB: Store stable continuation and phase
    T->>S3: Write full private transcript
    T-->>EB: COMPLETED or FAILED
    EB->>Q: Send completion event
    Q->>W: Deliver continuation
    W->>DDB: Claim continuation lease
    W->>S3: Read transcript and approved packet
    W->>GR: Screen transcript content
    GR-->>W: Accept or block
    W->>AC: Analyze with bounded RAG and Nova Pro
    AC-->>W: Structured proposed changes
    W->>S3: Save proposed artifact
    W->>DDB: Save proposed state only
    UI->>API: Poll until review-ready
~~~

Stable values carried through the continuation are scenarioId, meetingId, jobId, sessionId, traceId, inputVersion, and expected approved packet version. Conditional continuation claims suppress duplicate analysis.

The prepared MP3 is a durable synthetic demo asset that a signed-in user may download for the rehearsal. It is never preloaded into the meeting workspace: the user must explicitly choose and upload a local MP3, WAV, or M4A file. Uploaded copies and full Transcribe output expire. Only the JWT-authenticated BlueMesa workspace can obtain upload authorization; callers cannot select an arbitrary bucket or object key.

## 8. Meeting-Analysis Schema

Nova Pro returns:

- meetingSummary
- confirmedFacts
- correctedAssumptions
- decisions
- openQuestions
- requirements
- risks
- scopeChanges
- actions
- stakeholderSignals
- proposedHandoffSummary
- citations

Every extracted item includes id, statement, status, speaker, timestampStart, timestampEnd, evidenceText, confidence, and sourceType. Actions also include owner, targetDate, and dependency. Corrected assumptions also include previousAssumption, meetingCorrection, and affectedBriefSections.

Server validation checks:

- Complete schema and unique IDs.
- Timestamp bounds.
- Evidence overlap with the speaker-labeled transcript.
- Confidence range.
- Payroll appears in meaningful output.
- Current facts do not reintroduce an on-premises migration.
- Actions have explicit owner/dependency fields.
- Scenario and brief version match.
- Reviewable changes exist.

Malformed or contradictory output receives one focused repair attempt. A second failure ends the job without changing the approved packet.

## 9. Human Approval Behavior

The review screen shows:

- Original approved content.
- Proposed update.
- Speaker, timestamp, and supporting transcript text.
- Confidence.
- Accept, edit, and reject controls.
- Accept all reviewed changes.
- Final approval.

The final action remains disabled until every item has a disposition and at least one item is accepted or edited. Edits must contain a non-empty project statement.

Approval performs a DynamoDB transaction that:

1. Confirms the proposal is still proposed and based on the expected brief version.
2. Marks the previous meeting approval audit as superseded when one exists.
3. Writes an immutable approval audit record.
4. Conditionally replaces the latest meeting pointer.

Rejected changes stay in immutable audit metadata and never enter meeting notes, project state, the handoff, or catch-up. Accepted evidence includes speaker and timestamp provenance.

## 10. Security Controls

- Synthetic Blue Mesa data only.
- Fixed scenario, meeting, and client plus a server-issued scanned upload record enforced server-side.
- Private S3 with all four public access block settings.
- CloudFront Origin Access Control and SigV4 origin reads.
- HTTPS redirect, TLS-only bucket policies, and HTTPS-only production origin validation.
- IAM-authorized guest jobs plus a JWT-authorized private workspace for meeting audio and meeting processing.
- No browser access to Bedrock, Transcribe, DynamoDB, evidence S3, S3 Vectors, or the Knowledge Base.
- CORS restricted to configured HTTPS PilarPrep origins.
- API Gateway throttle: four requests per second with burst eight.
- Session quota: twelve expensive AI actions per hour by default.
- CloudFront WAF IP rate block plus observed AWS managed protections.
- SQS encryption, DLQ, max receive count three, batch size one, and worker concurrency cap two.
- Maximum three agent tool calls and two retrieval rounds.
- Model output token ceiling and one repair retry.
- LIVE_AI_ENABLED kill switch.
- TTL for jobs, idempotency, continuation, proposal, and transcript records.
- Logs contain IDs, phases, timings, and error types, not transcript text, raw prompts, credentials, or full packets.

AWS Shield Standard protection for CloudFront is automatic. It does not replace IAM, WAF, quotas, or application authorization.

## 11. Tests and Results

Latest local verification before deployment:

- Bedrock brief Lambda: 51 tests passed.
- Jobs pipeline: 42 tests passed.
- AgentCore: 57 tests passed, with one optional dependency test skipped.
- Frontend unit/contract tests: 35 passed.
- Browser workflows: 4 passed.
- Golden brief evaluation: four scenarios scored 100/100.
- TypeScript strict compilation: passed.
- ESLint: passed with no warnings.
- AWS static production build: passed.
- Bedrock, Jobs, AgentCore, and frontend SAM templates: valid.
- PowerShell deployment parsers: passed.
- Git patch hygiene: passed.
- Focused live meeting smoke: passed in 135,199 ms.
- Complete live brief-to-catch-up smoke: passed in 174,473 ms.

Coverage includes scenario filtering, tool limits, cross-client rejection, duplicate queue delivery, Transcribe duplicate completion, analysis failure isolation, canonical transcript evidence, wrong timestamp rebinding, payroll, existing AWS state, transcript-only proposal filtering, Decimal-safe approval artifacts, stale approval, supersession, rejected changes, private S3 declarations, unsigned requests, loading state, and approval gating.

## 12. Deployment Outputs

Verified deployment outputs:

- Jobs API: https://kcod9pw1j7.execute-api.us-east-1.amazonaws.com
- AI worker: pillarprep-demo-ai-worker
- Main queue: pillarprep-demo-ai-jobs
- DLQ: pillarprep-demo-ai-jobs-dlq
- Meeting evidence bucket: pillarprep-jobs-meetingevidencebucket-py7t2sskvsqj
- Blue Mesa Knowledge Base: OUMNVO2WIM
- Knowledge Base data source: H93E8EXNVJ
- AgentCore Runtime: PilarPrepProjectAgent-FjGV7rBEmT
- CloudFront URL: https://d2e0btay0ynyf.cloudfront.net
- Custom URL: https://pilarprep.app

Verified stack states:

- pillarprep-bedrock: UPDATE_COMPLETE
- pillarprep-agentcore: UPDATE_COMPLETE
- pillarprep-jobs: UPDATE_COMPLETE
- pillarprep-frontend: UPDATE_COMPLETE

Deployment order:

~~~powershell
$env:AWS_PROFILE = "pillarprep-deployer"
.\scripts\deploy-jobs-pipeline.ps1 -Region us-east-1 -DemoSessionAiLimit 12
.\scripts\deploy-aws-frontend.ps1 -Region us-east-1
~~~

The Jobs deployment creates the KB, synchronizes the corpus, prepares and uploads the synthetic MP3, starts ingestion, and then updates AgentCore with the exact Knowledge Base authorization.

## 13. Live Smoke-Test Evidence

Verified on August 21, 2026:

1. Complete public flow generated and approved a fresh Blue Mesa prebrief.
2. Meeting job e4dcefe6-00c9-4995-b316-110017624a20 moved through transcribing, analyzing, and review-ready.
3. Transcribe returned 27 speaker-labeled segments.
4. Nova Pro and AgentCore proposed nine timestamp-supported changes.
5. Human review accepted eight changes and rejected one.
6. Meeting approval persisted immutable and latest audit artifacts.
7. Handoff provider was AgentCore with no deterministic fallback.
8. Catch-up provider was AgentCore and remained read-only.
9. Unsigned Jobs API access returned 403.
10. Direct artifact and meeting-evidence S3 access returned 403.
11. HTTP returned 301 to HTTPS; HTTPS returned 200 with one-year HSTS.
12. WAF included PilarPrepPublicDemoRateLimit at priority 100 with BLOCK.
13. Managed WAF groups remained in COUNT for tuning.
14. Knowledge Base retrieval returned three approved Blue Mesa results.
15. Latest chronological ingestion RHTMERUFXT completed: 11 documents scanned, one newly indexed, and zero failed.
16. The main queue and DLQ both settled at zero visible and zero in-flight messages after guarded redrive.

The focused run reused the approved brief and completed as job a275a50d-471f-4e20-a201-d87c1179a973 in 135,199 ms with eight review items, seven accepted changes, and one rejected change. The complete run took 174,473 ms.

Live defects found and corrected during verification:

- AgentCore deployments now rediscover the Jobs stack outputs so CloudFormation preserves the exact Knowledge Base and unified-worker IAM grants.
- Bedrock Guardrails assess the synthetic transcript through a selective guardContent block instead of misclassifying PilarPrep control instructions as a prompt attack.
- Non-transcript prebrief material is excluded from proposed meeting changes.
- Paraphrased evidence with an incorrect model timestamp is rebound to the strongest canonical transcript segment.
- DynamoDB Decimal values are converted only at the JSON/S3 boundary while DynamoDB writes retain native numeric typing.

## 14. Cost Implications

The workflow remains request driven:

- Nova Pro charges for input and output tokens.
- Titan embeddings are charged when the corpus is ingested or changed.
- Knowledge Base retrieval and S3 Vectors are usage/storage based.
- Amazon Transcribe charges per audio minute for the prepared 5-8 minute recording.
- Polly is used only to prepare the synthetic asset.
- Lambda, API Gateway, SQS, DynamoDB, S3, EventBridge, CloudWatch, and X-Ray are low at demo traffic.
- WAF adds a small fixed and request-based cost unless covered by the account's CloudFront plan.
- There is no NAT Gateway, provisioned model endpoint, always-running compute, Neptune, Redshift, or live recording loop.

Cost controls are the fixed scenario, prepared audio, 12-action session quota, API throttling, WAF rate block, worker concurrency cap two, token ceiling, bounded tool calls, one retry, TTL, and LIVE_AI_ENABLED. Confirm current prices on official AWS pricing pages before publishing dollar estimates.

## 15. Remaining Risks

- The existing public Cognito demo role is suitable only for a constrained synthetic portfolio demo.
- The WAF managed groups remain in count mode until sampled requests are reviewed.
- DynamoDB and S3 cannot participate in one atomic transaction; private orphan artifacts may remain after a failed conditional approval and should be lifecycle-cleaned.
- Selective Guardrail scoping depends on preserving the guardContent boundary in future prompt refactors.
- The prepared audio stays available for the demo; it must be removed when the portfolio demo is retired.
- Transcribe and Bedrock latency are variable.
- The corpus is intentionally small and supports one scenario only.
- CloudTrail data events and stronger identity-based tenant assignment are production follow-ups.
- A backup screen recording remains prudent for an interview.

DLQ redrive procedure:

~~~powershell
$dlqUrl = aws cloudformation describe-stacks --stack-name pillarprep-jobs --query "Stacks[0].Outputs[?OutputKey=='JobDeadLetterQueueUrl'].OutputValue | [0]" --output text
$dlqArn = aws sqs get-queue-attributes --queue-url $dlqUrl --attribute-names QueueArn --query "Attributes.QueueArn" --output text
aws sqs start-message-move-task --source-arn $dlqArn
~~~

Before redrive, inspect CloudWatch logs by jobId and traceId, fix the cause, verify the approved packet version still matches, and then redrive. Do not redrive stale approval messages blindly.

## 16. Interview-Ready Architecture Explanation

### 30 seconds

PilarPrep turns an approved customer prebrief and a synthetic meeting into governed implementation context. The meeting is transcribed asynchronously, then a bounded Strands workflow retrieves only approved Blue Mesa evidence and uses Nova Pro to identify corrections, decisions, risks, and actions. Nothing becomes project truth until a person reviews every timestamp-supported change. After approval, conditional DynamoDB writes update the latest state and AgentCore builds the handoff and role-specific catch-up.

### Two minutes

The frontend is a private-S3 static React app behind CloudFront. Public demo visitors receive short-lived Cognito credentials and SigV4-sign an IAM-authorized Jobs API request, so there is no browser API key and no direct browser access to AI or data services.

The Jobs API writes a scoped job and a private input pointer, then SQS invokes one unified worker. For meeting processing, the worker accepts only a signed-in BlueMesa upload that has a clean GuardDuty malware-scan record. It starts Amazon Transcribe with speaker labels and stores a continuation record. EventBridge sends completion back to the same queue, where a conditional lease makes duplicate completion events harmless.

The worker then invokes AgentCore. A bounded Strands orchestration has at most three tool calls and two retrieval rounds. It loads the latest approved brief, current state, and a Bedrock Knowledge Base backed by S3 Vectors. Retrieval is filtered and post-filtered to the approved public-demo Blue Mesa corpus. Nova Pro returns a strict schema, and deterministic validation proves the timestamps and evidence are real, payroll is represented, and the confirmed existing-AWS state is not turned back into an on-premises migration story.

The output is only a proposal. The reviewer accepts, edits, or rejects every item. Final approval uses optimistic DynamoDB conditions, preserves rejected history, supersedes the prior meeting approval, and only then generates the handoff. Catch-up reads the latest approved state and remains read-only.

The architectural decision is not simply to add more AI. It is to make AI useful at the exact handoff where sales context can otherwise become an unverified engineering assumption.

