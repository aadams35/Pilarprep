# PillarPrep Presentation Talk Track

## 30-Second Version

PillarPrep helps Solutions Architects prepare faster and hand off cleaner. A seller or SA enters customer context, ranks the AWS Well-Architected priorities, and gets two generated outputs: a technical brief for architecture discovery and an executive brief for business alignment. After the brief is reviewed, the same context becomes a Project model that gives PMs, engineers, sales, and executives a shared plan, risk register, stakeholder map, and follow-up email.

## 90-Second Judge Story

The problem is not just writing a meeting brief. The real pain is that discovery context often disappears after the meeting, forcing delivery teams and new project members to rediscover what sales already learned. PillarPrep fixes that with two loops: first a pre-brief refinement loop for the meeting, then a follow-on Project model loop for execution and handoff.

The AWS implementation is intentionally demo-ready and production-shaped. The React frontend is hosted from private S3 through CloudFront. The browser receives short-lived Cognito Identity credentials and signs API Gateway requests with IAM, so there is no browser API key. Lambda builds the prompt contract, invokes Amazon Bedrock, applies Bedrock Guardrails, stores approved artifacts in S3, and writes project state to DynamoDB. CloudWatch dashboards, alarms, and an AWS Budget give the team visibility and cost control.

The important architecture point is that PillarPrep does not store a foundation model. Bedrock manages the model. PillarPrep stores customer-specific configuration, approved artifacts, project state, and future retrieval memory. That means each client can have its own workspace, guardrail policy, prompt profile, and Knowledge Base without training or hosting a separate model.

## Client Login Explanation

For the public demo, access is intentionally simple: anyone with the CloudFront URL can use a limited Cognito demo identity that can invoke only the brief API. For a real customer rollout, the user would log in as themselves through Cognito User Pool or enterprise SSO. After login, they choose the client workspace they are authorized for. PillarPrep then scopes S3 artifacts, DynamoDB state, prompt profiles, and future Knowledge Base retrieval to that client.

Use this line if judges ask how customers are separated: "You log into a client workspace, not a separate model. The model stays managed by Bedrock; the client's memory, prompt parameters, guardrail policy, and project artifacts are isolated by tenant."

## Demo Beats

1. Start with Apex Mutual and show ranked Well-Architected pillars.
2. Generate the brief and show technical versus executive language.
3. Apply one refinement, such as reducing jargon, to prove the first loop.
4. Open the Project model output and show two-week plan, risks, stakeholder map, and follow-up email.
5. Close on the AWS proof: CloudFront, S3, Cognito Identity, API Gateway IAM auth, Lambda, Bedrock, Guardrails, DynamoDB, CloudWatch, and Budget.

## Strong Closing

PillarPrep is valuable because it turns a one-time AI answer into project memory. The first loop helps the SA win the meeting. The second loop helps the whole team deliver after the meeting.