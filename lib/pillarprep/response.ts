import type {
  BriefResponse,
  FollowUpEmailArtifact,
  ProjectArtifactItem,
  ProjectArtifacts,
} from "./types";

const providers = new Set(["demo", "bedrock", "strands"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function asMetadata(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    projectId: asString(value.projectId) || undefined,
    clientId: asString(value.clientId) || undefined,
    artifactKey: asString(value.artifactKey) || undefined,
    docxArtifactKey: asString(value.docxArtifactKey) || undefined,
    docxDownloadUrl: asString(value.docxDownloadUrl) || undefined,
    artifactRetention: asString(value.artifactRetention) || undefined,
    stateKey: asString(value.stateKey) || undefined,
    storageWarning: asString(value.storageWarning) || undefined,
    guardrailId: asString(value.guardrailId) || undefined,
    guardrailVersion: asString(value.guardrailVersion) || undefined,
    modelId: asString(value.modelId) || undefined,
    inputTokens: asNumber(value.inputTokens),
    outputTokens: asNumber(value.outputTokens),
    totalTokens: asNumber(value.totalTokens),
    latencyMs: asNumber(value.latencyMs),
  };
}

function asArtifactItem(value: unknown): ProjectArtifactItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = asString(value.title);
  const detail = asString(value.detail);

  if (!title && !detail) {
    return null;
  }

  return {
    title: title || "Artifact item",
    detail: detail || "No detail returned.",
    owner: asString(value.owner) || undefined,
    status: asString(value.status) || undefined,
  };
}

function asArtifactList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asArtifactItem(item))
    .filter((item): item is ProjectArtifactItem => Boolean(item));
}

function asFollowUpEmail(value: unknown): FollowUpEmailArtifact {
  if (!isRecord(value)) {
    return {
      subject: "PilarPrep follow-up",
      body: "Promote the approved brief and meeting notes to draft a follow-up email.",
    };
  }

  return {
    subject: asString(value.subject, "PilarPrep follow-up"),
    body: asString(
      value.body,
      "Promote the approved brief and meeting notes to draft a follow-up email."
    ),
  };
}

function asProjectArtifacts(value: unknown): ProjectArtifacts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    twoWeekPlan: asArtifactList(value.twoWeekPlan),
    riskRegister: asArtifactList(value.riskRegister),
    stakeholderMap: asArtifactList(value.stakeholderMap),
    followUpEmail: asFollowUpEmail(value.followUpEmail),
  };
}

function asProvider(value: unknown, fallbackProvider: BriefResponse["provider"]) {
  return typeof value === "string" && providers.has(value)
    ? (value as BriefResponse["provider"])
    : fallbackProvider;
}

export function normalizeBriefResponse(
  value: unknown,
  fallbackProvider: BriefResponse["provider"]
): BriefResponse {
  const source = isRecord(value) ? value : {};

  return {
    provider: asProvider(source.provider, fallbackProvider),
    generatedAt: asString(source.generatedAt, new Date().toISOString()),
    metadata: asMetadata(source.metadata),
    technical: asStringList(source.technical, [
      "Technical brief was not returned by the model. Regenerate after checking the backend response contract.",
    ]),
    executive: asStringList(source.executive, [
      "Executive brief was not returned by the model. Regenerate after checking the backend response contract.",
    ]),
    stakeholders: asStringList(source.stakeholders, [
      "Stakeholder lens was not returned by the model. Use approved decision-maker notes as hypotheses to validate.",
    ]),
    gameplan: asStringList(source.gameplan, [
      "SA game plan was not returned by the model. Confirm meeting objective, owners, risks, and next steps.",
    ]),
    objections: asStringList(source.objections, [
      "Objection guidance was not returned by the model. Treat this as an item to refine before the customer meeting.",
    ]),
    projectAnswer: asString(
      source.projectAnswer,
      "Project Brain did not return an answer yet. Promote the final brief with meeting notes, then ask again."
    ),
    projectArtifacts: asProjectArtifacts(source.projectArtifacts),
    citations: asStringList(source.citations, [
      fallbackProvider === "bedrock"
        ? "Amazon Bedrock response"
        : "PilarPrep demo generator",
    ]),
  };
}

export function extractBackendError(body: string) {
  if (!body.trim()) {
    return "AWS backend request failed";
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed)) {
      return asString(parsed.error) || asString(parsed.message) || body;
    }
  } catch {
    // Keep the original body when the backend returned plain text.
  }

  return body;
}
