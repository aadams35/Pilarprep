# Legacy Retirement Inventory

Status: active browser traffic has been consolidated in source, while the
hardened identity, edge, RAG, approval, and operations changes on this branch
remain pending live release verification. No deployed rollback resources were
deleted.

Canonical target architecture: `docs/portfolio-architecture.md`.

## Removed from the active source path

| Item | Disposition | Reason |
|---|---|---|
| Browser Brief API client and poller | Removed | All brief actions use `POST /jobs` and scoped job polling |
| Browser Agent API client and poller | Removed | Handoff and catch-up route through the unified worker |
| Legacy frontend API feature flag | Removed | There is one supported production transport |
| Legacy Brief and Agent API build variables | Removed | They were absent from the active production request path |
| Local server proxy to the old Brief API | Removed | The local route is demo-only; live browser calls use Jobs API |
| Fake timed generation stages | Removed | Status now follows queued, running, complete, and failed job state |

## Retained for rollback or shared execution

| Item | Why it remains |
|---|---|
| `pillarprep-bedrock` Brief API and direct worker resources | Deployed rollback infrastructure; removal is destructive and needs explicit approval |
| `pillarprep-agentcore` Agent API, router, and worker resources | Deployed rollback infrastructure; removal is destructive and needs explicit approval |
| `backend/generation/brief_engine.py` | Active owned generation boundary used by the unified worker |
| `backend/bedrock_lambda/app.py` | The new generation boundary still adapts lazily to this prompt, validation, normalization, and DOCX implementation; full extraction is required before deleting its stack package |
| `backend/agentcore/router/app.py` | Supports the retained rollback stack and its smoke tests |
| Legacy direct-path smoke scripts and historical runbooks | Needed to prove rollback health until the resources are formally retired |

## Production bundle check

The AWS build must contain `VITE_PILLARPREP_JOBS_API_URL` behavior and must
not contain a Brief API URL, Agent API URL, `requestLiveBrief`, or
`requestLiveAgent`. The deployment may inject only non-secret configuration:
the bounded guest Jobs URL, CloudFront workspace API path, Region, Identity
Pool ID, User Pool ID/client ID, and hosted login domain. It must not embed
credentials, tenant mappings, origin-verification secrets, or artifact URLs.

## Retirement gates

| Gate | Required evidence | Current state |
|---|---|---|
| Replacement path | Guest generation/refinement and authenticated generation/refinement/handoff/catch-up pass through the public HTTPS application | Pending live verification |
| Shared code extraction | Prompt, validation, normalization, and DOCX implementation are owned by `backend/generation/`, with no active import from `backend/bedrock_lambda/app.py` | Pending |
| Traffic soak | CloudWatch shows no legitimate requests to legacy Brief or Agent APIs for the agreed retention period | Pending |
| Rollback artifact | Last known-good stack templates and release tag are retained and restoration is rehearsed | Pending |
| Data safety | Immutable approvals, latest pointers, retention, backup, and restore tests pass | Pending live verification |
| Approval | Owner explicitly approves destructive CloudFormation change sets | Pending |

## Before deleting deployed legacy resources

1. Deploy and complete the release verification report for the hardened path.
2. Confirm the public bundle has used only the Jobs API for an agreed retention period.
3. Verify CloudWatch shows no legitimate calls to the direct Brief or Agent APIs.
4. Export any logs or rollback evidence the team must retain.
5. Move the full shared Bedrock implementation behind `backend/generation/` and remove the active dependency on `backend/bedrock_lambda/app.py`.
6. Run all unit, contract, security, quality, and live smoke tests after extraction.
7. Prepare and inspect CloudFormation change sets without executing them.
8. Confirm retained KMS keys and S3/DynamoDB data will not be deleted.
9. Obtain explicit approval for the destructive removal.
