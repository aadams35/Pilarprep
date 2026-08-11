# Project Model Tools

The Project model should not only answer questions. In Phase 2, it should also produce project artifacts that help the team move.

The reference tool functions live in:

```text
backend/bedrock_lambda/project_tools.py
```

## Tool Set

- `build_project_record`: creates a structured project summary from request and generated brief output.
- `build_two_week_plan`: produces the first implementation sprint.
- `build_risk_register`: captures major delivery risks and mitigations.
- `build_stakeholder_map`: turns approved decision-maker context into stakeholder signals and validation questions.
- `build_follow_up_email`: drafts a concise customer follow-up.

## Strands Usage

The Strands reference agent in `backend/bedrock_lambda/strands_agent.py` imports these functions as tools. That lets Phase 2 become more than a Q&A bot: it can create repeatable artifacts for sales, executives, PMs, engineers, and new team members.

The local demo provider also returns these artifacts in `projectArtifacts`, so the front end can show working Phase 2 output before the AWS sandbox is deployed.

## Demo Talking Point

Bedrock handles generation and grounding. Strands turns the approved project context into tool-using workflows.