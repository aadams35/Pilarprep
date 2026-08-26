# PilarPrep Architecture Speaker Guide

Editable diagram: https://www.figma.com/board/OrxC26EJgvMQoj7idSE70e

## 30 seconds

PilarPrep accepts customer context in React, obtains short-lived Cognito credentials, and signs an IAM-authorized job request. The Jobs API stores the full input privately, records the job in DynamoDB, and queues only an S3 pointer. A unified Lambda worker invokes Bedrock with Guardrails, validates the packet, and stores JSON and DOCX. The browser polls until completion. After approval, AgentCore uses governed tools and memory for handoff and role-aware catch-up.

## 2 minutes

CloudFront and WAF serve the application from private S3 through OAC. The public demo still uses AWS authorization: Cognito issues short-lived credentials, the browser signs each request with SigV4, and API Gateway enforces AWS_IAM.

The Jobs API validates tenant, client, project, user and session scope. It stores the full input in private S3, creates job and idempotency records transactionally in DynamoDB, and sends only routing information plus an S3 pointer to SQS.

SQS invokes one worker with controlled concurrency. DynamoDB grants a processing lease so duplicate delivery does not repeat Bedrock work. The worker resolves Nova Pro, Nova Micro or Claude Sonnet 4.6. Claude uses three routes, then validation checks JSON, completeness, questions, citations, contradictions and additional direction. Valid output becomes JSON and DOCX; invalid output gets a focused repair or fails without replacing the previous packet.

The user refines one tab at a time. Approval creates the authoritative packet. AgentCore retrieves that packet and project state through governed tools. Handoff writes state and artifacts; catch-up is read-only.

## 5 minutes

1. Explain CloudFront, WAF, OAC and private S3.
2. Explain anonymous demo identity versus named production login.
3. Walk POST /jobs, server-side scope and pointer-only SQS.
4. Explain at-least-once delivery, DynamoDB lease and idempotency.
5. Show model resolution, Guardrails and Claude section routing.
6. Show validation, repair, merge and packet persistence.
7. Explain polling, selected-tab refinement and approval.
8. Explain AgentCore tools, memory and read/write boundaries.
9. Close with CloudWatch and the visibility-timeout gap.

## Status legend

- Verified: deployed services, settings, models, queue behavior, validation and storage.
- Inferred: CloudFront WAF does not protect the execute-api hostname.
- Recommended: named login, claims-based tenancy, custom API domain, tighter SQS visibility or heartbeat, KMS and formal retention.

## Export note

The FigJam file is fully editable. Its architecture renderer uses categorized service shapes and verified AWS labels rather than the official AWS icon library. Add official AWS icons in Figma or PowerPoint for the final interview slide.
