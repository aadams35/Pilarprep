# Authorized Agentic RAG Design

Status: generalized tenant evidence ingestion and brief retrieval are implemented
and locally tested. Live Knowledge Base ingestion and retrieval must be verified
after deployment.

## Why this is not GraphRAG

PilarPrep currently needs two kinds of knowledge:

1. Unstructured customer evidence that benefits from semantic retrieval.
2. Structured, authoritative project registers such as decisions, risks, actions,
   owners, milestones, versions, and approval state.

Bedrock Knowledge Bases plus S3 Vectors serves the first need. DynamoDB serves the
second. Adding a graph database would create another consistency and authorization
surface without a demonstrated relationship-traversal requirement. GraphRAG remains
an evaluation candidate, not a portfolio checkbox.

## Ingestion contract

Evidence management is available only to verified workspace users. A source can be
entered as bounded text, uploaded as PDF, DOCX, TXT, Markdown, JSON, CSV, or HTML,
or captured from one user-approved HTTPS URL. Uploads and URL responses are limited
to 5 MB. Pasted text retains the smaller API contract limit.

URL capture is not web crawling. It retrieves only the URL approved by the user.
The server enforces HTTPS, an eight-second timeout, a three-redirect limit, content
type and size allowlists, and public-address resolution. Private, loopback,
link-local, reserved, and cloud metadata targets are rejected. DNS rebinding
protection should be strengthened before production by pinning the validated IP to
the outbound connection or by moving URL acquisition to a governed fetch service.

Each document includes:

- tenantId, clientId, and projectId from trusted identity scope
- documentId and version
- documentType
- source label and title
- approved/status/visibility metadata
- uploadedAt and approvedAt timestamps
- contentTrust=untrusted-evidence
- sourceId, sourceType, sourceLocation, capturedAt, and freshness
- approvedBy, accessScope, and lifecycleStatus

Storage:

~~~text
evidence/tenants/{tenantId}/clients/{clientId}/projects/{projectId}/
  documents/{documentId}/{filename}
  documents/{documentId}/{filename}.metadata.json
~~~

The content object and metadata sidecar are encrypted and private. A DynamoDB
EVIDENCE# record tracks INGESTING, INGESTION_PENDING, AVAILABLE, DELETING,
DELETION_PENDING, and failure states.

The data source includes only evidence/. Parsing and chunking are currently
service-managed defaults because the template does not specify a custom strategy.
Titan Text Embeddings v2 creates 1,024-dimensional FLOAT32 vectors in S3 Vectors.

## Retrieval policy

The client cannot supply a Knowledge Base ID or metadata filter. The unified brief
worker and AgentCore runtime read the configured ID from their environments and
build one of two server policies:

Guest Blue Mesa:

- scenarioId=blue-mesa-payments
- approved=true
- visibility=public-demo

Authenticated workspace:

- exact tenantId
- exact clientId
- exact projectId
- approved=true
- status=approved
- visibility=tenant-private

Brief retrieval is bounded to six results. Every returned result is checked again against
the expected metadata. Missing metadata or any mismatch rejects the retrieval and
emits a cross-scope security metric.

## Prompt-injection resistance

Retrieved text is labeled untrusted evidence. It cannot:

- change system instructions
- expand tenant scope
- select a model or tool
- authorize a write
- invent an approved source label
- override the authority order
- bypass human approval

The model receives allowed source labels separately. Generated citations must use
those labels. Retrieved storage locations and tenant IDs are not exposed to the UI.

## Claims, citations, and freshness

The normalized packet contains a source catalog and claim ledger. Each source has a
stable sourceId. Each material brief paragraph becomes a claim with section,
itemIndex, sourceIds, evidenceStatus, an evidence snippet, and validation status.
Source IDs are resolved only from the server-authorized catalog.

The evidence statuses are:

- supported
- partially-supported
- customer-provided
- assumption
- conflicting-evidence
- needs-validation

Evidence coverage is deterministic: claims with at least one valid source divided by
all material claims. It is explicitly not a model confidence score or probability of
truth. Legacy packets keep an empty source catalog and display Evidence not recorded.

The normalized retrieval result contains only:

- sourceTitle
- documentType
- bounded excerpt
- approval status
- approved/uploaded timestamp
- relevance score
- contentTrust

Generation metadata reports retrieval mode and result count. JSON artifacts retain
the full source and claim contracts. DOCX exports add source notes, evidence coverage,
and an evidence register. The evaluation suite measures citation completeness,
unsupported claims, and cross-client isolation.

## Deletion and re-index

Re-index starts a new Knowledge Base ingestion job and keeps the record visible.
Delete removes source objects and starts ingestion synchronization. The application
does not report DELETED until the Knowledge Base confirms completion. Failed status
checks and failed ingestion remain visible and alarmable.

## Failure behavior

- Missing Knowledge Base configuration: RAG is explicitly disabled in metadata.
- Guest custom client: no private RAG call.
- Retrieval service failure: job fails; no silent demo evidence.
- Metadata mismatch: hard authorization failure and alarm.
- Empty results: model must use approved packet/project state and label unknowns.
- Ingestion failure: evidence remains unavailable and can be re-indexed after review.

## Evaluation gates

Before changing chunking, embeddings, result count, reranking, or adding GraphRAG,
measure:

- authorized retrieval precision
- cross-tenant false positives (required zero)
- citation correctness
- unsupported-claim rate
- additional-direction coverage
- meeting-to-handoff consistency
- latency and token impact
- estimated cost per action
