# PillarPrep Prompt Contract

PillarPrep uses one structured request and one structured response across demo mode, Bedrock Lambda, and the later Strands agent path.

## Request

```json
{
  "mode": "prebrief",
  "company": "Apex Mutual",
  "industry": "Financial Services",
  "meetingType": "Executive Briefing",
  "companySize": "Enterprise",
  "pillars": ["Security", "Reliability", "Cost Optimization"],
  "pillarRanking": [
    { "rank": 1, "pillar": "Security" },
    { "rank": 2, "pillar": "Reliability" },
    { "rank": 3, "pillar": "Cost Optimization" }
  ],
  "context": "Modernizing a customer portal with audit and migration risk.",
  "decisionMakers": [
    {
      "name": "Lena Ortiz",
      "title": "CIO",
      "source": "Customer-approved profile notes",
      "context": "Prior notes emphasize board visibility, customer trust, modernization governance, and avoiding a risky big-bang migration."
    }
  ],
  "meetingNotes": "",
  "feedback": ["Reduce AWS jargon"],
  "role": "PM",
  "prompt": "Create the first two-week plan."
}
```

## Response

```json
{
  "provider": "bedrock",
  "generatedAt": "2026-07-22T00:00:00Z",
  "metadata": {
    "projectId": "apex-mutual",
    "clientId": "apex-mutual",
    "artifactKey": "clients/apex-mutual/brief/latest.json",
    "docxArtifactKey": "clients/apex-mutual/brief/latest.docx",
    "artifactRetention": "latest-only",
    "stateKey": "BRIEF#LATEST"
  },
  "technical": ["..."],
  "executive": ["..."],
  "stakeholders": ["..."],
  "gameplan": ["..."],
  "objections": ["..."],
  "projectAnswer": "...",
  "projectArtifacts": {
    "twoWeekPlan": [
      {
        "title": "Days 1-2",
        "detail": "Confirm stakeholders, success criteria, and decision process.",
        "owner": "SA / Sales",
        "status": "Ready"
      }
    ],
    "riskRegister": [
      {
        "title": "Unvalidated assumptions",
        "detail": "Generated recommendations must be validated in discovery.",
        "owner": "SA",
        "status": "High"
      }
    ],
    "stakeholderMap": [
      {
        "title": "Lena Ortiz",
        "detail": "Validate modernization governance and board visibility priorities.",
        "owner": "CIO",
        "status": "Validate"
      }
    ],
    "followUpEmail": {
      "subject": "Follow-up from PillarPrep briefing for Apex Mutual",
      "body": "..."
    }
  },
  "citations": [
    "Customer context",
    "Decision-maker context (user-provided)",
    "Ranked AWS Well-Architected pillars"
  ]
}
```

## Bedrock System Behavior

- Treat generated content as preparation hypotheses, not verified facts.
- Produce both technical and executive-ready content.
- Keep executive content low-jargon.
- Treat `pillarRanking` as highest-to-lowest priority, with rank 1 as the primary discovery lens.
- Tie technical recommendations to the ranked AWS Well-Architected pillars.
- Produce longer, question-led paragraphs instead of short labels or one-line bullets.
- Target 45-95 words per generated brief item and include `Ask:` questions in technical, executive, stakeholder, gameplan, and objection sections.
- Replace sections that come back too short with safe fallback paragraphs so the demo remains useful even when the model is terse.
- Include AWS services only when they help the conversation.
- Use decision-maker context only when it is customer-approved or manually provided.
- Never claim that PillarPrep scraped, browsed, or verified LinkedIn.
- Return practical project artifacts for Phase 2: sprint plan, risks, stakeholder map, and follow-up email.
- Return strict JSON only.

## Strands Phase 2 Behavior

Use Strands after the approved brief and meeting notes exist. The agent should answer role-aware questions using:

- final brief
- decision-maker context
- meeting notes
- open risks
- owners
- decisions
- implementation artifacts

The agent should produce practical next actions, not generic summaries.
