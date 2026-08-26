# PilarPrep Presentation Talk Track

Architecture narration: [Two-minute architecture explanation](architecture-two-minute-explanation.md)

## 30-second version

PilarPrep helps Solutions Architects prepare faster and hand off cleaner. The first loop creates and refines technical and executive meeting briefs. The second loop turns the approved brief and meeting outcomes into governed project state, a delivery handoff, and role-aware catch-up for sales, executives, PMs, engineers, and new team members.

## 90-second judge story

The problem is not only writing a meeting brief. Discovery context often disappears after the meeting, which forces delivery teams to rediscover what sales already learned. PilarPrep protects that context with two connected loops.

Loop 1 remains intentionally simple: a React frontend on private S3 and CloudFront sends an IAM-signed request through API Gateway to Lambda. Lambda invokes Amazon Bedrock Nova with Guardrails, stores the latest approved JSON and DOCX in private S3, and records metadata in DynamoDB.

Loop 2 is where AgentCore adds value. A router derives the tenant and user from the AWS identity and queues a scoped job; a separate worker signs the short-lived project scope and invokes a Strands agent in AgentCore Runtime without API Gateway timeout risk. AgentCore Memory carries the conversation, while five Gateway tools read the approved brief and conditionally update authoritative DynamoDB state. The model never receives open S3 or DynamoDB access. If AgentCore fails, the existing Lambda path remains available.

PilarPrep does not store a model per customer. Bedrock manages the model; PilarPrep isolates each customer's approved evidence, policies, memory identifiers, state, and artifacts.

## Strong closing

The first loop helps the SA win the meeting. The second loop prevents the team from losing what made the meeting valuable.