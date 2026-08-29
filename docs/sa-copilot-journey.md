# PilarPrep SA Copilot Journey

Status: implemented, locally verified, and deployed to the PilarPrep AWS demo
environment from `feature/agentic-rag-meeting` on 2026-08-28.

## Product journey

PilarPrep presents one client workspace with five stages:

| Stage | User outcome | Existing capabilities used |
| --- | --- | --- |
| Research | Capture approved facts, people, values, documents, and URLs | Customer intake, stakeholder profiles, evidence workspace, Knowledge Base ingestion |
| Insights | Align on the business scenario, desired outcomes, risks, and priorities | Business case, executive brief, ranked AWS pillars |
| Discovery | Expose assumptions, unknowns, evidence gaps, and architecture questions | Technical brief, discovery questions, source statuses, refinement |
| Meet | Align the team, upload the synthetic call, and review what the evidence changes | Pre-call handoff, private audio upload, transcription, proposed changes, human review |
| Follow-up | Use approved meeting evidence to plan the next conversation | Governed handoff, catch-up, opportunity gates, and next-call preparation |

The journey header shows the current client, packet version, evidence coverage,
validation needs, latest output, and next recommended action. Old saved stage IDs are
mapped to the new five-stage model when browser state is restored.

## Continuous loop

1. Research and approved evidence ground a new packet.
2. The user reviews Insights and Discovery, then refines one selected tab at a time.
3. Approval creates the pre-call handoff and opens Meet.
4. A signed-in user explicitly uploads the synthetic BlueMesa call. Meeting-derived
   updates remain proposed until every item is accepted, edited, or rejected.
5. Only accepted or edited statements become durable meeting context and project
   memory.
6. Prepare next call returns to Research with the approved packet and accepted meeting
   context preserved. A new packet version is generated without overwriting history.

## Source contract

Every source record contains:

```text
sourceId, tenantId, clientId, projectId, sourceType, title,
sourceLocation, capturedAt, freshness, approvedBy, evidenceSnippet,
accessScope, lifecycleStatus
```

Private document bodies remain in S3. DynamoDB stores state, lifecycle metadata, and
pointers. Bedrock Knowledge Bases indexes approved evidence under metadata that is
scoped to tenant, client, and project. Public guest retrieval is limited to the
synthetic Blue Mesa scenario.

## Claim contract

Each material brief paragraph is represented as:

```text
claimId, section, itemIndex, text, sourceIds, evidenceStatus,
evidenceSnippet, validationStatus
```

Citation buttons resolve source IDs against the packet source catalog and open a
drawer with the source title, excerpt, source type, capture date, freshness, approver,
and access scope. Unknown source IDs are removed by frontend migration logic and
rejected by server-side generation validation.

Evidence coverage is calculated as:

```text
claims with at least one valid approved source / all material claims
```

It measures linkage, not truth probability. An unsupported claim must be an explicit
assumption, a conflict, or a validation need.

## Grounded generation

The jobs worker builds a bounded retrieval query from the authorized customer input,
ranked pillars, additional direction, meeting notes, and selected refinement feedback.
It retrieves up to six records using a server-owned Knowledge Base ID and metadata
filter. Every result is checked again after retrieval.

The model receives approved source records, never a client-selected filter. Generated
labels must match the server allowlist. Existing contradiction, additional-direction,
required-section, and target-isolation checks still run. A malformed response may use
one schema repair followed by at most one focused content repair. An invalid result is
then rejected and the previous version is preserved.

## Human governance

Meeting intelligence remains proposed until a person reviews every item. Reviewers can
accept, edit, or reject each update. The server records the approved disposition and
only accepted or edited statements reach project state, handoff output, catch-up, and
the next meeting cycle. Ordinary stakeholder names remain available inside the private
workspace because they are operational context.

## Security boundaries

- IAM and Cognito scope every API request.
- Private S3 holds artifacts, source bodies, and meeting audio.
- Queue messages contain routing and protected pointers rather than source bodies.
- Knowledge Base retrieval uses exact tenant/client/project metadata filters.
- GuardDuty scans uploaded meeting audio for malware.
- Bedrock Guardrails govern model input and output safety.
- The evidence URL path enforces HTTPS, bounded redirects, type/size limits, and public
  address resolution.
- No source excerpt, customer text, or signed object URL is written to metrics.

## Compatibility

Blue Mesa, custom scenarios, saved briefs, target-isolated refinement, handoff,
catch-up, JSON, and DOCX use their existing contracts. Audio is intentionally limited
to a signed-in BlueMesa workspace. New provenance fields are
optional at the migration boundary. Legacy packets remain readable and display
Evidence not recorded.

## Deployment verification

1. The backend, jobs pipeline, AgentCore, and frontend stacks reached
   `UPDATE_COMPLETE`.
2. Approved Blue Mesa evidence was re-indexed with required metadata.
3. The live Nova Pro journey completed generation, Business Case refinement,
   Objection refinement, approval, AgentCore handoff, read-only catch-up, client
   listing, and DOCX download.
4. The live test confirmed IAM signing, unsigned-request denial, cross-client denial,
   and blocked direct S3 access.
5. The public site returns HTTPS security headers and redirects HTTP to HTTPS.
6. CloudWatch and queue health should continue to be reviewed before broader access.

## Remaining risks

- Live Knowledge Base metadata must be verified after deployment; local tests use
  controlled retrieval responses.
- URL acquisition validates DNS before opening the connection, so stronger DNS
  rebinding protection is recommended for production.
- Source linkage proves that a claim references approved evidence; it does not prove
  that the evidence itself is correct or that the claim is a perfect interpretation.
- Retrieval quality still needs an evaluation corpus before changing chunking,
  embeddings, result count, or reranking.
- The current recommendation engine is deterministic and context-aware. A future
  release can rank recommendations more deeply after grounded-evaluation data exists.
- The dead-letter queue retains historical failed test jobs. Inspect and archive or
  purge those records separately rather than replaying stale refinements.

## Verification

The current implementation passed 67 Bedrock Lambda tests, 120 jobs-pipeline tests,
79 AgentCore tests with one expected skip, 48 frontend and contract tests, and 13
Playwright workflows. Lint and production builds also pass. The deployed routes deny
unsigned workspace audio requests and direct S3 access; the signed-in browser workflow
is covered end to end by Playwright.
