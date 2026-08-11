# Demo Day Readiness Checklist

Use this before sharing the CloudFront URL or walking into the hackathon demo.

## Local Confidence

- `npm run verify:demo` passes locally.
- The app opens at `http://localhost:3002/` without layout overlap on the main flow.
- `Generate brief + project model` works in fallback mode with no AWS credentials.
- `Copy packet` copies a useful handoff summary after generation.

## AWS Confidence

- Backend stack is deployed in `us-east-1`.
- Frontend stack is deployed to CloudFront and points at the latest backend outputs.
- Bedrock model access is enabled for `us.amazon.nova-micro-v1:0`.
- Unsigned API calls return `403 Forbidden`.
- Browser live mode returns `provider=bedrock` and includes `artifactKey`, `projectId`, and `stateKey` metadata.
- CloudWatch dashboard shows recent request and success metrics.
- AWS Budget guardrail exists with the demo limit, defaulting to `1 USD/day`.

## Demo Flow

- Start with `Apex Mutual` for the cleanest executive modernization story.
- Use `Reduce AWS jargon` to show the refinement loop.
- Use the Project model `PM` role to show implementation follow-through.
- End on AWS value: managed model, no stored foundation model, IAM-secured API, S3 artifacts, DynamoDB state, and Knowledge Bases/Strands as the Phase 2 expansion.

## Fallback Plan

If Bedrock access or AWS networking misbehaves, switch to fallback mode and continue the same story. The deterministic provider still demonstrates the full product loop, including briefs, stakeholder context, project artifacts, and handoff packet copying.