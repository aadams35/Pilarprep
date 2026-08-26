# Data Lifecycle

## Data classes

| Class | Store | Default lifecycle | Authority |
| --- | --- | --- | --- |
| Static frontend | Private S3 | Replaced by deploy; versioned by build | Application code |
| Job input/result | Artifact S3 jobs/ | Expires after 1 day | Transient |
| Job record | DynamoDB JOB# | TTL after 1 hour unless extended continuation state applies | Operational |
| Usage counter | DynamoDB USAGE# | TTL after its enforcement window | Operational |
| Idempotency record | DynamoDB IDEMPOTENCY# | 7 days | Operational |
| Draft brief | Artifact S3 draft/latest | Latest pointer and current versions | Non-authoritative |
| Approved workspace brief | Artifact S3 approved/vNNNNNN | Immutable; retained | Authoritative |
| Guest artifacts | Artifact S3 tenant prefix with tag | Expires after 7 days | Temporary synthetic |
| Handoff | Artifact S3 handoff/latest | Latest usable copy; source approval recorded | Derived |
| Project state | DynamoDB PROJECT#STATE and registers | Retained; PITR protected | Authoritative after approval |
| Pending meeting proposal | DynamoDB | 2-day TTL | Non-authoritative |
| Approved meeting changes | DynamoDB | TTL removed on approval | Authoritative |
| Transcript object | Meeting evidence S3 transcripts/ | 2 days; noncurrent 1 day | Temporary evidence |
| Tenant evidence | Meeting evidence S3 evidence/ | Retained until authorized deletion | Approved evidence |
| Evidence vector | S3 Vectors | Retained until ingestion/deletion sync | Search index |
| Agent memory events | AgentCore Memory | 7-day expiry | Conversational context |
| Logs | CloudWatch | 14 days | Operational |
| DLQ message | SQS DLQ | 14 days | Failure recovery |

## Approved brief lifecycle

1. Generation creates a scoped draft and BRIEF#LATEST metadata.
2. Refinement regenerates only the selected tab from authoritative context and marks
   any prior approval stale.
3. Approval verifies expected packet version and current draft.
4. JSON and DOCX are written with If-None-Match to an immutable version directory.
5. SHA-256 digests and object version IDs are recorded.
6. A DynamoDB transaction writes the immutable approval audit and latest pointer.
7. Handoff requires the current packet version to equal the approved version.
8. Catch-up reads the latest approved server-side packet and must not write state.

Authenticated approved versions are not governed by the latest-only purge. The bucket
has Retain and UpdateReplacePolicy Retain. Guest objects carry a lifecycle tag and
expire after seven days.

## Evidence lifecycle

1. Verified workspace user submits approved text plus title, source, and type.
2. API stores content under the exact tenant/client/project/document prefix.
3. A metadata sidecar marks tenant, client, project, status, approval, visibility,
   version, source, and content trust.
4. DynamoDB records INGESTING or INGESTION_PENDING.
5. Bedrock Knowledge Bases parses/chunks and writes vectors to S3 Vectors.
6. Status polling moves the record to AVAILABLE or INGESTION_FAILED.
7. Re-index starts a new ingestion job without changing scope.
8. Delete removes source objects, starts sync, and remains DELETING until service
   confirmation; failures remain visible.

The application does not claim deletion complete before Knowledge Base synchronization.

## DynamoDB protection

- One on-demand table
- Customer-managed KMS key when enabled
- Point-in-time recovery enabled
- Deletion protection enabled
- Conditional writes for versions, usage, idempotency, and replay
- TTL only on explicitly temporary records
- Approved meeting state removes pending TTL

## S3 protection

- Public access blocked
- TLS-only bucket policies
- Versioning enabled
- Customer-managed KMS key when enabled
- Immutable approved keys use conditional writes
- Presigned downloads expire and are never logged
- Job and transcript lifecycle rules are prefix-scoped
- Guest lifecycle uses an explicit object tag

## Restore and deletion

DynamoDB can be restored from PITR into a new table. S3 object versions and immutable
approved keys support artifact recovery. A production restore drill must verify that
latest pointers, approval audit records, and artifact hashes still agree.

Tenant deletion is not yet a one-click workflow. Production work must include a
reviewed export, legal hold check, evidence deletion/ingestion synchronization,
artifact purge, DynamoDB partition deletion, Memory deletion, and auditable completion.
