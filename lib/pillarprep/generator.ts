import type {
  BriefRequest,
  BriefResponse,
  DecisionMakerContext,
  ProjectArtifacts,
} from "./types";

function compactList(items: string[]) {
  return items.filter(Boolean).join(", ");
}

function rankedPillarsFromInput(input: BriefRequest) {
  const rankedPillars = input.pillarRanking
    ?.slice()
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.pillar.trim())
    .filter(Boolean);

  return rankedPillars?.length
    ? rankedPillars
    : input.pillars.map((pillar) => pillar.trim()).filter(Boolean);
}

function compactPillarRanking(items: string[], limit = 3) {
  return items
    .slice(0, limit)
    .map((pillar, index) => `${index + 1}. ${pillar}`)
    .join("; ");
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
      {
        title: "Evidence gap",
        owner: "SA / PM",
        status: "Medium",
        detail:
          "The pilot may stall if architecture, control, cost, or success evidence is not captured in a reusable project record.",
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
  const pillars = rankedPillarsFromInput(input);
  const rankedPillars = pillars.length ? pillars : ["Security", "Reliability"];
  const topPillars = rankedPillars.slice(0, 3);
  const primaryPillar = rankedPillars[0] ?? "Security";
  const rankingSummary = compactPillarRanking(topPillars.length ? topPillars : rankedPillars);
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
    rankedPillars,
    decisionMakers,
    focus
  );
  const stakeholderBriefing = [
    ...decisionMakers.slice(0, 3).map((person) => {
      const title = person.title ? ` (${person.title})` : "";
      const signal = person.context
        ? `Use the approved signal as a hypothesis: ${person.context}`
        : `Use the ranked pillar list as the hypothesis, starting with ${primaryPillar}.`;

      return `${person.name || "Decision maker"}${title}: tailor the opening to their role, then validate what they personally need to approve next. ${signal} Ask: "What outcome would make this initiative worth funding, what risk would stop it, and who else must agree before the team moves forward?"`;
    }),
    `Economic buyer to confirm: identify who owns budget, value, and final prioritization for ${company}. Ask: "What business metric will prove this was worth doing, and what date or event is creating urgency?"`,
    `Technical owner to confirm: identify who owns current-state architecture, implementation feasibility, and operating model decisions. Ask: "Where are the highest-risk dependencies, what evidence do you need before approving the target pattern, and what rollback expectation is non-negotiable?"`,
    `Security or compliance approver to confirm: identify who owns control evidence, data boundaries, identity policy, and audit readiness. Ask: "Which controls must be proven before launch, and what documentation would make approval easier?"`,
    `Project driver to confirm: identify who will turn ${company}'s meeting outcomes into owners, timeline, risks, and decisions after the call. Ask: "Who will own follow-through, and what format would keep the project team aligned next week?"`,
  ].slice(0, 4);

  return {
    provider: "demo",
    generatedAt: new Date().toISOString(),
    metadata: {
      projectId: toProjectId(company),
    },
    technical: [
      `${company} should be framed around the ranked Well-Architected priorities (${rankingSummary}), with rank 1 treated as the first discovery lens instead of a generic checkbox. Current-state validation should focus on how ${primaryPillar.toLowerCase()} shows up in the architecture today: identity boundaries, data movement, failure modes, operating ownership, and evidence the customer already has. Ask: "Which current-state assumption would be most dangerous if we got it wrong, and what artifact can we review to validate it before proposing a target design?"`,
      `For a ${input.companySize.toLowerCase()} ${input.industry.toLowerCase()} customer, the SA should convert the meeting into measurable acceptance criteria instead of broad cloud recommendations. Confirm RTO/RPO, compliance scope, latency or throughput targets, incident response ownership, release/change process, and dependency constraints that could shape the first pilot. Ask: "What has to be true for your technical leads, security team, and business sponsor to all call this safe enough to proceed?"`,
      `The AWS path should be discussed as an implementation option only after the customer's risks are clear: API Gateway and Lambda for controlled orchestration, Bedrock for generation, S3 for artifacts, DynamoDB for project state, CloudWatch for observability, and Knowledge Bases for approved project memory. Tie every service mention to a customer decision, not a feature tour. Ask: "Which decision do you need AWS to make easier: reducing risk, speeding delivery, proving compliance, improving reliability, or controlling cost?"`,
      `Use the ranked pillar order to shape the proof plan for ${company}: rank 1 gets the deepest evidence review, ranks 2 and 3 become tradeoff checks, and lower-ranked pillars stay visible so they are not ignored. Capture which artifacts are missing, who owns each artifact, and how a pilot would prove the riskiest assumption. Ask: "What proof would let us move from discussion to a small approved pilot?"`,
    ],
    executive: [
      `${company} is balancing speed with risk control, so the executive conversation should start with ${focus} rather than architecture diagrams. The strongest framing is that PillarPrep improves decision quality before the meeting and preserves follow-through after the meeting, reducing the chance that good discovery turns into scattered notes. Ask: "What business outcome would make this meeting a success 30 days from now?"`,
      `The business case should emphasize fewer missed risks, faster alignment across sales/SA/project teams, and a clearer path from discussion to pilot. Avoid AWS jargon unless an executive asks how it works; describe the result as a repeatable way to prepare, validate assumptions, and turn meeting outcomes into owners, risks, and next actions. Ask: "Where do projects like this usually slow down: funding, security approval, technical uncertainty, or lack of ownership?"`,
      `For the sponsor, the important decision is whether to approve a bounded validation sprint with clear success measures, decision owners, and evidence checkpoints. ${stakeholderText} ${feedback} Ask: "What would make you comfortable saying yes to the next step, and what evidence would you need before scaling beyond a pilot?"`,
      `Frame the ROI for ${company} as decision speed and rework reduction: better prep should reduce repeated discovery, unclear handoffs, and late risk surprises. The executive sponsor does not need a service tour; they need confidence that the team can move in a controlled way and know when to stop, pivot, or expand. Ask: "Which delay costs more right now: waiting for perfect information, or moving forward without enough evidence?"`,
    ],
    stakeholders: stakeholderBriefing,
    gameplan: [
      `Open with a tight purpose statement: "We are here to validate the assumptions behind ${company}'s ${input.meetingType.toLowerCase()} and agree on the evidence needed for a safe next step." Then confirm the business event driving urgency, the decision owner, and the ranked pillar order before going deep. Ask: "Is ${primaryPillar} really the first priority, or should we reorder the conversation based on what is most likely to block approval?"`,
      stakeholderLead
        ? `Use ${stakeholderLead.name || "the primary stakeholder"} as the first anchor, but do not overfit to one person. Ask them what success looks like, what risk would slow approval, who else needs to be in the decision, and what proof would change their confidence level. Then map the answers back to the ranked pillars so the technical discussion stays connected to sponsor value.`
        : `Identify the economic buyer, technical owner, security approver, and project driver before going deep. Ask each role a different question: the buyer gets value and timing, the technical owner gets constraints and evidence, security gets control requirements, and the project driver gets owners and next steps. Use the answers to decide whether the meeting should stay at discovery level or move into architecture detail.` ,
      `Spend the middle of the meeting on rank 1 ${primaryPillar.toLowerCase()} tradeoffs, then use ranks 2 and 3 to shape secondary discovery. Ask: "Which unresolved question is most likely to delay approval if we do not answer it this week?"`,
      `Close by reading back the agreed success measure, owner list, risks, unresolved questions, timeline, and how the Project Brain handoff will be used after the call. Do the readback while customer stakeholders are still present so corrections become shared truth immediately. Ask: "What should we capture now so the implementation team does not have to rediscover it later?"`,
    ],
    objections: [
      `Concern: "We do not have enough reliable context." Response: agree and make that the operating model: every generated recommendation is a hypothesis until the customer validates it with artifacts, owner confirmation, or meeting notes. Ask: "Which assumption should we validate first because it would change the plan the most?"`,
      `Concern: "This feels too AWS-heavy." Response: separate the executive story from the technical implementation path; lead with outcomes, risks, decision speed, and ownership, then use AWS services only where they make a specific decision easier. Ask: "Would it be more useful to compare business outcomes first and leave service mapping for the technical deep dive?"`,
      stakeholderLead
        ? `Concern: "${stakeholderLead.name || "The sponsor"} may not see why this is relevant." Response: connect the recommendation to the approved stakeholder signal, then ask what has changed since those notes were captured. Ask: "Which priority should we retire, update, or elevate based on today's business reality?"`
        : `Concern: "We do not know what the decision makers care about." Response: capture approved stakeholder context before the follow-up and use Project Brain to refresh the plan from known notes, not guessed profile data. Ask: "Who must approve the business case, technical plan, security posture, and funding path?"`,
      `Concern: "The generated brief may be wrong." Response: agree, then position the brief as a structured hypothesis map that speeds validation rather than replacing customer discovery. Ask: "Which assumption should we mark as highest risk until your team confirms it?"`,
    ],
    projectAnswer: `For ${input.role ?? "the project team"}, use the generated brief as the starting project model, not as final truth. The next useful move is a two-week sprint, structured as a validation sprint for ${company}: confirm stakeholders, validate rank 1 ${primaryPillar.toLowerCase()} assumptions, review current-state evidence, turn meeting notes into owners and risks, and publish a decision log that sales, SA, engineering, and the sponsor can all reuse. For the prompt "${input.prompt ?? "What should we do next?"}", answer with concrete owner-based actions, the evidence needed to proceed, and the blocker that should be escalated first${stakeholderLead ? ` with ${stakeholderLead.name || "the primary stakeholder"}` : ""}.`,
    projectArtifacts,
    citations: [
      "Customer-provided context",
      ...(decisionMakers.length
        ? ["Decision-maker context (user-provided)"]
        : []),
      "SA refinement feedback",
      "Ranked AWS Well-Architected pillars",
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
    input.pillarRanking !== undefined &&
    !Array.isArray(input.pillarRanking)
  ) {
    return "pillarRanking must be an array";
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
