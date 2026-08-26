import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const region = process.env.AWS_REGION ?? "us-east-1";
const backendStack = process.env.PILLARPREP_BACKEND_STACK ?? "pillarprep-bedrock";
const jobsStack = process.env.PILLARPREP_JOBS_STACK ?? "pillarprep-jobs";
const origin = process.env.PILLARPREP_PUBLIC_ORIGIN ?? "https://pilarprep.app";
const reuseApprovedBrief =
  process.env.PILLARPREP_REUSE_APPROVED_BRIEF === "true";

function awsJson(args) {
  const output = execFileSync(
    "aws",
    [...args, "--region", region, "--output", "json", "--no-cli-pager"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return JSON.parse(output);
}

function stackOutputs(stackName) {
  const outputs = awsJson([
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--query",
    "Stacks[0].Outputs",
  ]);
  return Object.fromEntries(
    outputs.map((item) => [item.OutputKey, item.OutputValue])
  );
}

async function cognitoRequest(target, payload) {
  const response = await fetch(
    `https://cognito-identity.${region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": `AWSCognitoIdentityService.${target}`,
      },
      body: JSON.stringify(payload),
    }
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Cognito ${target} returned HTTP ${response.status}: ${text}`
    );
  }
  return JSON.parse(text);
}

async function cognitoCredentials(identityPoolId) {
  const identity = await cognitoRequest("GetId", { IdentityPoolId: identityPoolId });
  const response = await cognitoRequest("GetCredentialsForIdentity", {
    IdentityId: identity.IdentityId,
  });
  const values = response.Credentials;
  if (!values?.AccessKeyId || !values.SecretKey) {
    throw new Error("Cognito did not return usable temporary credentials.");
  }
  return {
    accessKeyId: values.AccessKeyId,
    secretAccessKey: values.SecretKey,
    sessionToken: values.SessionToken,
  };
}

async function signedFetch(url, method, credentials, payload) {
  const endpoint = new URL(url);
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const signer = new SignatureV4({
    credentials,
    region,
    service: "execute-api",
    sha256: Sha256,
  });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    method,
    path: endpoint.pathname,
    query: Object.fromEntries(endpoint.searchParams.entries()),
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      host: endpoint.host,
    },
    ...(body === undefined ? {} : { body }),
  });
  const signed = await signer.sign(request);
  const headers = { ...signed.headers };
  delete headers.host;
  return fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

