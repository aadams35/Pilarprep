# Judge Walkthrough

Use this as the fast judging path when you have two minutes or less.

## Opening

PilarPrep helps Solutions Architects turn sparse customer context into two useful outputs: a meeting-ready pre-brief and an implementation-ready Project model. The AWS value is that the workflow is serverless, low-cost, and protected by IAM instead of a browser API key.

## Click Path

1. Open the CloudFront URL: `https://d2e0btay0ynyf.cloudfront.net`.
2. Select `Apex Mutual`.
3. Confirm the ranked Well-Architected priorities: Security, Reliability, Cost Optimization.
4. Click `Generate brief + project model`.
5. Show Technical brief, Executive brief, Stakeholder lens, SA game plan, and Objections.
6. Apply `Reduce AWS jargon` and regenerate to show the refinement loop.
7. Open `Project model`, choose `PM`, and show the two-week plan plus risk artifacts.
8. Click `Copy packet` and explain that this is the handoff for sales, executives, PMs, engineers, and new team members.

## AWS Proof Points

- Frontend runs from private S3 through CloudFront.
- Browser gets short-lived Cognito Identity credentials; no API key is shipped to users.
- API Gateway uses IAM authorization, so unsigned calls fail.
- Lambda invokes Amazon Bedrock on demand and stores output artifacts in S3.
- DynamoDB tracks project state for follow-on work.
- CloudWatch dashboard and AWS Budget provide demo visibility and cost guardrails.

## Smoke Proof

Run this before presenting:

```bash
npm run smoke:aws
```

Expected result: CloudFront `200`, unsigned API `403`, signed API `provider=bedrock`, plus S3 `latest.json`, S3 `latest.docx`, and DynamoDB `BRIEF#LATEST` metadata.

## Close

This is not just a prompt demo. It is an AWS-native workflow that turns pre-sales discovery into reusable project memory, with guardrails and monitoring already in place and a clear path to Bedrock Knowledge Bases and Strands for deeper follow-on orchestration.