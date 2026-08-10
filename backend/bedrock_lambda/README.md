# PillarPrep Bedrock + Strands Backend

This folder is the AWS implementation target for the demo front end.

Recommended v1 path:

1. API Gateway receives `/brief` requests from the React app.
2. Lambda validates the request and builds the prompt contract.
3. Amazon Bedrock generates the structured pre-brief and Phase 2 handoff artifacts.
4. S3 stores approved brief artifacts.
5. DynamoDB tracks project state, feedback, owners, and timestamps.
6. Bedrock Knowledge Bases ground the follow-on Project Brain.
7. Strands can be added as the agent layer when Project Brain needs tools.

Why Bedrock first:

- It is the shortest AWS-native path to generated briefs, refinement, guardrails, and Knowledge Bases.
- It avoids training or hosting custom models.
- It gives the hackathon demo a clean managed-AI story.

Why Strands second:

- Use it when Project Brain needs agent behavior: tool calls, role-specific workflows, implementation planning, and multi-step follow-through.
- Keep the first brief-generation loop simple until the Bedrock prompt contract is stable.

SageMaker is intentionally out of scope for v1 because PillarPrep is not training, fine-tuning, or hosting a custom model.


For the fastest hackathon path, use `docs/aws-lambda-demo-runbook.md` from the repository root.
