import type { BriefRequest, BriefResponse } from "./types";

function compactList(items: string[]) {
  return items.filter(Boolean).join(", ");
}

function industryFocus(industry: string) {
  if (industry === "Financial Services") {
    return "auditability, identity controls, regulatory evidence, and migration risk";
  }

  if (industry === "Healthcare") {
    return "patient access, protected health data, continuity, and compliance evidence";
  }

  if (industry === "Retail") {
    return "traffic elasticity, checkout latency, conversion protection, and unit cost";
  }

  if (industry === "Manufacturing") {
    return "plant continuity, data pipelines, forecasting, and operational uptime";
  }

  if (industry === "Media") {
    return "global delivery, content workflow speed, burst traffic, and monetization";
  }

  if (industry === "SaaS") {
    return "tenant isolation, reliability, platform velocity, and growth efficiency";
  }

  return "modernization, reliability, security, and measurable business outcomes";
}

function toProjectId(company: string) {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug ? `demo-${slug}` : "demo-customer";
}

export function generateDemoBrief(input: BriefRequest): BriefResponse {
  const company = input.company.trim() || "the customer";
  const pillars = input.pillars.length ? input.pillars : ["Security", "Reliability"];
  const primaryPillar = pillars[0] ?? "Security";
  const feedback = input.feedback?.length
    ? `Refinements applied: ${compactList(input.feedback)}.`
    : "No extra refinement feedback applied yet.";
  const focus = industryFocus(input.industry);

  return {
    provider: "demo",
    generatedAt: new Date().toISOString(),
    metadata: {
      projectId: toProjectId(company),
    },
    technical: [
      `${company} should be framed around ${compactList(pillars)} with current-state validation before architecture commitment.`,
      `Validate identity boundaries, data classification, integration dependencies, RTO/RPO, observability, and operational ownership across ${input.companySize.toLowerCase()} teams.`,
      `AWS path: API Gateway and Lambda for orchestration, Amazon Bedrock for generation, S3 for brief artifacts, DynamoDB for project state, CloudWatch for telemetry, and Knowledge Bases for project memory.`,
    ],
    executive: [
      `${company} is balancing speed with risk control. Keep the business discussion centered on ${focus}.`,
      `Outcome framing: reduce prep time, improve meeting quality, preserve institutional context, and make follow-through measurable.`,
      `Keep AWS details in the background unless the sponsor asks how it works. ${feedback}`,
    ],
    gameplan: [
      `Open by confirming the business event driving urgency for ${company}.`,
      `Spend the middle of the meeting on ${primaryPillar.toLowerCase()} tradeoffs and unknowns.`,
      "Close with an agreed success measure, owner list, risks, timeline, and whether the final brief should be promoted into Project Brain.",
    ],
    objections: [
      "Concern: We do not have enough reliable context. Response: treat generated content as hypotheses, then validate assumptions in discovery.",
      `Concern: This may be too AWS-heavy. Response: tune the executive version around outcomes and keep service names in the technical brief.`,
      `Concern: Follow-through gets lost after the meeting. Response: promote the approved brief plus notes into a role-aware Project Brain.`,
    ],
    projectAnswer:
      input.mode === "project"
        ? `For ${input.role ?? "the project team"}, start from the approved brief, meeting outcomes, open risks, and owners. For the prompt "${input.prompt ?? "What should we do next?"}", recommend a two-week sprint to validate ${primaryPillar.toLowerCase()}, publish a decision log, and align the sponsor on success criteria.`
        : `After approval, promote ${company}'s final brief and meeting notes into Project Brain so sales, executives, PMs, engineers, and new team members can ask role-specific follow-up questions.`,
    citations: [
      "Customer-provided context",
      "SA refinement feedback",
      "AWS Well-Architected pillars",
      "Bedrock-ready prompt contract",
    ],
  };
}

export function validateBriefRequest(input: Partial<BriefRequest>) {
  if (!input.company?.trim()) {
    return "company is required";
  }

  if (!input.industry?.trim()) {
    return "industry is required";
  }

  if (!input.meetingType?.trim()) {
    return "meetingType is required";
  }

  if (!input.companySize?.trim()) {
    return "companySize is required";
  }

  if (!Array.isArray(input.pillars)) {
    return "pillars must be an array";
  }

  if (!input.context?.trim()) {
    return "context is required";
  }

  return null;
}
