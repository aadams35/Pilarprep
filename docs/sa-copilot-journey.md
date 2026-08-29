# PilarPrep SA Copilot Journey

Status: implemented and locally verified on `feature/agentic-rag-meeting`. This
document describes the target release; no AWS deployment or GitHub push was performed
as part of this change.

## Product journey

PilarPrep presents one client workspace with five stages:

| Stage | User outcome | Existing capabilities used |
| --- | --- | --- |
| Research | Capture approved facts, people, values, documents, and URLs | Customer intake, stakeholder profiles, evidence workspace, Knowledge Base ingestion |
| Insights | Align on the business scenario, desired outcomes, risks, and priorities | Business case, executive brief, ranked AWS pillars |
| Discovery | Expose assumptions, unknowns, evidence gaps, and architecture questions | Technical brief, discovery questions, source statuses, refinement |
| Meeting prep | Approve the packet and align everyone before the call | Decision-maker lens, objection prep, game plan, pre-call handoff |
| Follow-up | Review meeting evidence, update project truth, and plan the next conversation | Audio workflow, transcription, proposed changes, human review, handoff, catch-up |

The journey header shows the current client, packet version, evidence coverage,
validation needs, latest output, and next recommended action. Old saved stage IDs are
mapped to the new five-stage model when browser state is restored.

## Continuous loop

1. Research and approved evidence ground a new packet.
2. The user reviews Insights and Discovery, then refines one selected tab at a time.
3. Approval creates the pre-call handoff and opens Meeting prep.
4. In Follow-up, meeting audio remains read-only until every proposed update is
   accepted, edited, or rejected.
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
required-section, and target-isolation checks still run. One focused model repair is
allowed; an invalid result is rejected after that attempt and the previous version is
preserved.

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
catch-up, audio, JSON, and DOCX use their existing contracts. New provenance fields are
optional at the migration boundary. Legacy packets remain readable and display
Evidence not recorded.

## Deployment plan

1. Review the local diff and architecture diagram.
2. Validate SAM templates and package dependencies.
3. Deploy the jobs pipeline and brief worker changes first.
4. Seed or re-index approved Blue Mesa evidence with required metadata.
5. Run live Blue Mesa and authenticated custom-client retrieval tests.
6. Deploy the frontend and invalidate CloudFront.
7. Verify generation, one-tab refinement, approval, handoff, catch-up, audio, human
   review, next-call regeneration, JSON, and DOCX.
8. Monitor cross-scope metrics, failed ingestion, queue age, DLQ depth, Bedrock errors,
   and citation-validation failures before broader access.

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

## Local verification

The implementation has been verified locally with backend unit tests, frontend
contract tests, brief-quality evaluations, lint, production builds, strict SAM
template validation, and Playwright coverage for the five-stage journey, evidence
drawer, meeting intelligence, reduced motion, responsive overflow, and human review.
No AWS deployment or GitHub push was performed as part of this change.
