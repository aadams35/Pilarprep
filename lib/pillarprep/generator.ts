import type {
  BriefRequest,
  BriefResponse,
  DecisionMakerContext,
  ProjectArtifacts,
} from "./types";

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

function normalizeDecisionMakers(
  decisionMakers: DecisionMakerContext[] | undefined
) {
  return (decisionMakers ?? [])
    .map((person) => ({
      name: person.name?.trim() ?? "",
      title: person.title?.trim() ?? "",
      source: person.source?.trim() ?? "",
      context: person.context?.trim() ?? "",
    }))
    .filter((person) => person.name || person.title || person.context);
}

function describeDecisionMaker(person: DecisionMakerContext, focus: string) {
  const name = person.name || "Decision maker";
  const title = person.title ? `, ${person.title}` : "";
  const source = person.source ? ` Source: ${person.source}.` : "";
  const context = person.context
    ? ` Signal: ${person.context}`
    : ` Signal: likely focused on ${focus}.`;

  return `${name}${title}: map questions to their priorities and confirm what success, risk, and blockers look like from their seat.${context}${source}`;
}

function buildProjectArtifacts(
  input: BriefRequest,
  company: string,
  pillars: string[],
  decisionMakers: DecisionMakerContext[],
  focus: string
): ProjectArtifacts {
  const primaryPillar = pillars[0] ?? "Security";
  const sponsor = decisionMakers[0]?.name || "executive sponsor";

  return {
    twoWeekPlan: [
      {
        title: "Days 1-2",
        owner: "SA / Sales",
        status: "Ready",
        detail: `Confirm ${company} stakeholders, success criteria, decision process, and the business event driving urgency.`,
      },
      {
        title: "Days 3-5",
        owner: "SA / Engineer",
        status: "Ready",
        detail: `Validate current-state assumptions and the top ${primaryPillar.toLowerCase()} risks before proposing architecture.`,
      },
      {
        title: "Days 6-8",
        owner: "Engineer",
        status: "Draft",
        detail:
          "Map integration boundaries, data flow, rollback requirements, observability, and the smallest useful pilot scope.",
      },
      {
        title: "Days 9-10",
        owner: "PM / Sponsor",
        status: "Draft",
        detail: `Publish the decision log, risk register, pilot recommendation, and sponsor alignment path with ${sponsor}.`,
      },
    ],
    riskRegister: [
      {
        title: "Unvalidated assumptions",
        owner: "SA",
        status: "High",
        detail: `Generated recommendations can overfit before ${company}'s current state is confirmed. Keep assumptions visible until discovery validates them.`,
      },
      {
        title: `${primaryPillar} ownership gap`,
        owner: "Customer owner",
        status: "Medium",
        detail:
          "The project may stall if the highest-risk pillar lacks a named decision maker and technical owner.",
      },
      {
        title: "Narrative drift",
        owner: "PM",
        status: "Medium",
        detail:
          "Technical and executive tracks can diverge. Keep every architecture task connected to a measurable business outcome.",
      },
    ],
    stakeholderMap: decisionMakers.length
      ? decisionMakers.map((person) => ({
          title: person.name || "Decision maker",
          owner: person.title || "Role to confirm",
          status: "Validate",
          detail:
            person.context ||
            `Confirm how this stakeholder defines success around ${focus}.`,
        }))
      : [
          {
            title: "Economic buyer",
            owner: "To confirm",
            status: "Needed",
            detail:
              "Identify who owns budget approval, business value, and final prioritization.",
          },
          {
            title: "Technical owner",
            owner: "To confirm",
            status: "Needed",
            detail:
              "Identify who owns current-state validation, architecture decisions, and implementation tradeoffs.",
          },
        ],
    followUpEmail: {
      subject: `Follow-up from PillarPrep briefing for ${company}`,
      body: `Thanks for the conversation. We captured ${focus} as the main business context and ${primaryPillar.toLowerCase()} as the first technical validation area.\n\nRecommended next step: run a focused working session to confirm stakeholders, current-state assumptions, success criteria, risks, and pilot scope.\n\nWe will use the approved brief, decision-maker notes, meeting outcomes, and owner list as the shared project context.`,
    },
  };
}

