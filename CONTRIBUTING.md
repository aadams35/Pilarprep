# Contributing to PilarPrep

## Development flow

1. Create a focused branch.
2. Keep changes inside the owning frontend, backend, infrastructure, or documentation boundary.
3. Add tests proportional to the behavioral risk.
4. Run the verification commands below.
5. Update architecture or deployment documentation when contracts change.

## Required checks

```powershell
npm run lint
npm test
npm run pipeline:test
npm run agentcore:test
npm run lambda:test
npm run test:e2e
```

## Pull requests

Describe:

- the user or operational problem
- the implementation approach
- security and data-handling impact
- tests run
- deployment or rollback considerations

Do not commit credentials, generated build directories, customer data, presigned URLs, or production meeting recordings.
