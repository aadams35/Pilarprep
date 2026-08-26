# Demo Day Readiness Checklist

Use this before publishing or presenting the AgentCore build.

## Local review gate

- npm run verify:demo passes.
- npm run lint passes.
- Both CloudFormation templates validate.
- npm run agentcore:demo prints a BlueMesa handoff followed by a new-member catch-up.
- The cross-client router and tool tests pass.
- git diff --check reports no whitespace errors.
- No real customer, credential, LinkedIn, or private profile data is present.

## AWS confidence

- Bedrock access is enabled for Nova Pro and Nova Micro in us-east-1.
- The brief stack is healthy before the separate AgentCore stack is deployed.
- Unsigned calls to /brief and /agent are denied.
- The public demo identity can select only BlueMesa Payments.
- The S3 frontend and artifact buckets both block public access.
- A live handoff returns provider=agentcore, a project version, trace ID, and latest DOCX URL.
- A forced Runtime failure returns the existing Lambda fallback and preserves the approved brief.
- CloudWatch shows sanitized router and tool events without brief text or credentials.
- Budget and service alarms are visible.

## Demo flow

- Use BlueMesa Payments.
- Refine and approve one pre-brief.
- Generate one confirmed AgentCore handoff with Nova Pro.
- Generate a New member catch-up, then an Executive catch-up in the same project session.
- Show the CloudWatch trace and explain the signed tenant/project boundary.
- End with the two-loop architecture and fallback.

## Fallback plan

If AgentCore is unavailable, continue with the existing Lambda fallback. If AWS access is unavailable, run npm run agentcore:demo and use the same BlueMesa story. The rollback build command is documented in [AgentCore Deployment and Rollback](agentcore-deployment.md).