export function generateDemoBrief(input: BriefRequest): BriefResponse {
  const company = input.company.trim() || "the customer";
  const pillars = input.pillars.length ? input.pillars : ["Security", "Reliability"];
  const primaryPillar = pillars[0] ?? "Security";
  const decisionMakers = normalizeDecisionMakers(input.decisionMakers);
  const stakeholderLead = decisionMakers[0];
  const feedback = input.feedback?.length
    ? `Refinements applied: ${compactList(input.feedback)}.`
    : "No extra refinement feedback applied yet.";
  const focus = industryFocus(input.industry);
  const stakeholderText = stakeholderLead
    ? `Decision-maker angle: anchor the conversation to ${stakeholderLead.name || "the primary stakeholder"}${stakeholderLead.title ? ` (${stakeholderLead.title})` : ""} and validate the priorities captured in the approved profile notes.`
    : "Decision-maker angle: add approved stakeholder notes to tailor the opening, questions, and objection handling.";
  const projectArtifacts = buildProjectArtifacts(
    input,
    company,
    pillars,
    decisionMakers,
    focus
  );

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
      `Keep AWS details in the background unless the sponsor asks how it works. ${stakeholderText} ${feedback}`,
    ],
    stakeholders: decisionMakers.length
      ? decisionMakers.map((person) => describeDecisionMaker(person, focus))
      : [
          "No decision-maker notes were provided. Ask who owns business approval, technical approval, security approval, and budget approval before proposing next steps.",
          `For ${company}, prepare one executive sponsor question, one technical owner question, and one blocker question around ${focus}.`,
          "Use only customer-approved or manually provided stakeholder context; do not infer facts from unverified profile data.",
        ],
    gameplan: [
      `Open by confirming the business event driving urgency for ${company}.`,
      stakeholderLead
        ? `Ask ${stakeholderLead.name || "the primary stakeholder"} what would make this meeting successful and what concern would slow approval.`
        : "Identify the economic buyer, technical owner, security approver, and project driver before going deep.",
      `Spend the middle of the meeting on ${primaryPillar.toLowerCase()} tradeoffs and unknowns.`,
      "Close with an agreed success measure, owner list, risks, timeline, and how the Project Brain handoff should be used.",
    ],
    objections: [
      "Concern: We do not have enough reliable context. Response: treat generated content as hypotheses, then validate assumptions in discovery.",
      `Concern: This may be too AWS-heavy. Response: tune the executive version around outcomes and keep service names in the technical brief.`,
      stakeholderLead
        ? `Concern: ${stakeholderLead.name || "The sponsor"} may challenge relevance. Response: connect the recommendation to the priorities captured in the approved stakeholder notes, then ask what changed.`
        : "Concern: We may not know what the decision makers care about. Response: capture approved stakeholder context before the follow-up and refresh Project Brain.",
      `Concern: Follow-through gets lost after the meeting. Response: use the generated brief plus notes to auto-build a role-aware Project Brain.`,
    ],
    projectAnswer: `For ${input.role ?? "the project team"}, start from the latest brief, meeting outcomes, stakeholder notes, open risks, and owners. For the prompt "${input.prompt ?? "What should we do next?"}", recommend a two-week sprint to validate ${primaryPillar.toLowerCase()}, publish a decision log, and align the sponsor on success criteria${stakeholderLead ? ` with ${stakeholderLead.name || "the primary stakeholder"}` : ""}.`,
    projectArtifacts,
    citations: [
      "Customer-provided context",
      ...(decisionMakers.length
        ? ["Decision-maker context (user-provided)"]
        : []),
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

  if (
    input.decisionMakers !== undefined &&
    !Array.isArray(input.decisionMakers)
  ) {
    return "decisionMakers must be an array";
  }

  if (!input.context?.trim()) {
    return "context is required";
  }

  return null;
}
