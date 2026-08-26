# PilarPrep Portfolio Architecture

Status: implemented and locally verified on the current branch. The last known live
baseline predates this hardening pass. Treat every live claim in this document as
pending until the deployment and security smoke tests in the deployment guide pass.

## Executive summary

PilarPrep turns approved customer context into a meeting brief, then preserves the
approved outcome as implementation-ready handoff and catch-up context. The active
backend is one asynchronous serverless pipeline:

- React static application in a private S3 bucket behind CloudFront.
- Guest demo identities use short-lived Cognito Identity Pool credentials and
  IAM-signed HTTPS requests.
- Verified workspace users use a Cognito User Pool authorization-code flow with
  PKCE and JWT-authorized workspace routes.
- One Jobs API validates identity-derived scope, quotas, versions, and actions.
- One SQS Standard queue carries pointer-only work to one AI worker.
- Bedrock generates and refines briefs. AgentCore and Strands handle handoff,
  catch-up, governed tools, and project memory.
- One DynamoDB table stores jobs, usage, idempotency, latest pointers, approvals,
  project state, and evidence metadata.
- Private S3 stores transient inputs, immutable approved versions, current DOCX/JSON
  pointers, meeting evidence, and tenant evidence.
- Bedrock Knowledge Bases with S3 Vectors provide metadata-filtered retrieval.
- CloudWatch, X-Ray, SNS, WAF, Guardrails, KMS, and a bounded DLQ replay path provide
  operational and security controls.

The foundation models are managed by Amazon Bedrock. PilarPrep stores model
configuration, prompts, customer context, evidence, state, and generated artifacts.
It does not store a foundation model in S3.

## Architecture decisions

| Decision | Why |
| --- | --- |
| One queue and one worker | Durable retries and less duplicated async code |
| One DynamoDB table | Atomic version, approval, idempotency, quota, and project-state operations |
| S3 plus DynamoDB | S3 fits documents; DynamoDB fits state and access patterns |
| User Pool plus Identity Pool | Separates verified workspaces from frictionless synthetic demos |
| JWT workspace routes | Trusted user claims and simpler browser authorization |
| IAM guest routes | Temporary AWS credentials without browser API keys |
| Bedrock for briefs | Managed model access, Guardrails, and no model hosting |
| AgentCore for follow-on work | Bounded agent runtime, memory, and governed tools |
| Vector RAG plus structured state | Evidence retrieval without GraphRAG complexity |
| Immutable approved keys plus latest pointers | Audit history and usable current packet access |
| Human approval gates | Model output cannot silently become authoritative project state |
| No VPC/NAT | Current AWS services are public control-plane APIs; a NAT would add cost without improving isolation |

## 1. Overall AWS architecture

~~~mermaid
flowchart LR
  subgraph Edge["Public edge"]
    U["Browser"]
    CF["CloudFront<br/>HTTPS, WAF, security headers"]
    WEB["Private S3<br/>React assets"]
    U -->|HTTPS| CF
    CF -->|OAC| WEB
  end

  subgraph Identity["Identity"]
    IP["Cognito Identity Pool<br/>guest credentials"]
    UP["Cognito User Pool<br/>verified email + PKCE"]
    U --> IP
    U --> UP
  end

  subgraph API["Request control"]
    JAPI["API Gateway HTTP API"]
    JL["Jobs API Lambda<br/>scope, quota, version, validation"]
    IP -->|SigV4 guest routes| JAPI
    CF -->|JWT + origin secret<br/>workspace routes| JAPI
    JAPI --> JL
  end

  subgraph Pipeline["Durable AI pipeline"]
    DDB["DynamoDB<br/>one-table state"]
    S3A["Private artifact S3<br/>inputs + approved versions"]
    Q["SQS Standard"]
    DLQ["SQS DLQ"]
    W["Unified AI Worker"]
    JL --> DDB
    JL --> S3A
    JL -->|pointer only| Q
    Q --> W
    Q -. max receives .-> DLQ
  end

  subgraph AI["GenAI and meeting services"]
    BR["Amazon Bedrock<br/>Nova / Claude + Guardrail"]
    AC["AgentCore Runtime<br/>Strands"]
    MEM["AgentCore Memory"]
    GW["AgentCore Gateway"]
    TL["Governed Tool Lambda"]
    TR["Amazon Transcribe"]
    KB["Bedrock Knowledge Base"]
    VEC["S3 Vectors"]
    W --> BR
    W --> AC
    W --> TR
    AC --> MEM
    AC --> GW
    GW --> TL
    AC --> KB
    KB --> VEC
    TL --> DDB
    TL --> S3A
  end

  subgraph Ops["Operations"]
    CW["CloudWatch + X-Ray"]
    SNS["SNS alerts"]
    JL -. metrics .-> CW
    W -. metrics .-> CW
    AC -. safe metrics .-> CW
    CW --> SNS
  end
