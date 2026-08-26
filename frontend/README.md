# PilarPrep Frontend

The frontend is a React and TypeScript application with two build paths:

- `vinext` for the local development and test experience
- Vite static output for private S3 and CloudFront hosting on AWS

## Structure

```text
frontend/
|-- app/                  # Main workflow UI and route adapter
|-- lib/pillarprep/       # Domain contracts, AWS signing, polling, and refinement
|-- public/               # Static assets
|-- static/               # AWS static entry point
|-- types/                # Browser and build-time declarations
|-- worker/               # Local preview worker
|-- build/                # Local preview packaging plugin
`-- .openai/              # Local preview hosting metadata
```

## Commands

Run commands from the repository root:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 3002
npm run lint
npm test
npm run test:e2e
npm run build:aws-frontend
```

## Boundaries

- Browser code never receives Bedrock permissions.
- AWS API requests use temporary Cognito credentials and SigV4.
- Tenant and project scope are enforced again by the backend.
- Production builds reject non-HTTPS service URLs.
