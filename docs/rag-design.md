# Authorized Agentic RAG Design

Status: generalized tenant evidence workflow implemented and locally tested. Live
Knowledge Base ingestion and retrieval must be verified after deployment.

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

Evidence management is available only to verified workspace users. Supported text
formats are TXT, Markdown, JSON, and CSV, with a 120 KB application limit.

Each document includes:

- tenantId, clientId, and projectId from trusted identity scope
- documentId and version
- documentType
- source label and title
- approved/status/visibility metadata
- uploadedAt and approvedAt timestamps
- contentTrust=untrusted-evidence

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

The client cannot supply a Knowledge Base ID or metadata filter. The AgentCore runtime
reads the configured ID from its environment and builds one of two server policies:

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

Retrieval is bounded to six results. Every returned result is checked again against
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

## Citations and freshness

The normalized result contains only:

- sourceTitle
- documentType
- bounded excerpt
- approval status
- approved/uploaded timestamp
- relevance score
- contentTrust

Generation metadata reports source freshness and retrieval count. The evaluation
suite measures citation/evidence completeness and unsupported claims.

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
