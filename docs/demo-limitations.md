# Demo Limitations

This is a portfolio demonstration moving toward multi-tenant design, not a production
customer system.

## Deliberate limits

- Guest mode is for synthetic scenarios only.
- Blue Mesa is the only prepared meeting/audio workflow, and audio requires a signed-in workspace.
- Evidence upload supports small text formats, not arbitrary office files or PDFs.
- Parsing/chunking uses the Bedrock data source default.
- GraphRAG is not implemented because vector retrieval plus structured state meets
  the demonstrated decisions.
- No real LinkedIn scraping or automated executive profiling.
- No mobile optimization commitment.
- No customer-facing administration portal for tenant/client assignment.
- No cross-region active/active or disaster-recovery deployment.
- No private VPC endpoints; AWS managed service APIs use TLS public endpoints.
- No Terraform; AWS SAM/CloudFormation remains the source of truth.
- Legacy Brief and Agent resources remain for rollback.
- CloudTrail S3 data events are not enabled by default; GuardDuty malware scanning is enabled for quarantined meeting uploads.
- WAF managed groups begin in count mode except the rate-block rule.
- Cognito MFA is optional, not mandatory.
- Authenticated users without explicit client claims currently receive only the
  synthetic demo client fallback inside their personal tenant.
- AgentCore Memory is short-lived context, not an authoritative project database.
- Catch-up is read-only and cannot replace project management governance.
- Presigned DOCX downloads are time limited but transferable during their lifetime.

## Data policy

Do not enter real customer names, confidential architecture, credentials, personal
data, regulated data, contracts, or meeting recordings in the public portfolio demo.
Use the prepared scenarios or clearly synthetic custom context.

## Live-verification status

The repository proves local contracts and policy shape. Until a post-change live
smoke report exists, do not claim that the current branch has proven:

- User Pool sign-in and claim assignments
- CloudFront origin-secret rejection
- KMS permissions on every active write
- tenant Knowledge Base ingestion/retrieval
- safe DLQ replay
- WAF association and headers
- direct S3 denial after the latest stack update

## Interview phrasing

Use: "This is a constrained public demo with production-oriented trust boundaries.
The architecture deliberately separates synthetic guest access from verified
workspaces, but enterprise onboarding, content scanning, audit data events, and
disaster recovery are roadmap items."
