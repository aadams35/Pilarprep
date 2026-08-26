# PilarPrep Backend

The backend is split by runtime responsibility rather than by AWS service name alone.

| Directory | Responsibility | Primary runtime |
| --- | --- | --- |
| `generation/` | Shared Bedrock prompt, validation, and brief generation boundary | Python |
| `jobs_pipeline/` | Jobs API, SQS worker, approvals, meeting audio, evidence, and artifacts | API Gateway, Lambda, SQS |
| `agentcore/` | Strands runtime, AgentCore memory, gateway tools, and catch-up | AgentCore, Lambda |
| `bedrock_lambda/` | Core shared resources and retained compatibility implementation | Lambda, Bedrock |
| `frontend_static/` | Private S3 and CloudFront web hosting | CloudFormation |
| `deployment_role/` | Least-privilege deployment role bootstrap | CloudFormation |

Each deployable directory keeps its SAM or CloudFormation template close to its code. See `../infrastructure/README.md` for deployment order and stack ownership.

## Tests

Run from the repository root:

```powershell
npm run pipeline:test
npm run agentcore:test
npm run lambda:test
```
