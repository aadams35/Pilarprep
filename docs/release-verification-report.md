# PilarPrep Release Verification Report

Status: **Approved for the public demo on 2026-08-21; production identity and operator exercises remain.**

This report is the release gate for the hardened PilarPrep architecture. Record
only observed results. Do not paste credentials, tokens, signed URLs, customer
content, raw identity claims, or unredacted logs.

## Release metadata

| Field | Value |
|---|---|
| Release commit | Working tree based on `658500d`; release commit pending |
| AWS account | `...8431` |
| Region | `us-east-1` |
| Deployment profile/role | `pillarprep-deployer` / assumed deployment role |
| Verification start | `2026-08-21T17:09:47-07:00` |
| Verification owner | Austin Adams with Codex-assisted verification |
| Public URL | `https://pilarprep.app` |
| CloudFront distribution | `E3N3M69BO7PCI9` |
| Jobs stack | `UPDATE_COMPLETE` |
| AgentCore stack | `UPDATE_COMPLETE` |
| Base stack | `UPDATE_COMPLETE` |
| Frontend stack | `UPDATE_COMPLETE` |

## Local quality gates

| Gate | Command or evidence | Result |
|---|---|---|
| Frontend lint | `npm run lint` | PASS |
| Frontend unit/build | `npm test` | PASS: production build and 38 tests |
| Brief quality eval | `npm run eval:briefs` | PASS: 4/4 scenarios at 100/100 |
| Bedrock Lambda tests | `npm run lambda:test` | PASS: 56 tests |
| Jobs pipeline tests | `npm run pipeline:test` | PASS: 67 tests |
| AgentCore tests | `npm run agentcore:test` | PASS: 68 tests, 1 intentional skip |
| Playwright end-to-end | `npm run test:e2e` | PASS: 4 browser workflows |
| SAM validation | Base, Jobs, AgentCore, Frontend templates | PASS: strict lint on all four |
| Deployment script parse | All active PowerShell deploy scripts | PASS: 6 scripts |
| Patch hygiene | `git diff --check` | PASS; line-ending notices only |

## Live identity and tenant isolation

| Check | Expected observation | Result/evidence |
|---|---|---|
| Guest synthetic notice | Visible before generation | Pending |
| Guest allowlist | Arbitrary shared client/project IDs rejected | PASS: live signed boundary smoke |
| Guest identity isolation | Second identity cannot poll or download the first identity's data | PASS: live cross-client request returned `403` |
| Private-mode quota bypass | New browser session does not reset identity-based allowance | Pending |
| Workspace sign-in | Cognito authorization code + PKCE succeeds | Pending |
| Trusted workspace scope | Tenant/user/client scope derives from verified claims | Pending |
| Cross-tenant access | Non-revealing denial; metric emitted | Pending |
| Operator route | Non-operator JWT cannot replay DLQ | Pending |
| Premium model | Claude route allowed only for authorized tier/group | Pending |

## Live edge and data protection

| Check | Expected observation | Result/evidence |
|---|---|---|
| HTTPS | HTTP redirects to HTTPS | PASS: `301` to `https://pilarprep.frontend/app/`; HTTPS returned `200` |
| Security headers | HSTS, CSP, referrer, and content-type headers present | PASS: emitted by the CloudFront viewer-response function |
| Direct frontend S3 | Access denied | PASS: `403` |
| Direct artifact S3 | Access denied | PASS: `403` in brief and meeting smoke tests |
| Workspace API bypass | Direct execute-api call without origin proof rejected | PARTIAL: unsigned route denied; valid-JWT origin-proof test still required |
| Guest API boundary | Direct HTTPS IAM/SigV4 works only for bounded guest routes | PASS: signed smoke succeeded; unsigned request returned `403` |
| CORS | Unapproved production origin rejected | PASS: no allow-origin header; approved origin received the exact header |
| WAF | Managed rules and rate rule associated with CloudFront | PASS: four live rules, including the PilarPrep rate limit |
| Encryption | KMS active for table, queues, artifacts, evidence, and secret | PASS: customer-managed KMS key verified on all listed resources |
| Immutable approval | Versioned approved object cannot be overwritten | PASS: live versioned approval plus conditional/immutability tests |
| Audit history | Approver, source job, model/prompt/input versions, refinement, and citations recorded | PARTIAL: schema/tests pass; live audit inspection deferred to avoid exposing packet data |

## Live functional workflows

