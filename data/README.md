# Demo and Evaluation Data

This directory contains synthetic scenarios, quality rubrics, and evidence used
for repeatable PilarPrep demonstrations and evaluations.

- `demo-scenarios.json` defines the selectable customer scenarios.
- `brief-quality-rubric.json` defines deterministic quality expectations.
- `blue-mesa-meeting-script.json` contains the synthetic meeting narrative.
- `blue-mesa-evidence/` contains the synthetic source material used by the
  meeting-intelligence and retrieval workflows.

Do not add real customer data, credentials, call recordings, or personal data.
Uploaded meeting audio belongs in the private runtime S3 path and must follow
the configured retention policy; it does not belong in Git.