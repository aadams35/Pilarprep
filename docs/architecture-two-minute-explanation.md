# PilarPrep Architecture: Two-Minute Explanation

Use this while showing the diagram in
[`unified-jobs-architecture.md`](unified-jobs-architecture.md).

## 0:00-0:25 - Start at the user boundary

"PilarPrep is a React application delivered over HTTPS by CloudFront from a
private S3 origin. The browser receives short-lived AWS credentials from
Cognito and signs calls to one IAM-protected API. The S3 buckets are not public,
and users cannot bypass CloudFront to read the application or customer files."

## 0:25-0:55 - Explain the durable job pipeline

"The Jobs API validates the caller and project scope, writes a short-lived job
record and input document, and sends only a pointer to an encrypted SQS queue.
It returns immediately, while one unified worker processes each job. SQS gives
us retries, back-pressure, and a dead-letter queue without duplicate router and
worker paths. Conditional DynamoDB writes make at-least-once delivery safe."

## 0:55-1:25 - Explain both AI loops

"For generation and refinement, the worker invokes Bedrock Nova with Guardrails.
Refinement regenerates the complete selected tab, removes contradictions, and
leaves every other tab untouched. After approval, handoff and catch-up go to
AgentCore. The agent uses scoped memory and governed tools; handoff can update
project state, while catch-up is enforced as read-only."

## 1:25-1:50 - Explain data and isolation

"One DynamoDB table stores jobs, approvals, latest pointers, project state,
client directory entries, and idempotency. One private S3 bucket stores the
latest JSON and DOCX packet plus short-lived job payloads. Every key includes
tenant, client, and project scope, and the API also checks user and session
ownership before returning a job."

## 1:50-2:00 - Close

"Bedrock manages the foundation model; PilarPrep does not store a model per
customer. We isolate each customer's approved context, prompts, memory scope,
state, and artifacts. The result is a simpler, durable, request-driven system
that stays inexpensive at demo traffic."
