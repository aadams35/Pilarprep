# AgentCore Project Tools

PilarPrep's follow-on loop uses five narrowly scoped tools exposed through an IAM-authenticated AgentCore Gateway. Implementations live in backend/agentcore/tools/app.py and contracts are declared in backend/agentcore/template.yaml.

## Tool set

- get_latest_brief reads the authorized project's latest approved brief.
- get_project_state reads decisions, risks, actions, owners, milestones, and open questions from DynamoDB.
- save_project_update performs a confirmed, schema-validated, idempotent, optimistic-concurrency update.
- create_handoff_packet replaces the latest JSON and DOCX handoff and returns a short-lived download URL.
- generate_catchup organizes approved brief and project-state evidence for Sales, Executive, PM, Engineer, or New member audiences.

## Trust boundary

The Strands agent does not hold S3 or DynamoDB permissions. It calls Gateway over IAM-authenticated MCP. Gateway can invoke only the project tool Lambda, and the Lambda verifies a short-lived signed scope token before building any tenant/client/project key.

Material writes require confirmWrite=true and an idempotency key. DynamoDB project state is authoritative even when conversational Memory is present.

The older helpers in backend/bedrock_lambda/project_tools.py remain part of the Lambda fallback and deterministic local response path. They are not the AgentCore data-access boundary.