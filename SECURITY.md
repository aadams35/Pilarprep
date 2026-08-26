# Security Policy

## Public demo boundary

The public PilarPrep environment is a bounded demonstration system. Use only synthetic data. Do not submit customer recordings, credentials, regulated data, personal data, confidential notes, or production architecture details.

## Controls

- HTTPS-only CloudFront delivery
- Private frontend and artifact S3 buckets
- CloudFront Origin Access Control
- WAF rate controls
- Cognito temporary credentials and optional user-pool sign-in
- IAM-authorized API Gateway routes
- Server-derived tenant and user scope
- Least-privilege Lambda and AgentCore roles
- SQS messages containing pointers rather than full packets
- DynamoDB conditional writes and idempotency records
- Bedrock Guardrails and deterministic output validation
- Human approval before meeting evidence changes project state
- CloudWatch logs, metrics, alarms, and trace identifiers

## Known demo limitations

Guest identities are suitable for a public portfolio demo but are not a complete enterprise tenant model. A production deployment should require authenticated users, map users to organizations and projects, enforce administrator-managed membership, use customer-specific encryption and retention policies, and complete formal privacy and compliance reviews.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, customer information, or sensitive AWS identifiers. Contact the repository owner privately with:

- affected component
- reproduction steps
- expected impact
- suggested mitigation, if known

Never include live AWS credentials or session tokens in a report.
