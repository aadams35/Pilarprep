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
  "pillars": ["Security", "Reliability"],
  "context": "Modernizing a customer portal with audit and migration risk.",
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
    "artifactKey": "projects/apex-mutual/briefs/20260722T000000Z.json",
    "stateKey": "BRIEF#20260722T000000Z"
  },
  "technical": ["..."],
  "executive": ["..."],
  "gameplan": ["..."],
  "objections": ["..."],
  "projectAnswer": "...",
  "citations": ["Customer context", "AWS Well-Architected pillars"]
}
```

## Bedrock System Behavior

- Treat generated content as preparation hypotheses, not verified facts.
- Produce both technical and executive-ready content.
- Keep executive content low-jargon.
- Tie technical recommendations to AWS Well-Architected pillars.
- Include AWS services only when they help the conversation.
- Return strict JSON only.

## Strands Phase 2 Behavior

Use Strands after the approved brief and meeting notes exist. The agent should answer role-aware questions using:

- final brief
- meeting notes
- open risks
- owners
- decisions
- implementation artifacts

The agent should produce practical next actions, not generic summaries.
