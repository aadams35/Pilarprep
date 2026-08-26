import type {
  BriefEvidence,
  BriefResponse,
  BusinessCase,
  FollowUpEmailArtifact,
  NextStepAction,
  ProjectNextSteps,
  ProjectArtifactItem,
  ProjectArtifacts,
  RefinementTarget,
} from "./types";

const providers = new Set(["demo", "bedrock", "strands", "agentcore"]);
const refinementTargets = new Set(["businessCase", "technical", "executive", "stakeholders", "gameplan", "objections"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
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

function asRefinementInstructions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const category = asString(item.category);
    const instruction = asString(item.instruction);
    return category && instruction ? [{ category, instruction }] : [];
  });
}

function asBusinessCase(value: unknown): BusinessCase {
  const source = isRecord(value) ? value : {};
  const scenario = asString(
    source.scenario,
    "Confirm the customer's current situation and why this meeting matters."
  );
  return {
    scenario,
    whyNow: asString(
      source.whyNow,
      "Confirm the business event, customer impact, timing pressure, and consequence of waiting."
    ),
    currentSituation: asString(
      source.currentSituation,
      scenario
    ),
    desiredOutcomes: asString(source.desiredOutcomes, "Agree on measurable business and technical outcomes."),
    successCriteria: asString(source.successCriteria, "Named owners, agreed evidence, and a clear decision gate for the next step."),
    businessRisks: asString(
      source.businessRisks,
      "Validate the customer, operational, financial, governance, and delivery risks before recommending a path."
    ),
    decisionRequired: asString(
      source.decisionRequired,
      "Agree on the decision this meeting should enable and who has authority to make it."
    ),
    inScope: asString(source.inScope, "Business outcomes, current-state constraints, priority risks, and the next decision."),
    outOfScope: asString(source.outOfScope, "Final architecture commitments, implementation estimates, and unvalidated customer facts."),
    assumptionsAndUnknowns: asString(
      source.assumptionsAndUnknowns,
      "Separate confirmed facts from working assumptions and turn unsupported claims into discovery questions."
    ),
    stakeholderAlignment: asString(
      source.stakeholderAlignment,
      "Confirm the sponsor, technical owner, risk approver, project driver, and their decision criteria."
    ),
    alignmentStatement: asString(source.alignmentStatement, "We will confirm the outcome, constraints, and evidence needed for a safe next step."),
    nextStepGuidance: asString(
      source.nextStepGuidance,
      "Close with named actions, owners, timing, dependencies, evidence, and the next decision checkpoint."
    ),
  };
}

function asNextStepAction(value: unknown): NextStepAction | null {
  if (!isRecord(value) || !asString(value.action)) return null;
  return {
    action: asString(value.action),
    owner: asString(value.owner, "Owner TBD"),
    timing: asString(value.timing, "Timing to confirm"),
    dependency: asString(value.dependency, "Dependency to confirm"),
    decisionGate: asString(value.decisionGate, "Decision gate to confirm"),
  };
}

function asNextStepActions(value: unknown) {
  return Array.isArray(value)
    ? value.map(asNextStepAction).filter((item): item is NextStepAction => Boolean(item))
    : [];
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
    tokenUsageSource:
      value.tokenUsageSource === "reported" || value.tokenUsageSource === "estimated"
        ? (value.tokenUsageSource as "reported" | "estimated")
        : undefined,
    estimatedModelCostUsd: asNumber(value.estimatedModelCostUsd),
    latencyMs: asNumber(value.latencyMs),
    agentSessionId: asString(value.agentSessionId) || undefined,
    agentTraceId: asString(value.agentTraceId) || undefined,
    agentMode: asString(value.agentMode) || undefined,
    memoryUsed: asBoolean(value.memoryUsed),
    gatewayUsed: asBoolean(value.gatewayUsed),
    fallbackUsed: asBoolean(value.fallbackUsed),
    fallbackReason: asString(value.fallbackReason) || undefined,
    modelStopReason: asString(value.modelStopReason) || undefined,
    performanceLatency:
      value.performanceLatency === "standard" || value.performanceLatency === "optimized"
        ? (value.performanceLatency as "standard" | "optimized")
        : undefined,
    projectVersion: asNumber(value.projectVersion),
    baseBriefVersion: asNumber(value.baseBriefVersion),
    packetVersion: asNumber(value.packetVersion),
    refinementTarget: refinementTargets.has(asString(value.refinementTarget))
      ? (asString(value.refinementTarget) as RefinementTarget)
      : undefined,
    refinementSections: asStringList(value.refinementSections),
    refinementInstructionCount: asNumber(value.refinementInstructionCount),
    changedSectionIds: asStringList(value.changedSectionIds).filter((section) =>
      refinementTargets.has(section)
    ) as RefinementTarget[],
    unauthorizedSectionChanges: asNumber(value.unauthorizedSectionChanges),
    refinementIsolationPassed: asBoolean(value.refinementIsolationPassed),
    refinementChangedPassages: asNumber(value.refinementChangedPassages),
    changedPassageIds: asStringList(value.changedPassageIds),
    refinementMinimumChangedPassages: asNumber(value.refinementMinimumChangedPassages),
    refinementCoveragePassed: asBoolean(value.refinementCoveragePassed),
    refinementLatencyMs: asNumber(value.refinementLatencyMs),
    appliedFeedback: asRefinementInstructions(value.appliedFeedback),
    supersededFacts: asStringList(value.supersededFacts),
    contradictionValidationPassed: asBoolean(value.contradictionValidationPassed),
    contradictionFindings: asStringList(value.contradictionFindings),
    generationAttempts: asNumber(value.generationAttempts),
    retryReason: asString(value.retryReason) || undefined,
    toolCalls: asStringList(value.toolCalls),
  };
}

const evidenceSections = new Set([
  "businessCase",
  "technical",
  "executive",
  "stakeholders",
  "gameplan",
  "objections",
  "projectAnswer",
]);

function asEvidence(value: unknown): BriefEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || !evidenceSections.has(asString(item.section))) {
      return [];
    }

    const itemIndex = asNumber(item.itemIndex);
    const sources = asStringList(item.sources);
    if (itemIndex === undefined || itemIndex < 0 || !sources.length) {
      return [];
    }

    return [{
      section: asString(item.section) as BriefEvidence["section"],
      itemIndex,
      sources,
    }];
  });
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
function asNextSteps(value: unknown): ProjectNextSteps {
  const source = isRecord(value) ? value : {};
  const meeting = isRecord(source.nextMeeting) ? source.nextMeeting : {};
  return {
    immediateActions: asNextStepActions(source.immediateActions),
    openQuestions: asStringList(source.openQuestions),
    nextMeeting: {
      purpose: asString(meeting.purpose, "Validate the highest-risk assumptions and agree on the next decision."),
      timing: asString(meeting.timing, "Within one week"),
      attendees: asStringList(meeting.attendees, ["Executive sponsor", "Technical owner", "SA"]),
    },
    customerSummary: asString(source.customerSummary, "Confirm the agreed outcomes, owners, evidence, and next decision with the customer."),
    internalNotes: asString(source.internalNotes, "Keep assumptions visible and update project state only from approved meeting outcomes."),
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
    nextSteps: asNextSteps(value.nextSteps),
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
    businessCase: asBusinessCase(source.businessCase),
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
    evidence: asEvidence(source.evidence),
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
