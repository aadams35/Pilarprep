# BlueMesa AgentCore Demo Runbook

> **Historical pre-unified runbook.** Use
> `docs/unified-jobs-architecture.md` and the current presentation talk track
> for the live demo. Direct Agent API and `-DisableAgentCore` instructions
> below are retained only as rollback history.

## Demo objective

Show that PilarPrep does more than generate a meeting brief. It turns an approved brief into governed project state, creates a delivery handoff, and brings a new engineer up to speed without training or storing a customer-specific model.

## Pre-demo checklist

- `npm.cmd run verify:demo` and `npm.cmd run lint` pass.
- The CloudFront build points to the current brief and AgentCore APIs.
- The UI model selector is set to Nova Pro for the final run.
- BlueMesa is the only scenario with meeting audio, and the presenter can sign in to the private workspace.
- `PilarPrep-BlueMesa-Discovery-Meeting.mp3` is available locally for an explicit upload; no audio is preloaded.
- The BlueMesa brief is generated, reviewed, and approved once before the live presentation.
- CloudWatch dashboard is open in a separate tab.
- One fallback rehearsal has been completed with `-DisableAgentCore` or a local mock.
- No private customer or real LinkedIn data is present.
- The BlueMesa packet passes `npm.cmd run eval:briefs` at 85/100 or higher.
- Both generated DOCX files have been rendered and visually checked page by page.

## BlueMesa scenario

BlueMesa Payments already runs its payment platform on AWS and wants to add governed payroll-partner onboarding through real-time APIs and encrypted batch files. The team must improve partner onboarding without replacing the ledger or weakening settlement accuracy, reconciliation ownership, privileged-access evidence, or payroll-window availability.

Concerns:

- Mixed real-time API and encrypted batch-file interfaces
- Idempotency, reconciliation ownership, and payroll status events
- Payroll-data classification, retention, and privileged-access evidence
- Partner certification, recovery objectives, and payroll-window availability
- Discovery funding without assumed implementation capacity
- Faster onboarding only when settlement confidence stays protected

Stakeholders:

- Ariana Cole, Chief Digital Officer
- Dev Malik, VP Infrastructure and Resilience
- Rachel Kim, Chief Risk and Compliance Officer
- Priya Shah, Director of Payment Operations

Approved meeting outcome used for the live handoff:

> The synthetic call confirms that BlueMesa is already on AWS, keeps ledger replacement out of scope, and targets two payroll partners with onboarding reduced from twelve weeks to four. It corrects the assumptions that both partners are API-first, seven-year payroll retention is approved, spare platform capacity exists, and full implementation funding is committed. Retention, RTO/RPO, certification dates, and the investment gate remain unresolved.

## 15-minute story

### 0:00-2:00 - Problem and product

Say: "SAs prepare for the meeting, but delivery teams usually inherit scattered notes. PilarPrep has two loops: win the conversation, then preserve what was learned for execution."

Open `Context`, select `BlueMesa Payments`, and show the ranked pillars, company values, approved stakeholder notes, and values-page URL. Emphasize that stakeholder context is manually approved, not scraped.

### 2:00-5:00 - Generate and refine the brief

Generate the brief with Nova Pro. Open the technical and executive views. Point to concrete discovery questions, PCI/recovery assumptions, and different language for technical versus executive audiences.

Apply one refinement, regenerate, and approve the final pre-brief. Say: "Approval is the boundary. Loop 2 reads the approved artifact, not an unreviewed browser draft."

### 5:00-9:00 - Meeting evidence and AgentCore handoff

Open `Meet`, sign in, choose the synthetic BlueMesa MP3, and process the call. Show:

- The malware-scan and transcription lifecycle
- What the approved brief got right
- What the call corrected
- What remains unresolved
- Speaker and timestamp evidence for each proposed update
- Accept, edit, and reject controls before the follow-on handoff

Say: "The call does not overwrite the brief. Transcribe captures the private conversation, Guardrails screen the transcript, and the Strands workflow compares it with the approved packet. Only the changes a person accepts or edits become governed project context."

### 9:00-11:00 - Second request and memory

Open `Catch-up`, select BlueMesa, choose `New member`, and generate a catch-up. Then switch to `Executive` and generate again.

Point out that the answer changes by role while preserving the same approved facts, ownership, and project state. Say: "AgentCore Memory carries conversational continuity within this project session; DynamoDB remains authoritative across sessions."

### 11:00-13:00 - Security and AWS architecture

Use `docs/agentcore-architecture.md` and explain:

- Private S3 behind CloudFront for the frontend
- IAM-authenticated `/brief` and `/agent` APIs
- Existing Lambda + Bedrock path for Loop 1
- AgentCore Runtime + Memory + Gateway for Loop 2
- Signed tenant/client/project scope on every tool call
- DynamoDB source of truth and private latest-only S3 artifacts
- Guardrails, CloudWatch, and automatic Lambda fallback

Use this line: "You log into a client workspace, not a client-specific model. Bedrock hosts one managed model; PilarPrep isolates each customer's approved context, memory, state, policies, and artifacts."

### 13:00-15:00 - Evidence and close

Show the CloudWatch dashboard with router/tool invocations and sanitized trace IDs. Mention that a cross-client test is part of the suite and the public role can access only BlueMesa.

Close: "PilarPrep shortens meeting preparation, but the larger value is continuity. It turns a reviewed customer conversation into governed project memory that sales, executives, delivery, and new team members can actually use."

## Fallback branch

If AgentCore fails, continue the presentation. The router calls the existing Lambda and the UI identifies the response as the Bedrock Lambda fallback. The approved brief and DynamoDB state are not discarded. If AWS access is broadly unavailable, use:

```powershell
npm.cmd run agentcore:demo
```

That local path runs the same BlueMesa handoff followed by a new-member catch-up with in-memory Gateway and Memory doubles.

## Judge questions

**Is there a separate model per customer?**
No. Bedrock manages the model. PilarPrep stores customer-specific prompts, policy, approved evidence, memory identifiers, state, and artifact prefixes.

**Can one customer read another customer's data?**
The router derives tenant/user identity, checks client/project assignment, signs the scope, and every tool verifies it before constructing a key. Cross-client tests reject both browser overrides and tampered tool requests.

**Why AgentCore instead of only Lambda?**
Loop 1 is a bounded generation request and stays on Lambda. Loop 2 benefits from session memory, governed tools, multi-step orchestration, and agent-specific observability.

**What is authoritative if memory and DynamoDB disagree?**
DynamoDB. Memory improves continuity but cannot directly update authoritative registers.

**How is cost controlled?**
Everything is request driven. Micro is available for rehearsals, Pro is used for the quality run, Memory expires after seven days, logs expire after fourteen days, and there is no VPC/NAT or provisioned model capacity.
