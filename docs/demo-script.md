# Hackathon Demo Script

The current 15-minute presentation is [BlueMesa AgentCore Demo Runbook](agentcore-demo-runbook.md).

Release gate: [BlueMesa golden scenario scorecard](bluemesa-golden-scenario.md). Architecture narration: [two-minute explanation](architecture-two-minute-explanation.md).

## 90-second version

1. Select BlueMesa Payments and show customer context, ranked AWS pillars, company values, and approved stakeholder notes.
2. Generate the technical and executive brief with Nova Pro.
3. Apply one refinement and approve the brief.
4. Add approved meeting outcomes and generate the AgentCore handoff.
5. Show the two-week plan, risk register, stakeholder map, follow-up email, and latest DOCX.
6. Open Catch-up, select New member, and generate a role-aware summary.
7. Close on the architecture: Loop 1 uses Lambda and Bedrock; Loop 2 uses AgentCore Runtime, Memory, and five governed Gateway tools; DynamoDB and private S3 remain authoritative; the existing Lambda is the fallback.

## One-sentence pitch

PilarPrep turns reviewed customer discovery into both a meeting-ready brief and governed project continuity for sales, executives, delivery teams, and new team members.

## Judge-proof points

- Real problem: customer context is expensive to create and frequently lost at handoff.
- Clear GenAI role: Nova generates audience-specific content; Strands orchestrates evidence reads and confirmed project updates.
- Security: IAM APIs, identity-derived tenant scope, signed tool scope, private S3, and cross-client rejection tests.
- Reliability: optimistic DynamoDB writes, idempotency, latest-only artifacts, CloudWatch traces, and Lambda fallback.
- Cost: on-demand services, Micro rehearsal option, seven-day Memory, and no VPC/NAT or provisioned model endpoint.