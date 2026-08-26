# Operations Scripts

This directory contains the repeatable deployment, verification, and demo-data
utilities used to operate PilarPrep. Run scripts from the repository root so
their relative paths resolve consistently.

## Deployment

| Script | Purpose |
| --- | --- |
| `deploy-aws-backend.ps1` | Deploy the Bedrock brief-generation backend. |
| `deploy-jobs-pipeline.ps1` | Deploy the unified Jobs API, SQS queue, worker, and state resources. |
| `deploy-agentcore.ps1` | Deploy the AgentCore handoff and catch-up components. |
| `deploy-aws-frontend.ps1` | Build and publish the React application to S3 and CloudFront. |

Deploy backend services before the frontend. The frontend deployment injects
the deployed API and identity configuration into the static build.

## Verification

The `smoke-*.mjs` scripts exercise deployed workflows without replacing the
automated unit and browser tests. They expect the appropriate stack outputs or
environment variables and should be run only with a scoped deployment role.

## Demo Data

`prepare-blue-mesa-rag.ps1` prepares the synthetic BlueMesa evidence set. No
real customer recordings or personal data should be committed to this folder.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the supported deployment order and
[docs/operations-runbook.md](../docs/operations-runbook.md) for troubleshooting.