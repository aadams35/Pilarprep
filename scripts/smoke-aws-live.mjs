import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { execFileSync } from "node:child_process";

const region = process.env.AWS_REGION ?? "us-east-1";
const backendStack = process.env.PILLARPREP_BACKEND_STACK ?? "pillarprep-bedrock";
const frontendStack = process.env.PILLARPREP_FRONTEND_STACK ?? "pillarprep-frontend";

function awsJson(args) {
  const output = execFileSync("aws", [...args, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  return Object.fromEntries(outputs.map((item) => [item.OutputKey, item.OutputValue]));
}

async function postCognitoIdentity(target, payload) {
  const response = await fetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityService.${target}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Cognito ${target} failed with HTTP ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

async function cognitoCredentials(identityPoolId) {
  const identity = await postCognitoIdentity("GetId", { IdentityPoolId: identityPoolId });
  const credentials = await postCognitoIdentity("GetCredentialsForIdentity", {
    IdentityId: identity.IdentityId,
  });
  const values = credentials.Credentials;

  if (!values?.AccessKeyId || !values.SecretKey) {
    throw new Error("Cognito did not return usable demo credentials.");
  }

  return {
    accessKeyId: values.AccessKeyId,
    secretAccessKey: values.SecretKey,
    sessionToken: values.SessionToken,
  };
}

async function signedPostJson(url, payload, credentials) {
  const endpoint = new URL(url);
  const body = JSON.stringify(payload);
  const signer = new SignatureV4({
    credentials,
    region,
    service: "execute-api",
    sha256: Sha256,
  });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    method: "POST",
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      host: endpoint.host,
    },
    body,
  });
  const signed = await signer.sign(request);
  const headers = { ...signed.headers };

  delete headers.host;

  return fetch(url, {
    method: "POST",
    headers,
    body,
  });
}

const request = {
  mode: "prebrief",
  company: "Apex Mutual",
  industry: "Financial Services",
  meetingType: "Executive Briefing",
  companySize: "Enterprise",
  pillars: ["Security", "Reliability", "Cost Optimization"],
  pillarRanking: [
    { rank: 1, pillar: "Security" },
    { rank: 2, pillar: "Reliability" },
    { rank: 3, pillar: "Cost Optimization" },
  ],
  context: "Modernizing a customer portal with audit and migration risk.",
  decisionMakers: [
    {
      name: "Lena Ortiz",
      title: "CIO",
      source: "Customer-approved profile notes",
      context: "Prior notes emphasize board visibility, customer trust, modernization governance, and avoiding a risky big-bang migration.",
    },
  ],
  feedback: ["Reduce AWS jargon"],
  meetingNotes: "Security sponsor asked for migration evidence, owner clarity, and a bounded first pilot.",
  role: "PM",
  prompt: "Create the first two-week plan.",
};

const backend = stackOutputs(backendStack);
const frontend = stackOutputs(frontendStack);
const frontendUrl = frontend.FrontendUrl;
const apiUrl = backend.BriefApiUrl;
const identityPoolId = backend.DemoIdentityPoolId;

if (!frontendUrl || !apiUrl || !identityPoolId) {
  throw new Error("Missing required CloudFormation outputs for smoke test.");
}

const site = await fetch(frontendUrl);
const unsigned = await fetch(apiUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const credentials = await cognitoCredentials(identityPoolId);
const signed = await signedPostJson(apiUrl, request, credentials);
const bodyText = await signed.text();

if (site.status !== 200) {
  throw new Error(`CloudFront site returned HTTP ${site.status}.`);
}

if (unsigned.status !== 403) {
  throw new Error(`Unsigned API should return 403, got HTTP ${unsigned.status}.`);
}

if (!signed.ok) {
  throw new Error(`Signed API returned HTTP ${signed.status}: ${bodyText}`);
}

const body = JSON.parse(bodyText);

if (body.provider !== "bedrock") {
  throw new Error(`Expected provider=bedrock, got ${body.provider}.`);
}

if (!body.metadata?.artifactKey || !body.metadata?.docxArtifactKey || !body.metadata?.stateKey) {
  throw new Error("Live response did not include S3 JSON, S3 DOCX, and DynamoDB state metadata.");
}

if (!body.metadata.artifactKey.endsWith("/latest.json") || !body.metadata.docxArtifactKey.endsWith("/latest.docx")) {
  throw new Error("Live response did not save latest-only JSON and DOCX artifact keys.");
}

if (body.metadata.stateKey !== "BRIEF#LATEST") {
  throw new Error(`Expected DynamoDB stateKey BRIEF#LATEST, got ${body.metadata.stateKey}.`);
}

if (!body.metadata?.guardrailId || !body.metadata?.guardrailVersion) {
  throw new Error("Live response did not include Bedrock guardrail metadata.");
}

console.table({
  cloudFront: site.status,
  unsignedApi: unsigned.status,
  provider: body.provider,
  modelId: body.metadata.modelId,
  guardrailId: body.metadata.guardrailId,
  guardrailVersion: body.metadata.guardrailVersion,
  artifactKey: body.metadata.artifactKey,
  docxArtifactKey: body.metadata.docxArtifactKey,
  stateKey: body.metadata.stateKey,
  totalTokens: body.metadata.totalTokens ?? "n/a",
  latencyMs: body.metadata.latencyMs ?? "n/a",
});