async function signedJson(url, method, credentials, payload, label) {
  const response = await signedFetch(url, method, credentials, payload);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON with HTTP ${response.status}.`);
  }
  if (!response.ok) {
    throw new Error(
      `${label} returned HTTP ${response.status}: ${body.error ?? text}`
    );
  }
  return { status: response.status, body };
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runJob(apiUrl, credentials, envelope, label, terminalStatuses) {
  const startedAt = Date.now();
  const accepted = await signedJson(
    `${apiUrl}/jobs`,
    "POST",
    credentials,
    envelope,
    label
  );
  if (
    accepted.status !== 202 ||
    !accepted.body.jobId ||
    accepted.body.clientId !== envelope.clientId ||
    accepted.body.projectId !== envelope.projectId
  ) {
    throw new Error(`${label} did not return a scoped HTTP 202 job envelope.`);
  }

  const statuses = [];
  const deadline = Date.now() + 720_000;
  let waitMs = accepted.body.pollAfterMs ?? 1500;
  while (Date.now() < deadline) {
    await sleep(Math.max(750, Math.min(waitMs, 5000)));
    const query = new URLSearchParams({
      clientId: envelope.clientId,
      projectId: envelope.projectId,
      sessionId: envelope.sessionId,
    });
    const polled = await signedJson(
      `${apiUrl}/jobs/${accepted.body.jobId}?${query}`,
      "GET",
      credentials,
      undefined,
      `${label} poll`
    );
    const status = polled.body.status;
    if (status && statuses.at(-1) !== status) statuses.push(status);
    if (
      [
        "queued",
        "waiting_for_scan",
        "running",
        "transcribing",
        "screening",
        "analyzing",
      ].includes(status)
    ) {
      waitMs = polled.body.pollAfterMs ?? waitMs;
      continue;
    }
    if (status === "failed") {
      throw new Error(`${label} failed: ${polled.body.error ?? "unknown error"}`);
    }
    if (!terminalStatuses.includes(status) || !polled.body.result) {
      throw new Error(
        `${label} returned unexpected terminal state ${status ?? "missing"}.`
      );
    }
    return {
      result: polled.body.result,
      jobId: accepted.body.jobId,
      statuses,
      durationMs: Date.now() - startedAt,
    };
  }
  throw new Error(`${label} did not complete within twelve minutes.`);
}

function assertLiveProvider(result, provider, label) {
  if (result.provider !== provider || result.metadata?.fallbackUsed) {
    throw new Error(
      `${label} did not complete through live ${provider} without fallback.`
    );
  }
}

const backend = stackOutputs(backendStack);
const jobs = stackOutputs(jobsStack);
const apiUrl = jobs.JobsApiUrl;
const identityPoolId = backend.DemoIdentityPoolId;
const artifactBucket = backend.ArtifactBucketName;
const evidenceBucket = jobs.MeetingEvidenceBucketName;
if (
  !apiUrl?.startsWith("https://") ||
  !identityPoolId ||
  !artifactBucket ||
  !evidenceBucket ||
  !jobs.BlueMesaKnowledgeBaseId
) {
  throw new Error("Required PilarPrep stack outputs are missing.");
}

const cors = await fetch(`${apiUrl}/jobs`, {
  method: "OPTIONS",
  headers: {
    origin,
    "access-control-request-method": "POST",
    "access-control-request-headers":
      "authorization,content-type,x-amz-date,x-amz-security-token",
  },
});
if (
  cors.status !== 204 ||
  cors.headers.get("access-control-allow-origin") !== origin
) {
  throw new Error("Jobs API CORS does not allow the public HTTPS origin.");
}

const unsigned = await fetch(`${apiUrl}/clients`);
if (unsigned.status !== 403) {
  throw new Error(
    `Unsigned Jobs API request returned HTTP ${unsigned.status}, expected 403.`
  );
}

const credentials = await cognitoCredentials(identityPoolId);
const clientId = "bluemesa-payments";
const projectId = clientId;
const sessionId = `session-meeting-smoke-${randomUUID()}`;
const company = "BlueMesa Payments";
const briefInput = {
  mode: "prebrief",
  modelPreference: "nova-pro",
  company,
  industry: "Financial Services",
  meetingType: "Technical Deep Dive",
  companySize: "Enterprise",
  pillars: [
    "Security",
    "Reliability",
    "Operational Excellence",
    "Performance Efficiency",
    "Cost Optimization",
    "Sustainability",
  ],
  pillarRanking: [
    { rank: 1, pillar: "Security" },
    { rank: 2, pillar: "Reliability" },
    { rank: 3, pillar: "Operational Excellence" },
    { rank: 4, pillar: "Performance Efficiency" },
    { rank: 5, pillar: "Cost Optimization" },
    { rank: 6, pillar: "Sustainability" },
  ],
  context:
    "BlueMesa Payments is planning the next stage of its merchant platform. The sales notes contain an unverified assumption that the work may require an initial migration from on-premises systems. The meeting must validate the actual AWS state, payroll integration scope, availability expectations, data retention, reconciliation ownership, dependencies, and concrete owners before the implementation handoff.",
  companyValues:
    "Merchant trust, controlled change, accountable ownership, evidence over assertion, and partner empathy.",
  companyValuesUrl:
    "https://www.bluemesa-payments.example/company/values",
  additionalDirection:
    "Bridge Sales and SA preparation. Treat payroll integration and current cloud state as discovery questions until the meeting provides evidence.",
  meetingNotes: "",
  decisionMakers: [
    {
      name: "Dev Malik",
      title: "VP Infrastructure and Resilience",
      source: "Synthetic customer-approved profile",
      context:
        "Owns platform availability, reconciliation operations, and production readiness.",
    },
    {
      name: "Rachel Kim",
      title: "Chief Risk and Compliance Officer",
      source: "Synthetic customer-approved profile",
      context:
        "Owns payment and payroll data controls, retention, and audit evidence.",
    },
  ],
  role: "Solutions Architect",
  prompt:
    "Prepare the technical discovery plan and identify assumptions that the customer meeting must validate.",
};

let packetVersion = 0;
let generationDurationMs = 0;
let approvalDurationMs = 0;
if (reuseApprovedBrief) {
  const startedAt = Date.now();
  const query = new URLSearchParams({ projectId, sessionId });
  const latest = await signedJson(
    `${apiUrl}/clients/${clientId}/latest?${query}`,
    "GET",
    credentials,
    undefined,
    "Latest approved Blue Mesa brief"
  );
  packetVersion = Number(latest.body.packetVersion);
  generationDurationMs = Date.now() - startedAt;
  if (!(packetVersion > 0) || !latest.body.packet) {
    throw new Error("No approved Blue Mesa brief is available for reuse.");
  }
} else {
  const generation = await runJob(
    apiUrl,
    credentials,
    {
      action: "brief.generate",
      clientId,
      projectId,
      sessionId,
      idempotencyKey: `blue-mesa-generate-${randomUUID()}`,
      input: briefInput,
    },
    "Blue Mesa brief generation",
    ["complete"]
  );
  assertLiveProvider(generation.result, "bedrock", "Blue Mesa brief generation");
  generationDurationMs = generation.durationMs;
  packetVersion = Number(generation.result.metadata?.packetVersion);
  if (
    !(packetVersion > 0) ||
    generation.result.metadata?.approvalStatus !== "draft"
  ) {
    throw new Error("Blue Mesa generation did not return a versioned draft.");
  }

  const approval = await runJob(
    apiUrl,
    credentials,
    {
      action: "brief.approve",
      clientId,
      projectId,
      sessionId,
      idempotencyKey: `blue-mesa-approve-${randomUUID()}`,
      input: { packetVersion, modelPreference: "nova-pro" },
    },
    "Blue Mesa brief approval",
    ["complete"]
  );
  assertLiveProvider(approval.result, "bedrock", "Blue Mesa brief approval");
  approvalDurationMs = approval.durationMs;
  if (
    approval.result.metadata?.approvalStatus !== "approved" ||
    approval.result.metadata?.approvedPacketVersion !== packetVersion
  ) {
    throw new Error("Blue Mesa brief approval did not durably promote the draft.");
  }
  if (
    !approval.result.metadata?.precallHandoffJobId ||
    !["queued", "preparing", "ready"].includes(
      approval.result.metadata?.precallHandoffStatus
    ) ||
    approval.result.metadata?.precallHandoffSourceVersion !== packetVersion
  ) {
    throw new Error(
      "Blue Mesa approval did not create or recover the automatic pre-call handoff."
    );
  }
}

const audioBytes = await readFile(
  new URL("../demo-assets/blue-mesa-discovery.mp3", import.meta.url)
);
const uploadTarget = await signedJson(
  `${apiUrl}/meeting-audio/uploads`,
  "POST",
  credentials,
  {
    clientId,
    projectId,
    sessionId,
    scenarioId: "blue-mesa-payments",
    meetingId: "blue-mesa-discovery",
    fileName: "blue-mesa-discovery.mp3",
    contentType: "audio/mpeg",
    sizeBytes: audioBytes.byteLength,
  },
  "Blue Mesa meeting audio upload target"
);
if (
  !uploadTarget.body.uploadId ||
  !uploadTarget.body.uploadUrl?.startsWith("https://") ||
  !uploadTarget.body.uploadFields
) {
  throw new Error("Meeting audio upload target was incomplete.");
}
const uploadForm = new FormData();
for (const [key, value] of Object.entries(uploadTarget.body.uploadFields)) {
  uploadForm.append(key, value);
}
uploadForm.append(
  "file",
  new Blob([audioBytes], { type: "audio/mpeg" }),
  "blue-mesa-discovery.mp3"
);
const audioUpload = await fetch(uploadTarget.body.uploadUrl, {
  method: "POST",
  body: uploadForm,
  headers: { origin },
});
if (!audioUpload.ok) {
  throw new Error(
    `Private meeting audio upload returned HTTP ${audioUpload.status}.`
  );
}

const meeting = await runJob(
  apiUrl,
  credentials,
  {
    action: "meeting.process",
    clientId,
    projectId,
    sessionId,
    idempotencyKey: `blue-mesa-meeting-${randomUUID()}`,
    input: {
      scenarioId: "blue-mesa-payments",
      meetingId: "blue-mesa-discovery",
      audioUploadId: uploadTarget.body.uploadId,
      expectedApprovedPacketVersion: packetVersion,
      enablePiiRedaction: true,
      modelPreference: "nova-pro",
    },
  },
  "Blue Mesa meeting processing",
  ["review-ready"]
);
const review = meeting.result;
assertLiveProvider(review, "agentcore-strands", "Blue Mesa meeting processing");
if (
  review.scenarioId !== "blue-mesa-payments" ||
  !review.transcript?.segments?.length ||
  !review.transcript.segments.every(
    (segment) =>
      segment.speaker &&
      Number.isFinite(segment.timestampStart) &&
      Number.isFinite(segment.timestampEnd)
  ) ||
  !review.reviewItems?.length
) {
  throw new Error("Meeting review is missing speaker, timestamp, or proposal data.");
}
const analysisText = JSON.stringify(review.analysis).toLowerCase();
if (
  !analysisText.includes("payroll") ||
  !review.analysis.correctedAssumptions?.length ||
  review.analysis.actions?.length < 2
) {
  throw new Error(
    "Meeting analysis omitted payroll, corrected assumptions, or owned actions."
  );
}
const currentState = {
  meetingSummary: review.analysis.meetingSummary,
  proposedHandoffSummary: review.analysis.proposedHandoffSummary,
  correctedAssumptions: (review.analysis.correctedAssumptions ?? []).map(
    (item) => item.meetingCorrection
  ),
  statements: [
    "confirmedFacts",
    "decisions",
    "openQuestions",
    "requirements",
    "risks",
    "scopeChanges",
    "actions",
    "stakeholderSignals",
  ].flatMap((field) =>
    (review.analysis[field] ?? []).map((item) => item.statement)
  ),
};
if (
  /migrat(?:e|es|ing|ion) from on[- ]prem|move from on[- ]prem|initial aws migration/i.test(
    JSON.stringify(currentState)
  )
) {
  throw new Error("Meeting analysis reintroduced an on-premises migration claim.");
}

const dispositions = review.reviewItems.map((item, index, items) => {
  if (items.length > 2 && index === items.length - 1) {
    return { id: item.id, decision: "rejected" };
  }
  if (index === 1) {
    return {
      id: item.id,
      decision: "edited",
      editedStatement: `${item.proposedUpdate} Confirm the owner at the next technical checkpoint.`,
    };
  }
  return { id: item.id, decision: "accepted" };
});

const meetingApproval = await runJob(
  apiUrl,
  credentials,
  {
    action: "meeting.approve",
    clientId,
    projectId,
    sessionId,
    idempotencyKey: `blue-mesa-meeting-approve-${randomUUID()}`,
    input: {
      scenarioId: review.scenarioId,
      meetingId: review.meetingId,
      proposalId: review.proposalId,
      expectedApprovedPacketVersion: review.baseBriefVersion,
      dispositions,
      modelPreference: "nova-pro",
    },
  },
  "Blue Mesa meeting approval",
  ["approved"]
);
assertLiveProvider(
  meetingApproval.result,
  "agentcore",
  "Blue Mesa approved handoff"
);
if (
  meetingApproval.result.meetingApproval?.status !== "approved" ||
  meetingApproval.result.meetingApproval.acceptedCount < 1 ||
  !meetingApproval.result.metadata?.meetingApprovalArtifactKey ||
  !meetingApproval.result.projectArtifacts?.nextSteps?.immediateActions?.length
) {
  throw new Error("Meeting approval did not create the governed handoff.");
}

const catchup = await runJob(
  apiUrl,
  credentials,
  {
    action: "catchup.generate",
    clientId,
    projectId,
    sessionId,
    idempotencyKey: `blue-mesa-catchup-${randomUUID()}`,
    input: {
      audienceRole: "Solutions Architect",
      focus:
        "Summarize the approved payroll integration decisions, open questions, owners, risks, and next technical checkpoint.",
      meetingNotes: "",
      modelPreference: "nova-pro",
    },
  },
  "Blue Mesa catch-up",
  ["complete"]
);
assertLiveProvider(catchup.result, "agentcore", "Blue Mesa catch-up");
if (
  !catchup.result.projectAnswer?.toLowerCase().includes("payroll") ||
  catchup.result.metadata?.toolCalls?.some((name) =>
    ["save_project_update", "create_handoff_packet"].includes(name)
  )
) {
  throw new Error("Catch-up was not payroll-grounded and read-only.");
}

const directArtifact = await fetch(
  `https://${artifactBucket}.s3.${region}.amazonaws.com/index.html`
);
const directEvidence = await fetch(
  `https://${evidenceBucket}.s3.${region}.amazonaws.com/audio/public-demo/blue-mesa-payments/blue-mesa-discovery.mp3`
);
if (directArtifact.status !== 403 || directEvidence.status !== 403) {
  throw new Error(
    `Direct S3 access was not blocked: artifacts=${directArtifact.status}, evidence=${directEvidence.status}.`
  );
}

console.table({
  jobsApi: apiUrl,
  unsignedApi: "403",
  knowledgeBaseId: jobs.BlueMesaKnowledgeBaseId,
  packetVersion,
  meetingJobId: meeting.jobId,
  meetingStates: meeting.statuses.join(" -> "),
  transcriptSegments: review.transcript.segments.length,
  reviewItems: review.reviewItems.length,
  acceptedChanges: meetingApproval.result.meetingApproval.acceptedCount,
  rejectedChanges: meetingApproval.result.meetingApproval.rejectedCount,
  handoffProvider: meetingApproval.result.provider,
  catchupProvider: catchup.result.provider,
  directArtifactS3: directArtifact.status,
  directEvidenceS3: directEvidence.status,
  totalDurationMs:
    generationDurationMs +
    approvalDurationMs +
    meeting.durationMs +
    meetingApproval.durationMs +
    catchup.durationMs,
});