| Workflow | Required evidence | Result |
|---|---|---|
| Brief generation | Bedrock provider, complete packet, no deterministic fallback | PASS: live Nova Pro generation |
| Selected-tab refinement | Full target regenerated, correction applied, non-target tabs unchanged | PASS: business case and objections isolation verified live |
| Approval | New immutable version and latest pointer; prior version remains | PASS: approved packet v3 in the full pipeline smoke |
| Meeting processing | Synthetic MP3 transcribed; proposal remains unapproved | PASS: 27 transcript segments and review-ready proposal |
| Meeting approval | Timestamped disposition; handoff uses only approved evidence | PASS: 6 accepted and 1 rejected review item |
| Handoff | AgentCore tools called with authorized scope | PASS: provider `agentcore` |
| Catch-up | Latest approved packet used; project state remains unchanged | PASS: provider `agentcore`, read-only assertion passed |
| DOCX download | Authorized user receives expected named/versioned document | PASS: authorized download returned `200` |
| RAG ingestion | Tenant document reaches indexed state | PASS: Knowledge Base ingestion reached `COMPLETE` |
| RAG retrieval | Authorized citations returned; cross-scope evidence excluded | PASS: scoped meeting retrieval live; cross-scope rejection covered by tests |
| Evidence deletion/re-index | Lifecycle state and retrieval behavior update correctly | Pending authenticated workspace exercise |

## Reliability and operations

| Check | Expected observation | Result/evidence |
|---|---|---|
| Duplicate delivery | No duplicate artifact, approval, handoff, or state write | PASS: idempotency and conditional-write tests |
| Failed job | Bounded retries, useful failure reason, terminal state | PASS: retry and terminal-failure tests; live repair path exercised |
| DLQ arrival | Alarm and SNS notification fire | OBSERVED: 13 pre-fix messages retained; no new arrivals in the final verification window; alarm exercise pending |
| DLQ replay | Authorized, audited, idempotent, bounded replay succeeds | Pending |
| Poison message | Quarantined after maximum total attempts | PASS: bounded replay/quarantine tests; live exercise pending |
| Dashboard | API, auth, quota, queue, model, RAG, AgentCore, and cost panels populate | PARTIAL: dashboards deployed; visual review pending |
| Spend control | Quotas, model allowlists, kill switch, and anomaly alarm verified | PARTIAL: resources and tests verified; alarm exercise pending |
| Backup/restore | PITR confirmed; restore procedure rehearsed or explicitly deferred | PASS: PITR enabled; restore rehearsal deferred |

## Resource state and outputs

Record stack state, safe identifiers, and endpoint hostnames only. Mask account
numbers where practical. Do not record secret values or presigned signatures.

| Resource/stack | State | Safe output or observation |
|---|---|---|
| `pillarprep-bedrock` | `UPDATE_COMPLETE` | Shared table, artifact bucket, KMS key, identity pool |
| `pillarprep-agentcore` | `UPDATE_COMPLETE` | Runtime, Gateway, Memory, and governed tools |
| `pillarprep-jobs` | `UPDATE_COMPLETE` | Unified API, SQS/DLQ, worker, Cognito, and Knowledge Base |
| `pillarprep-frontend` | `UPDATE_COMPLETE` | Private S3, CloudFront, WAF, HTTPS, and CSP function |
| CloudFront invalidation | `Completed` | Final frontend bundle visible through the public domain |
| Cognito User Pool/client | Deployed | IDs retained only in stack outputs/build variables |
| Bedrock Knowledge Base | `ACTIVE` | Blue Mesa ingestion `COMPLETE` |
| KMS key | Enabled | Customer-managed key; rotation configured |
| Alarm topic | Deployed | `pillarprep-demo-operations-alerts` |

## Release decision

- [x] All required local gates pass.
- [ ] Guest and authenticated identity isolation are proven live.
- [ ] Quotas cannot be bypassed with browser-controlled values.
- [ ] Workspace API edge bypass is rejected.
- [x] Approved packet history is durable and auditable.
- [x] RAG retrieval is tenant-authorized and citation-bearing.
- [ ] DLQ recovery is bounded, authorized, audited, and idempotent.
- [x] Rollback path remains intact.
- [x] Remaining risks are documented for demo use.

Decision: **APPROVED FOR PUBLIC DEMO; NOT APPROVED AS A PRODUCTION MULTI-TENANT SERVICE**

Owner: Austin Adams

Timestamp: `2026-08-21T20:00:55-07:00`
