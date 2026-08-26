# PilarPrep Architecture

PilarPrep is an event-driven AWS serverless application with two GenAI paths:

- Amazon Bedrock generates and refines meeting briefs.
- AgentCore with Strands, memory, and governed tools creates handoff and catch-up context.

## Request path

```text
Browser
  -> CloudFront
  -> private S3 frontend
  -> Cognito temporary credentials
  -> IAM-signed API Gateway request
  -> Jobs API Lambda
  -> S3 input object + DynamoDB job record
  -> SQS
  -> unified AI worker
     -> Bedrock for brief generation/refinement
     -> AgentCore for handoff/catch-up
  -> DynamoDB state + private S3 JSON/DOCX artifacts
  -> browser polling and scoped download
```

## Meeting intelligence path

```text
Synthetic Blue Mesa audio
  -> private presigned S3 upload
  -> Amazon Transcribe
  -> agentic comparison with approved brief and RAG evidence
  -> proposed changes
  -> human accept/edit/reject review
  -> governed next-step handoff
```

## Key decisions

- SQS decouples API latency from model generation.
- DynamoDB stores state, approval pointers, version locks, idempotency, and job status.
- S3 stores large inputs, evidence, recordings, JSON, and DOCX artifacts.
- Bedrock foundation models are managed by AWS; model configuration and prompts are stored by the application, not model weights.
- AgentCore is used where memory and governed tools add value; direct brief generation remains a simpler Bedrock path.
- RAG evidence is synthetic and scenario-bounded for the public demo.

See `docs/README.md` for detailed diagrams, security boundaries, data lifecycle, costs, and operational runbooks.
