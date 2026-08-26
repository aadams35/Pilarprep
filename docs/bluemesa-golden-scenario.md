# BlueMesa Golden Scenario Scorecard

This is the release gate for the live hackathon story. The packet should feel specific enough that the words "BlueMesa Payments" could not be replaced with another company name without rewriting the answer.

## Input anchors

- Company: BlueMesa Payments
- Industry: Financial Services
- Meeting: Executive Briefing
- Primary pillar: Security
- Secondary pillar: Reliability
- Business anchors: merchant trust, holiday transaction volume, settlement continuity, PCI evidence, two acquisitions
- Stakeholders: Ariana Cole, Dev Malik, Rachel Kim
- Approved outcome: bounded settlement-recovery pilot with rollback, RTO/RPO, customer-impact, PCI, and identity-control evidence

## Pass criteria

- Overall quality gate: 85/100 or higher
- Five audience sections with exactly four substantial paragraphs each
- Twenty explicit live questions using `Ask:`
- Every paragraph has at least one approved evidence label
- Technical view names relevant AWS services and explains why each matters
- Executive view contains no AWS service jargon
- The first-ranked pillar shapes the deepest discovery path
- At least two BlueMesa-specific business anchors appear in the packet
- All three named stakeholders receive distinct decision lenses
- Objections contain a concern, a response, and a question
- Handoff contains a two-week plan, risk register, stakeholder map, follow-up email, and grounded project answer
- DOCX opens cleanly, uses real numbered lists, and includes page footers and source notes

## Expected judge moments

1. The technical brief connects PCI evidence and identity separation to an explicit proof plan.
2. The executive brief frames modernization as merchant trust, controlled change, and settlement continuity.
3. The SA game plan asks for RTO/RPO, rollback, and customer-impact evidence before cutover.
4. The handoff names Dev, Rachel, and Ariana as owners or approval gates.
5. A New member catch-up explains the project without requiring the person to reread the full brief.
6. CloudWatch shows the model choice, token volume, estimated spend, latency, and AgentCore tool trail.

## Prepared backup

The frontend includes a fixed BlueMesa backup packet. It is used only if both live AWS generation paths are unavailable. The UI clearly labels it as a fallback, and the presenter can continue through refinement, approval, handoff, and catch-up without pretending the packet came from a successful live call.