~~~

## 2. Guest versus authenticated access

~~~mermaid
flowchart TB
  B["Browser"] --> M{"Access mode"}

  M -->|Guest demo| CI["Cognito Identity Pool"]
  CI --> GC["Short-lived IAM credentials"]
  GC --> GAPI["HTTPS + SigV4 guest routes"]
  GAPI --> GS["Server-derived guest tenant<br/>approved synthetic clients only"]
  GS --> GQ["Hourly + daily identity quota<br/>Nova allowlist"]

  M -->|Workspace| CU["Cognito User Pool"]
  CU --> PKCE["Authorization code + PKCE"]
  PKCE --> JWT["Verified-user JWT"]
  JWT --> CFAPI["CloudFront /api path<br/>WAF + origin secret"]
  CFAPI --> WAPI["JWT workspace routes"]
  WAPI --> WS["Claim-derived personal or assigned tenant<br/>client/project checks"]
  WS --> WQ["User + tenant + premium-model quota"]

  GS --> P["One scoped Jobs API contract"]
  WQ --> P
~~~

## 3. Job generation sequence

~~~mermaid
sequenceDiagram
  participant B as Browser
  participant A as Jobs API
  participant D as DynamoDB
  participant S as Artifact S3
  participant Q as SQS
  participant W as AI Worker
  participant M as Bedrock or AgentCore

  B->>A: POST job with action and business input
  A->>A: Verify HTTPS, auth, origin, scope, model policy
  A->>D: Conditional quota and idempotency transaction
  A->>S: Store encrypted transient input
  A->>D: Create scoped queued job
  A->>Q: Send job/action/trace/input pointer only
  A-->>B: 202 jobId
  B->>A: Poll GET jobId
  Q->>W: Deliver message
  W->>D: Conditional job lease
  W->>S: Load and revalidate input version and scope
  W->>M: Invoke routed model path
  M-->>W: Structured result and usage metadata
  W->>W: Validate schema, facts, target isolation, citations
  W->>S: Persist encrypted result/artifact
  W->>D: Complete status and latest pointers
  A-->>B: Complete result or non-revealing failure
~~~

## 4. AgentCore handoff and catch-up

~~~mermaid
flowchart LR
  J["Unified worker"] --> V["Load current approved packet<br/>verify version and scope"]
  V --> R["AgentCore Runtime + Strands"]
  R --> E["Metadata-filtered evidence"]
  R --> M["Project-scoped Memory"]
  R --> G["IAM AgentCore Gateway"]
  G --> T1["Read latest approved brief"]
  G --> T2["Read project state"]
  G --> T3["Save project update"]
  G --> T4["Create handoff packet"]
  G --> T5["Generate catch-up"]

  T1 --> S3["Private S3"]
  T2 --> DDB["DynamoDB"]
  T3 --> DDB
  T4 --> S3

  R --> A{"Action"}
  A -->|handoff| H["Confirmed write<br/>optimistic state update + artifact"]
  A -->|catch-up| C["Read-only response<br/>state version must not change"]
~~~

## 5. Meeting transcription and proposal approval

~~~mermaid
sequenceDiagram
  participant U as User
  participant J as Jobs pipeline
  participant T as Transcribe
  participant E as EventBridge
  participant Q as SQS
  participant A as AgentCore
  participant D as DynamoDB

  U->>J: Process prepared synthetic meeting
  J->>D: Verify current approved packet version
  J->>T: Start asynchronous transcription
  J-->>U: Transcribing status
  T-->>E: COMPLETED or FAILED
  E->>Q: Continuation pointer
  Q->>J: Resume exact scoped job
  J->>A: Transcript + approved brief + bounded evidence
  A-->>J: Proposed facts, corrections, decisions, risks, actions
  J->>D: Store review-ready proposal with two-day TTL
  U->>J: Accept, edit, or reject every proposal item
  J->>D: Optimistic transaction against expected brief version
  D-->>J: Approved state version
  J-->>U: Approval result; handoff may now use it
~~~

## 6. RAG ingestion and retrieval

~~~mermaid
flowchart TB
  U["Verified workspace user"] --> API["Evidence action through Jobs API"]
  API --> VAL["Validate type, size, tenant/client/project scope"]
  VAL --> S3["Private evidence prefix<br/>content + metadata sidecar"]
  S3 --> ING["Bedrock KB ingestion job"]
  ING --> PARSE["Service-managed parsing/chunking"]
  PARSE --> EMB["Titan Text Embeddings v2"]
  EMB --> V["S3 Vectors index"]
  ING --> META["DynamoDB lifecycle metadata"]

  A["AgentCore request"] --> FILTER["Server-built metadata filter"]
  FILTER --> V
  V --> CHECK["Post-retrieval metadata revalidation"]
  CHECK -->|mismatch| REJECT["Reject + cross-scope metric"]
  CHECK -->|authorized| SAFE["Treat text as untrusted evidence"]
  SAFE --> CITE["Allowed source labels + freshness metadata"]
  CITE --> OUT["Grounded handoff or catch-up"]
~~~

## 7. Tenant and IAM enforcement

~~~mermaid
flowchart LR
  ID["Trusted JWT claims or IAM identity"] --> DERIVE["Derive tenantId, userId,<br/>allowed clients/projects"]
  REQ["Browser clientId/projectId"] --> VALIDATE["Validate requested resource<br/>against trusted assignments"]
  DERIVE --> VALIDATE
  VALIDATE --> PK["TENANT# | CLIENT# | PROJECT#"]
  PK --> DDB["DynamoDB condition expressions"]
  PK --> S3["S3 tenant/client/project prefix"]
  PK --> TOK["10-minute HMAC scope token"]
  TOK --> GW["AgentCore governed tools"]
  GW --> AGAIN["Revalidate token and event scope"]
  AGAIN --> DATA["Scoped state and artifact access"]
  VALIDATE -->|outside scope| DENY["403 non-revealing response<br/>security metric"]
~~~

## 8. DLQ recovery

~~~mermaid
flowchart TB
  F["Worker failure"] --> R{"Receive count < 3?"}
  R -->|yes| RETRY["Short delayed retry<br/>same job and idempotency"]
  R -->|no| DLQ["Encrypted DLQ<br/>14-day retention"]
  DLQ --> ALARM["CloudWatch alarm -> SNS"]
  ALARM --> OP["PilarPrepOperators user"]
  OP --> INSPECT["Inspect safe error, attempt count,<br/>job state and message pointer"]
  INSPECT --> ELIG{"Replay eligible?"}
  ELIG -->|transient and below total limit| AUDIT["Conditional replay audit record"]
  AUDIT --> MAIN["Send same pointer to main queue"]
  MAIN --> IDEM["Worker idempotency/version checks"]
  ELIG -->|invalid, poison, or exhausted| QUAR["Quarantine classification<br/>no automatic loop"]
~~~

## 9. Artifact approval and version lifecycle

~~~mermaid
stateDiagram-v2
  [*] --> Draft: brief.generate
  Draft --> Stale: brief.refine
  Stale --> Draft: complete selected-tab regeneration
  Draft --> Approved: human approval + expected version
  Approved --> Stale: any successful refinement
  Approved --> Handoff: version-matched handoff
  Handoff --> CatchUp: read-only audience view

  state Approved {
    [*] --> ImmutableJSON
    [*] --> ImmutableDOCX
    [*] --> ApprovalAudit
    ImmutableJSON --> LatestPointer
    ImmutableDOCX --> LatestPointer
  }
~~~

## Trust boundaries

1. Browser input is untrusted, including tenant IDs, client IDs, session IDs,
   uploaded evidence, meeting notes, and requested model.
2. API Gateway authorizer context is trusted only after route authorization.
3. The Jobs API derives effective scope and model selection server-side.
4. SQS carries no customer document content, only routing and encrypted S3 pointers.
5. Retrieved RAG text is evidence, never an instruction source.
6. AgentCore tools require an expiring signed scope token and revalidate every field.
7. Draft AI output is non-authoritative until human approval succeeds.
8. Only immutable approved versions may ground handoff or catch-up.

## Well-Architected position

| Pillar | Current strength | Remaining production work |
| --- | --- | --- |
| Security | Identity-derived tenancy, private S3, KMS option, JWT/IAM routes, WAF, Guardrails | Enterprise federation, malware scanning, CloudTrail S3 data events |
| Reliability | SQS/DLQ, idempotency, leases, version locks, immutable approvals | Automated restore drill and cross-region recovery |
| Operational Excellence | Structured safe logs, alarms, dashboard, replay runbook | SLOs, deployment pipeline, alarm ownership rotation |
| Performance Efficiency | Async API, warm clients, server model routing | Load tests and prompt/token budget tuning by task |
| Cost Optimization | On-demand services, quotas, kill switch, cost metrics | Verified pricing calculator and anomaly thresholds per environment |
| Sustainability | No idle model hosts, no NAT, lifecycle expiration | Measure token and storage reduction over time |

## Verification boundary

Repository tests and SAM validation can prove contracts, policy shape, and deterministic
security behavior. Only a live deployment can prove Cognito claims, CloudFront origin
verification, IAM evaluation, KMS permissions, WAF association, Knowledge Base
ingestion, AgentCore retrieval, DLQ replay, and direct S3 denial. Do not describe this
branch as production-ready until those live checks pass.
