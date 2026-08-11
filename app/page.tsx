"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cognitoIdentityCredentialsProvider,
  signedJsonFetch,
} from "@/lib/pillarprep/aws-sigv4";
import { generateDemoBrief, validateBriefRequest } from "@/lib/pillarprep/generator";
import {
  extractBackendError,
  normalizeBriefResponse,
} from "@/lib/pillarprep/response";
import type {
  BriefRequest,
  BriefResponse,
  DecisionMakerContext,
  ProjectArtifactItem,
} from "@/lib/pillarprep/types";

type BriefTab =
  | "technical"
  | "executive"
  | "stakeholders"
  | "gameplan"
  | "objections";
type AudienceRole = "Sales" | "Executive" | "PM" | "Engineer" | "New member";
type RiskLevel = "Low" | "Medium" | "High";
type GenerationMode = "demo" | "live";
type ModelStatus = { checked: boolean; liveConfigured: boolean; apiKeyConfigured: boolean; authMode?: string };
type ConsolePage = "setup" | "brief" | "project" | "aws";

type Scenario = {
  id: string;
  name: string;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  context: string;
  decisionMakers: DecisionMakerContext[];
  meetingNotes: string;
  challenge: string;
  winTheme: string;
};

const industries = [
  "Financial Services",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Media",
  "SaaS",
  "Other",
];

const meetingTypes = [
  "Discovery Call",
  "Technical Deep Dive",
  "Executive Briefing",
];

const companySizes = ["Startup", "Mid-market", "Enterprise"];

const scenarios: Scenario[] = [
  {
    id: "apex",
    name: "Financial modernization",
    company: "Apex Mutual",
    industry: "Financial Services",
    meetingType: "Executive Briefing",
    companySize: "Enterprise",
    pillars: ["Security", "Reliability", "Cost Optimization"],
    context:
      "Customer is modernizing a customer portal, worried about compliance, and wants a clearer migration path without disrupting peak business periods.",
    decisionMakers: [
      {
        name: "Lena Ortiz",
        title: "CIO",
        source: "Customer-approved profile notes",
        context:
          "Prior notes emphasize board visibility, customer trust, modernization governance, and avoiding a risky big-bang migration.",
      },
      {
        name: "Marcus Reed",
        title: "CISO",
        source: "Customer-approved profile notes",
        context:
          "Security leadership has focused on audit evidence, identity boundaries, data residency, and incident readiness.",
      },
    ],
    meetingNotes:
      "CIO wants an executive-ready modernization path. Security asked for identity boundaries, audit evidence, and a migration pilot before committing to a broader program.",
    challenge: "Risk-sensitive modernization",
    winTheme: "Move faster without weakening trust or auditability.",
  },
  {
    id: "northstar",
    name: "Healthcare continuity",
    company: "Northstar Health",
    industry: "Healthcare",
    meetingType: "Technical Deep Dive",
    companySize: "Enterprise",
    pillars: ["Security", "Reliability", "Operational Excellence"],
    context:
      "Hospital network is consolidating patient scheduling systems and needs stronger disaster recovery, lower support burden, and clear compliance controls.",
    decisionMakers: [
      {
        name: "Priya Shah",
        title: "VP Patient Access",
        source: "Customer-approved profile notes",
        context:
          "Public themes center on patient access, scheduling reliability, care team efficiency, and minimizing disruption during system changes.",
      },
      {
        name: "Daniel Brooks",
        title: "Director of Enterprise Architecture",
        source: "Customer-approved profile notes",
        context:
          "Architecture notes emphasize interoperability, resilient integration patterns, and reducing manual operational support.",
      },
    ],
    meetingNotes:
      "Architecture team needs RTO/RPO options, data classification, and phased cutover patterns. Compliance team wants explicit evidence paths and fewer manual review steps.",
    challenge: "Patient-facing availability",
    winTheme: "Protect patient access while simplifying operations.",
  },
  {
    id: "peakcart",
    name: "Retail peak season",
    company: "PeakCart Retail",
    industry: "Retail",
    meetingType: "Discovery Call",
    companySize: "Mid-market",
    pillars: ["Performance Efficiency", "Cost Optimization", "Reliability"],
    context:
      "Digital commerce team is preparing for peak season. They need better elasticity, fewer checkout incidents, and a clearer cost story for executive sponsors.",
    decisionMakers: [
      {
        name: "Emma Chen",
        title: "VP Digital",
        source: "Customer-approved profile notes",
        context:
          "Recent themes focus on conversion, faster campaign launches, loyalty growth, and protecting customer experience during peak traffic.",
      },
      {
        name: "Luis Ramirez",
        title: "Platform Engineering Lead",
        source: "Customer-approved profile notes",
        context:
          "Engineering priorities include rollback confidence, load-test evidence, observability, and predictable cloud spend.",
      },
    ],
    meetingNotes:
      "VP of Digital cares about conversion and launch speed. Engineering wants load-test targets, rollback patterns, and cost controls before seasonal traffic ramps.",
    challenge: "Elastic customer experience",
    winTheme: "Keep checkout fast, reliable, and cost-aware during traffic spikes.",
  },
];

const pillars = [
  {
    id: "Operational Excellence",
    short: "Ops",
    tone: "Improve operating rhythm and measurable ownership.",
    risk: "Medium" as RiskLevel,
    color: "bg-cyan-500",
  },
  {
    id: "Security",
    short: "Security",
    tone: "Protect identities, data, and customer trust.",
    risk: "High" as RiskLevel,
    color: "bg-red-500",
  },
  {
    id: "Reliability",
    short: "Reliability",
    tone: "Recover quickly and reduce customer-facing disruption.",
    risk: "High" as RiskLevel,
    color: "bg-amber-500",
  },
  {
    id: "Performance Efficiency",
    short: "Performance",
    tone: "Keep latency low while demand changes.",
    risk: "Medium" as RiskLevel,
    color: "bg-blue-500",
  },
  {
    id: "Cost Optimization",
    short: "Cost",
    tone: "Connect spend to outcomes and unit economics.",
    risk: "High" as RiskLevel,
    color: "bg-emerald-500",
  },
  {
    id: "Sustainability",
    short: "Sustainability",
    tone: "Right-size resources and reduce waste.",
    risk: "Low" as RiskLevel,
    color: "bg-lime-500",
  },
];

function normalizePillarRanking(items: string[] | undefined) {
  const knownPillars = new Set(pillars.map((pillar) => pillar.id));
  const ranked: string[] = [];

  for (const item of items ?? []) {
    if (knownPillars.has(item) && !ranked.includes(item)) {
      ranked.push(item);
    }
  }

  for (const pillar of pillars) {
    if (!ranked.includes(pillar.id)) {
      ranked.push(pillar.id);
    }
  }

  return ranked;
}

function buildPillarRanking(items: string[]) {
  return items.map((pillar, index) => ({
    rank: index + 1,
    pillar,
  }));
}
const feedbackOptions = [
  "Make it more executive",
  "Add stronger technical depth",
  "Reduce AWS jargon",
  "Focus on security",
  "Add cost angle",
  "Improve discovery questions",
  "Customer is already on AWS",
  "Customer is migrating from on-prem",
];

const defaultFeedback = ["Make it more executive", "Focus on security"];
const defaultRole: AudienceRole = "PM";
const workspaceStorageKey = "pillarprep.workspace.v1";
const hostedBackendUrl = (import.meta.env.VITE_PILLARPREP_BACKEND_URL ?? "").trim();
const hostedBackendRegion = (import.meta.env.VITE_PILLARPREP_BACKEND_REGION ?? "us-east-1").trim();
const hostedIdentityPoolId = (import.meta.env.VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID ?? "").trim();
const staticDemoMode = import.meta.env.VITE_PILLARPREP_STATIC_DEMO === "true";
const hostedIamMode = Boolean(hostedBackendUrl && hostedIdentityPoolId);
const liveModeAvailable = !staticDemoMode || hostedIamMode;

const rolePrompts: Record<AudienceRole, string[]> = {
  Sales: [
    "What should we say in the follow-up email?",
    "Which outcome should we lead with?",
    "What objections should we prepare for?",
  ],
  Executive: [
    "Summarize the project in 60 seconds.",
    "What business risks are we reducing?",
    "What decisions need sponsor alignment?",
  ],
  PM: [
    "Create the first two-week plan.",
    "What dependencies should I track?",
    "Which decisions are still open?",
  ],
  Engineer: [
    "What should we build first?",
    "What AWS services are in scope?",
    "What assumptions need validation?",
  ],
  "New member": [
    "What is this project about?",
    "What did the customer care about?",
    "Where should I start?",
  ],
};

const lifecycleStages = [
  "Context",
  "AI Brief",
  "Review",
  "Approve",
  "Project Model",
  "Handoff",
];

const evidenceSources = [
  "Customer notes",
  "SA feedback",
  "AWS Well-Architected",
  "Bedrock Knowledge Base",
];

const storyBeats = [
  {
    time: "0:00",
    title: "Select the customer",
    detail: "Choose a scenario and show how sparse context becomes structured prep.",
  },
  {
    time: "0:25",
    title: "Refine the brief",
    detail: "Apply SA feedback to tune the brief for audience, pillar, and risk.",
  },
  {
    time: "0:50",
    title: "Auto-build Project model",
    detail: "Use the generated brief and notes to create shared delivery memory automatically.",
  },
  {
    time: "1:15",
    title: "Review follow-on outputs",
    detail: "Switch roles to see the plan, exec framing, risks, and onboarding view.",
  },
];

const architectureFlow = [
  "Context",
  "Bedrock",
  "Refine",
  "S3",
  "Knowledge Base",
  "Project model",
];

const packetOutputs = [
  {
    title: "Technical brief",
    detail: "Architecture assumptions, risk areas, service references, and deep-dive questions.",
  },
  {
    title: "Executive brief",
    detail: "Business context, outcome framing, success criteria, and low-jargon questions.",
  },
  {
    title: "Decision-maker lens",
    detail: "Approved stakeholder context, likely priorities, tailored questions, and influence notes.",
  },
  {
    title: "SA game plan",
    detail: "Meeting objective, talk track, likely objections, and closeout checklist.",
  },
  {
    title: "Project handoff",
    detail: "Notes, decisions, owners, risks, timeline, and role-aware follow-on answers.",
  },
];

const modelStoragePath = [
  {
    layer: "Bedrock model",
    service: "AWS managed",
    detail:
      "PillarPrep invokes Amazon Nova Micro through Bedrock. The foundation model weights are not copied into our account or stored in the app.",
  },
  {
    layer: "Prompt contract",
    service: "Lambda code",
    detail:
      "The briefing instructions, JSON shape, and fallback rules live in the Lambda source and are versioned in GitHub.",
  },
  {
    layer: "Generated brief",
    service: "S3 artifacts",
    detail:
      "Every live response can be saved as a JSON artifact with the original request, model output, timestamp, and project metadata.",
  },
  {
    layer: "Project state",
    service: "DynamoDB",
    detail:
      "Project model uses projectId and sortKey records to track generated briefs, handoff state, provider, and creation time.",
  },
  {
    layer: "Future memory",
    service: "Knowledge Bases",
    detail:
      "Approved briefs and meeting notes can later be indexed for retrieval-backed answers without training a custom model.",
  },
];
const awsRunway = [
  {
    layer: "Frontend",
    service: "S3 + CloudFront",
    detail: "Static React app with fast global delivery and a simple hackathon deployment path.",
  },
  {
    layer: "API",
    service: "API Gateway + Lambda",
    detail: "Thin request layer for brief generation, feedback capture, and project model updates.",
  },
  {
    layer: "AI generation",
    service: "Amazon Bedrock",
    detail: "Role-aware brief generation, refinement loop, objection handling, and follow-on answers.",
  },
  {
    layer: "Project memory",
    service: "S3 + Knowledge Bases",
    detail: "Final briefs, meeting notes, and project artifacts become searchable project context.",
  },
  {
    layer: "State + telemetry",
    service: "DynamoDB + CloudWatch",
    detail: "Track project status, feedback, owners, timestamps, usage, and operational health.",
  },
];

const productionChecks = [
  "IAM least privilege",
  "Bedrock Guardrails",
  "CloudWatch logs",
  "Structured JSON outputs",
  "S3 artifact retention",
  "DynamoDB project state",
];
const costGuardrails = [
  {
    label: "Daily cap",
    value: "under 1 USD/day",
    detail: "AWS Budget is deployed with a low daily threshold for the demo account.",
  },
  {
    label: "Model choice",
    value: "Nova Micro",
    detail: "Default Bedrock model keeps brief generation inexpensive while the prompt stays portable.",
  },
  {
    label: "Token control",
    value: "Bounded output",
    detail: "Lambda sets max tokens and validates short or malformed responses before returning them.",
  },
  {
    label: "Usage trail",
    value: "CloudWatch",
    detail: "Each response records model ID, token count, latency, S3 artifact, and project state metadata.",
  },
];

const demoSignals = [
  {
    label: "Ranked discovery",
    detail: "Well-Architected priorities steer the model in order, not as loose tags.",
  },
  {
    label: "Question-led briefs",
    detail: "Each section gives the SA language they can use live in the meeting.",
  },
  {
    label: "Project handoff",
    detail: "The approved brief auto-builds Project model context for follow-through.",
  },
];

const judgeProofPoints = [
  { label: "Frontend", value: "CloudFront + S3" },
  { label: "Auth", value: "IAM signed" },
  { label: "Model", value: "Bedrock Nova" },
  { label: "Cost", value: "Budget guardrail" },
];

const briefQualityTargets = [
  {
    label: "Long-form answers",
    detail: "Paragraphs include context, reasoning, and next-step guidance.",
  },
  {
    label: "Actual questions",
    detail: "Technical, executive, stakeholder, and objection sections include prompts to ask live.",
  },
  {
    label: "Model handoff",
    detail: "The same response creates project model output and implementation artifacts.",
  },
];

const heroProofPoints = [
  "Bedrock generation loop",
  "Well-Architected pillar ranking",
  "Project model handoff",
  "AWS-ready deployment path",
];

const implementationBacklog = [
  "CDK or SAM stack",
  "Bedrock prompt contract",
  "Knowledge Base bucket",
  "DynamoDB project schema",
  "Guardrail policy",
  "CloudWatch dashboard",
];

const consolePages: Array<{ id: ConsolePage; label: string; detail: string }> = [
  { id: "setup", label: "1. Context", detail: "Customer input" },
  { id: "brief", label: "2. Brief", detail: "Review output" },
  { id: "project", label: "3. Project", detail: "Team handoff" },
  { id: "aws", label: "AWS", detail: "Infrastructure" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function providerLabel(provider: BriefResponse["provider"]) {
  if (provider === "bedrock") {
    return "Bedrock AI";
  }

  if (provider === "strands") {
    return "Strands agent";
  }

  return "Local fallback";
}

function briefTabLabel(tab: BriefTab) {
  if (tab === "gameplan") {
    return "SA game plan";
  }

  if (tab === "stakeholders") {
    return "Stakeholder lens";
  }

  if (tab === "objections") {
    return "Objection simulator";
  }

  return tab === "technical" ? "Technical brief" : "Executive brief";
}

function cloneDecisionMakers(decisionMakers: DecisionMakerContext[]) {
  return decisionMakers.map((person) => ({ ...person }));
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState("apex");
  const activeScenario =
    scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];
  const [company, setCompany] = useState(activeScenario.company);
  const [industry, setIndustry] = useState(activeScenario.industry);
  const [meetingType, setMeetingType] = useState(activeScenario.meetingType);
  const [companySize, setCompanySize] = useState(activeScenario.companySize);
  const [selectedPillars, setSelectedPillars] = useState(() =>
    normalizePillarRanking(activeScenario.pillars)
  );
  const [context, setContext] = useState(activeScenario.context);
  const [decisionMakers, setDecisionMakers] = useState<DecisionMakerContext[]>(
    () => cloneDecisionMakers(activeScenario.decisionMakers)
  );
  const [meetingNotes, setMeetingNotes] = useState(
    activeScenario.meetingNotes
  );
  const [activeTab, setActiveTab] = useState<BriefTab>("technical");
  const [briefVersion, setBriefVersion] = useState(1);
  const [feedback, setFeedback] = useState<string[]>(defaultFeedback);
  const [approved, setApproved] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [role, setRole] = useState<AudienceRole>(defaultRole);
  const [activePrompt, setActivePrompt] = useState(rolePrompts[defaultRole][0]);
  const [generatedBrief, setGeneratedBrief] = useState<BriefResponse | null>(null);
  const [projectBrainAnswer, setProjectBrainAnswer] = useState("");
  const [projectAnswerKey, setProjectAnswerKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    liveModeAvailable ? "live" : "demo"
  );
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    checked: staticDemoMode,
    liveConfigured: liveModeAvailable,
    apiKeyConfigured: false,
    authMode: hostedIamMode ? "iam" : undefined,
  });
  const hostedCredentials = useMemo(
    () =>
      hostedIamMode
        ? cognitoIdentityCredentialsProvider({
            region: hostedBackendRegion,
            identityPoolId: hostedIdentityPoolId,
          })
        : null,
    []
  );
  const [copiedLabel, setCopiedLabel] = useState("");
  const [activePage, setActivePage] = useState<ConsolePage>("setup");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Mount-only localStorage hydration restores the saved workspace state. */
    try {
      const rawWorkspace = window.localStorage.getItem(workspaceStorageKey);

      if (!rawWorkspace) {
        return;
      }

      const saved = JSON.parse(rawWorkspace) as Record<string, unknown>;
      const savedScenarioId =
        typeof saved.scenarioId === "string" &&
        scenarios.some((scenario) => scenario.id === saved.scenarioId)
          ? saved.scenarioId
          : scenarioId;
      const savedRole =
        typeof saved.role === "string" && saved.role in rolePrompts
          ? (saved.role as AudienceRole)
          : defaultRole;

      setScenarioId(savedScenarioId);
      setCompany(typeof saved.company === "string" ? saved.company : company);
      setIndustry(typeof saved.industry === "string" ? saved.industry : industry);
      setMeetingType(
        typeof saved.meetingType === "string" ? saved.meetingType : meetingType
      );
      setCompanySize(
        typeof saved.companySize === "string" ? saved.companySize : companySize
      );
      setSelectedPillars(
        Array.isArray(saved.selectedPillars)
          ? normalizePillarRanking(
              saved.selectedPillars.filter(
                (pillar): pillar is string => typeof pillar === "string"
              )
            )
          : normalizePillarRanking(selectedPillars)
      );
      setContext(typeof saved.context === "string" ? saved.context : context);
      setDecisionMakers(
        Array.isArray(saved.decisionMakers)
          ? saved.decisionMakers
              .filter(
                (person): person is Record<string, unknown> =>
                  typeof person === "object" && person !== null
              )
              .map((person) => ({
                name: typeof person.name === "string" ? person.name : "",
                title: typeof person.title === "string" ? person.title : "",
                source: typeof person.source === "string" ? person.source : "",
                context:
                  typeof person.context === "string" ? person.context : "",
              }))
          : decisionMakers
      );
      setMeetingNotes(
        typeof saved.meetingNotes === "string" ? saved.meetingNotes : meetingNotes
      );
      setActiveTab(
        typeof saved.activeTab === "string" &&
          ["technical", "executive", "stakeholders", "gameplan", "objections"].includes(
            saved.activeTab
          )
          ? (saved.activeTab as BriefTab)
          : "technical"
      );
      setBriefVersion(
        typeof saved.briefVersion === "number" && saved.briefVersion > 0
          ? saved.briefVersion
          : 1
      );
      setFeedback(
        Array.isArray(saved.feedback)
          ? saved.feedback.filter(
              (item): item is string => typeof item === "string"
            )
          : defaultFeedback
      );
      setApproved(Boolean(saved.approved));
      setPromoted(Boolean(saved.promoted));
      setRole(savedRole);
      setActivePrompt(
        typeof saved.activePrompt === "string"
          ? saved.activePrompt
          : rolePrompts[savedRole][0]
      );
      setGeneratedBrief(
        typeof saved.generatedBrief === "object" && saved.generatedBrief !== null
          ? (saved.generatedBrief as BriefResponse)
          : null
      );
      setProjectBrainAnswer(
        typeof saved.projectBrainAnswer === "string"
          ? saved.projectBrainAnswer
          : ""
      );
      setProjectAnswerKey(
        typeof saved.projectAnswerKey === "string" ? saved.projectAnswerKey : ""
      );
    } catch {
      window.localStorage.removeItem(workspaceStorageKey);
    } finally {
      setWorkspaceLoaded(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hostedIamMode) {
      return;
    }

    if (!liveModeAvailable) {
      return;
    }

    let cancelled = false;

    async function loadModelStatus() {
      try {
        const response = await fetch("/api/brief", {
          method: "GET",
          headers: { accept: "application/json" },
        });
        const status = (await response.json()) as Partial<ModelStatus>;

        if (cancelled) {
          return;
        }

        const liveConfigured = Boolean(status.liveConfigured);
        setModelStatus({
          checked: true,
          liveConfigured,
          apiKeyConfigured: Boolean(status.apiKeyConfigured),
          authMode: typeof status.authMode === "string" ? status.authMode : undefined,
        });
        setGenerationMode(liveConfigured ? "live" : "demo");
      } catch {
        if (!cancelled) {
          setModelStatus({
            checked: true,
            liveConfigured: false,
            apiKeyConfigured: false,
          });
          setGenerationMode("demo");
        }
      }
    }

    void loadModelStatus();

    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!workspaceLoaded) {
      return;
    }

    window.localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify({
        scenarioId,
        company,
        industry,
        meetingType,
        companySize,
        selectedPillars,
        context,
        decisionMakers,
        meetingNotes,
        activeTab,
        briefVersion,
        feedback,
        approved,
        promoted,
        role,
        activePrompt,
        generatedBrief,
        projectBrainAnswer,
        projectAnswerKey,
      })
    );
  }, [
    activePrompt,
    activeTab,
    approved,
    briefVersion,
    company,
    companySize,
    context,
    decisionMakers,
    feedback,
    generatedBrief,
    industry,
    meetingNotes,
    meetingType,
    projectAnswerKey,
    projectBrainAnswer,
    promoted,
    role,
    scenarioId,
    selectedPillars,
    workspaceLoaded,
  ]);

  const selectedPillarDetails = useMemo(
    () =>
      selectedPillars.flatMap((pillarId) => {
        const pillar = pillars.find((candidate) => candidate.id === pillarId);
        return pillar ? [pillar] : [];
      }),
    [selectedPillars]
  );
  const topRankedPillars = useMemo(
    () => selectedPillars.slice(0, 3),
    [selectedPillars]
  );
  const pillarRanking = useMemo(
    () => buildPillarRanking(selectedPillars),
    [selectedPillars]
  );
  const usableDecisionMakers = useMemo(
    () =>
      decisionMakers
        .map((person) => ({
          name: person.name.trim(),
          title: person.title.trim(),
          source: person.source?.trim() ?? "",
          context: person.context.trim(),
        }))
        .filter((person) => person.name || person.title || person.context),
    [decisionMakers]
  );
const primaryConcern = selectedPillarDetails[0]?.id ?? "Discovery";
const industryFocus = useMemo(() => {
    if (industry === "Financial Services") {
      return "compliance, auditability, customer trust, and modernization risk";
    }

    if (industry === "Healthcare") {
      return "patient data protection, availability, interoperability, and compliance";
    }

    if (industry === "Retail") {
      return "seasonal scale, personalization, latency, and unit economics";
    }

    if (industry === "Manufacturing") {
      return "plant continuity, IoT data pipelines, forecasting, and uptime";
    }

    if (industry === "Media") {
      return "content workflows, burst traffic, monetization, and global delivery";
    }

    if (industry === "SaaS") {
      return "tenant isolation, reliability, growth efficiency, and platform velocity";
    }

    return "modernization, reliability, security, and measurable business outcomes";
  }, [industry]);
  const blankBriefContent: Record<BriefTab, string[]> = {
    technical: [],
    executive: [],
    stakeholders: [],
    gameplan: [],
    objections: [],
  };

  const fallbackBriefContent = {
    technical: [
      `${company || "The customer"} likely needs a secure landing zone, governed identity model, observable application path, and migration pattern that reduces production risk.`,
      `Discovery should validate current architecture, data classification, RTO/RPO, incident response, network dependencies, and ownership across ${companySize.toLowerCase()} teams.`,
      `Recommended AWS references: Amazon Bedrock for generation, AWS Lambda and API Gateway for orchestration, Amazon S3 for artifacts, Amazon DynamoDB for project state, Amazon CloudWatch for observability, and AWS Well-Architected Tool for pillar alignment.`,
    ],
    executive: [
      `${company || "The customer"} is balancing modernization speed with risk control. The conversation should stay centered on ${industryFocus}.`,
      "Position AWS as a way to improve decision quality, reduce operational drag, and make progress measurable without forcing a risky all-at-once transformation.",
      `Business framing: ${activeScenario.winTheme}`,
    ],
    stakeholders: usableDecisionMakers.length
      ? usableDecisionMakers.map(
          (person) =>
            `${person.name || "Decision maker"}${person.title ? `, ${person.title}` : ""}: connect the opening to ${primaryConcern.toLowerCase()} and ask which outcome, risk, or blocker matters most from their seat. ${person.context ? `Signal: ${person.context}` : ""}`
        )
      : [
          "Add approved stakeholder notes to tailor the opening, questions, and objection handling.",
          `For ${company || "the customer"}, identify the economic buyer, technical owner, security approver, and project driver before the follow-up.`,
          "Use pasted customer-approved context only; treat all profile-based insight as a hypothesis to validate.",
        ],
    gameplan: [
      "Open by confirming the business event driving urgency, then map technical unknowns to business impact.",
      `Spend the first half on the ranked priorities (${topRankedPillars.join(", ").toLowerCase()}) and use the final ten minutes to agree on success measures and next steps.`,
      "Close with a crisp handoff: confirmed goals, known risks, unanswered questions, owners, timeline, and how the project workspace should be used.",
    ],
    objections: [
      "Customer pushback: We cannot risk disruption during this program.",
      `Response: propose a bounded pilot around ${selectedPillars[0]?.toLowerCase() || "the top priority"}, define rollback criteria, and connect each technical checkpoint to business continuity.`,
      "Customer pushback: This sounds expensive. Response: start with unit-cost visibility, right-sizing, and a decision checkpoint before scaling the implementation.",
    ],
  };

  const briefContent = isGenerating
    ? blankBriefContent
    : generatedBrief
      ? {
          technical: generatedBrief.technical,
          executive: generatedBrief.executive,
          stakeholders: generatedBrief.stakeholders?.length
            ? generatedBrief.stakeholders
            : fallbackBriefContent.stakeholders,
          gameplan: generatedBrief.gameplan,
          objections: generatedBrief.objections,
        }
      : fallbackBriefContent;
  const activeBriefText = [
    `${company || "Customer"} - ${briefTabLabel(activeTab)}`,
    "",
    ...briefContent[activeTab],
    "",
    `Sources: ${(generatedBrief?.citations ?? evidenceSources).join(", ")}`,
  ].join("\n");

  const followUpEmailText = generatedBrief?.projectArtifacts?.followUpEmail
    ? `Subject: ${generatedBrief.projectArtifacts.followUpEmail.subject}\n\n${generatedBrief.projectArtifacts.followUpEmail.body}`
    : `Subject: Follow-up from PillarPrep briefing for ${company || "the customer"}\n\nThanks for the conversation. We captured ${industryFocus} as the main outcome path and ${selectedPillars[0]?.toLowerCase() || "the first priority"} as the first validation area.\n\nRecommended next step: schedule a focused working session to confirm stakeholders, success criteria, risks, pilot scope, and owners.`;

  const projectAnswer = useMemo(() => {
    const customerName = company || "the customer";
    const stakeholderLead = usableDecisionMakers[0];
    const stakeholderContext = stakeholderLead
      ? ` Include ${stakeholderLead.name || "the primary stakeholder"}${stakeholderLead.title ? ` (${stakeholderLead.title})` : ""} in the alignment path and validate the decision-maker notes before using them as facts.`
      : " Capture stakeholder owners before the project handoff so follow-on answers stay audience-aware.";

    if (role === "PM") {
      return `Start with a two-week discovery sprint for ${customerName}: confirm stakeholders, validate the ${selectedPillars[0]?.toLowerCase() || "top"} risk, capture current-state architecture, and publish a decision log. Track owners for security, data, app dependencies, and executive success criteria.${stakeholderContext}`;
    }

    if (role === "Engineer") {
      return `Begin with the narrow technical spine: ingestion path, identity model, API boundary, data store, and observability. Use the final pre-brief assumptions as hypotheses, then validate them before committing to architecture.${stakeholderContext}`;
    }

    if (role === "Executive") {
      return `${customerName} needs a controlled modernization path. The business case is reduced delivery risk, better visibility into cost and reliability, and faster movement on high-value customer-facing work.${stakeholderContext}`;
    }

    if (role === "Sales") {
      return `Lead the follow-up with the outcome they cared about most: ${industryFocus}. Keep it short, confirm what we heard, and propose a focused working session that turns the brief into an implementation plan.${stakeholderContext}`;
    }

    return `This project started as an SA pre-brief for ${customerName}. The final brief, decision-maker context, meeting notes, assumptions, risks, and decisions become the source of truth for anyone joining later.`;
  }, [company, industryFocus, role, selectedPillars, usableDecisionMakers]);

  const currentProjectAnswerKey = `${role}::${activePrompt}`;
  const displayedProjectAnswer = isGenerating
    ? ""
    : projectBrainAnswer && projectAnswerKey === currentProjectAnswerKey
      ? projectBrainAnswer
      : projectAnswer;
  const handoffPacketText = (() => {
    const metadata = generatedBrief?.metadata;
    const sources = generatedBrief?.citations ?? evidenceSources;
    const artifactList = (title: string, items: ProjectArtifactItem[] | undefined) => [
      title,
      ...(items?.length
        ? items.map((item, index) => {
            const owner = item.owner ? ` | Owner: ${item.owner}` : "";
            const status = item.status ? ` | Status: ${item.status}` : "";
            return `${index + 1}. ${item.title}${owner}${status}\n   ${item.detail}`;
          })
        : ["Not generated yet."]),
    ].join("\n");
    const briefSection = (title: string, items: string[]) => [
      title,
      ...items.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");

    return [
      `PillarPrep handoff packet - ${company || "Customer"}`,
      `Meeting: ${meetingType} | Industry: ${industry} | Size: ${companySize}`,
      `Generation path: ${generatedBrief ? providerLabel(generatedBrief.provider) : "Not generated yet"}`,
      metadata?.artifactKey ? `S3 artifact: ${metadata.artifactKey}` : "S3 artifact: Not saved yet",
      metadata?.stateKey ? `Project state: ${metadata.stateKey}` : "Project state: Not saved yet",
      "",
      "Ranked AWS priorities",
      ...selectedPillars.map((pillar, index) => `${index + 1}. ${pillar}`),
      "",
      "Customer context",
      context || "No customer context captured yet.",
      "",
      briefSection("Technical brief", briefContent.technical),
      "",
      briefSection("Executive brief", briefContent.executive),
      "",
      briefSection("Stakeholder lens", briefContent.stakeholders),
      "",
      briefSection("SA game plan", briefContent.gameplan),
      "",
      briefSection("Objection handling", briefContent.objections),
      "",
      "Project model answer",
      displayedProjectAnswer,
      "",
      artifactList("Two-week implementation plan", generatedBrief?.projectArtifacts?.twoWeekPlan),
      "",
      artifactList("Risk register", generatedBrief?.projectArtifacts?.riskRegister),
      "",
      artifactList("Stakeholder map", generatedBrief?.projectArtifacts?.stakeholderMap),
      "",
      "Follow-up email",
      followUpEmailText,
      "",
      `Sources: ${sources.join(", ")}`,
    ].join("\n");
  })();

  const handoffItems = [
    {
      title: "Final brief",
      status: approved ? "Ready" : "Draft",
      detail: `v${briefVersion} with ${feedback.length} refinements`,
    },
    {
      title: "Stakeholder lens",
      status: usableDecisionMakers.length ? "Captured" : "Needs context",
      detail: usableDecisionMakers.length
        ? `${usableDecisionMakers.length} decision-maker signals`
        : "Approved profile notes and priorities",
    },
    {
      title: "Meeting outcomes",
      status: meetingNotes.length > 80 ? "Captured" : "Needs notes",
      detail: "Objections, decisions, and next steps",
    },
    {
      title: "Project memory",
      status: promoted ? "Live" : "Waiting",
      detail: "Brief, notes, risks, actions, and decisions",
    },
    {
      title: "Next artifacts",
      status: promoted ? "Generated" : "Queued",
      detail: "Plan, risk list, exec summary, onboarding",
    },
  ];

  const projectArtifactTiles = useMemo(() => {
    const artifacts = generatedBrief?.projectArtifacts;
    const firstPlan = artifacts?.twoWeekPlan?.[0];
    const firstRisk = artifacts?.riskRegister?.[0];
    const firstStakeholder = artifacts?.stakeholderMap?.[0];

    return [
      {
        title: "Implementation plan",
        status: artifacts?.twoWeekPlan?.length
          ? `${artifacts.twoWeekPlan.length} steps`
          : "Queued",
        detail:
          firstPlan?.detail ??
          "Generate the brief to create the first implementation sprint.",
      },
      {
        title: "Risk list",
        status: artifacts?.riskRegister?.length
          ? `${artifacts.riskRegister.length} risks`
          : "Queued",
        detail:
          firstRisk?.detail ??
          "Generate the brief to create delivery risks and mitigations.",
      },
      {
        title: "Stakeholder map",
        status: artifacts?.stakeholderMap?.length
          ? `${artifacts.stakeholderMap.length} people`
          : "Queued",
        detail:
          firstStakeholder?.detail ??
          "Approved decision-maker notes become stakeholder validation points.",
      },
      {
        title: "Follow-up email",
        status: artifacts?.followUpEmail?.subject ? "Drafted" : "Queued",
        detail:
          artifacts?.followUpEmail?.subject ??
          "Generate the brief to draft a concise customer follow-up.",
      },
    ];
  }, [generatedBrief]);

  function loadScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
    setCompany(nextScenario.company);
    setIndustry(nextScenario.industry);
    setMeetingType(nextScenario.meetingType);
    setCompanySize(nextScenario.companySize);
    setSelectedPillars(normalizePillarRanking(nextScenario.pillars));
    setContext(nextScenario.context);
    setDecisionMakers(cloneDecisionMakers(nextScenario.decisionMakers));
    setMeetingNotes(nextScenario.meetingNotes);
    setBriefVersion(1);
    setApproved(false);
    setPromoted(false);
    setActiveTab("technical");
    setGeneratedBrief(null);
    setProjectBrainAnswer("");
    setProjectAnswerKey("");
    setGenerationError("");
  }

  function movePillar(pillar: string, direction: -1 | 1) {
    setSelectedPillars((current) => {
      const ranked = normalizePillarRanking(current);
      const currentIndex = ranked.indexOf(pillar);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) {
        return ranked;
      }

      const nextRanking = [...ranked];
      [nextRanking[currentIndex], nextRanking[nextIndex]] = [
        nextRanking[nextIndex],
        nextRanking[currentIndex],
      ];

      return nextRanking;
    });
  }

  function toggleFeedback(option: string) {
    setFeedback((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  function updateDecisionMaker(
    index: number,
    field: keyof DecisionMakerContext,
    value: string
  ) {
    setDecisionMakers((current) =>
      current.map((person, personIndex) =>
        personIndex === index ? { ...person, [field]: value } : person
      )
    );
  }

  function addDecisionMaker() {
    setDecisionMakers((current) => [
      ...current,
      {
        name: "",
        title: "",
        source: "Customer-approved profile notes",
        context: "",
      },
    ]);
  }

  function removeDecisionMaker(index: number) {
    setDecisionMakers((current) =>
      current.length <= 1
        ? current
        : current.filter((_, personIndex) => personIndex !== index)
    );
  }

  async function requestLiveBrief(briefRequest: BriefRequest) {
    if (hostedIamMode) {
      if (!hostedCredentials) {
        throw new Error("Hosted IAM access is missing Cognito credentials configuration.");
      }

      const response = await signedJsonFetch(
        hostedBackendUrl,
        briefRequest,
        hostedCredentials,
        hostedBackendRegion
      );
      const body = await response.text();

      if (!response.ok) {
        throw new Error(extractBackendError(body));
      }

      try {
        return normalizeBriefResponse(JSON.parse(body), "bedrock");
      } catch {
        throw new Error("AI backend returned invalid JSON.");
      }
    }

    const response = await fetch("/api/brief", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pillarprep-mode": "live",
      },
      body: JSON.stringify(briefRequest),
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(extractBackendError(body));
    }

    try {
      return normalizeBriefResponse(JSON.parse(body), "bedrock");
    } catch {
      throw new Error("AI backend returned invalid JSON.");
    }
  }

  async function requestBrief(mode: "prebrief" | "project" = "prebrief") {
    const requestRole = role;
    const requestPrompt = activePrompt;
    const requestProjectAnswerKey = `${requestRole}::${requestPrompt}`;

    setIsGenerating(true);
    setGenerationError("");
    setGenerationNotice("");
    setGeneratedBrief(null);
    setProjectBrainAnswer("");
    setProjectAnswerKey("");
    setPromoted(false);
    setApproved(false);
    try {
      const briefRequest = {
        mode,
        company,
        industry,
        meetingType,
        companySize,
        pillars: selectedPillars,
        pillarRanking,
        context,
        meetingNotes,
        feedback,
        decisionMakers: usableDecisionMakers,
        role: requestRole,
        prompt: requestPrompt,
      };
      const validationError = validateBriefRequest(briefRequest);

      if (validationError) {
        throw new Error(validationError);
      }

      let nextBrief: BriefResponse;
      const liveBackendConfigured = hostedIamMode || modelStatus.liveConfigured;
      const shouldTryLiveAws = liveModeAvailable && (generationMode === "live" || liveBackendConfigured);

      if (shouldTryLiveAws) {
        if (!liveBackendConfigured && modelStatus.checked) {
          throw new Error("AI model mode is not configured on this server. Add PILLARPREP_BACKEND_URL and restart the app.");
        }

        try {
          nextBrief = await requestLiveBrief(briefRequest);
          setGenerationMode("live");
        } catch (error) {
          nextBrief = normalizeBriefResponse(generateDemoBrief(briefRequest), "demo");
          setGenerationMode("demo");
          setGenerationNotice(
            error instanceof Error
              ? `AI model call failed; local fallback was generated: ${error.message}`
              : "AI model call failed; local fallback was generated."
          );
        }
      } else {
        nextBrief = normalizeBriefResponse(generateDemoBrief(briefRequest), "demo");
      }

      setGeneratedBrief(nextBrief);
      setProjectBrainAnswer(nextBrief.projectAnswer || projectAnswer);
      setProjectAnswerKey(requestProjectAnswerKey);
      setPromoted(true);

      if (mode === "project") {
        setApproved(true);
      } else {
        setBriefVersion((version) => version + 1);
        setApproved(false);
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Brief generation failed"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function refineBrief() {
    setActivePage("brief");
    void requestBrief("prebrief");
  }

  function approveBrief() {
    setApproved(true);
    setPromoted(Boolean(generatedBrief));
  }

  function openProjectBrain() {
    setActivePage("project");

    if (!generatedBrief) {
      void requestBrief("prebrief");
    }
  }

  function refreshProjectModel() {
    setActivePage("project");
    void requestBrief("project");
  }

  async function copyText(label: string, textToCopy: string) {
    if (!textToCopy.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLabel(label);
      window.setTimeout(() => {
        setCopiedLabel((current) => (current === label ? "" : current));
      }, 1800);
    } catch {
      setGenerationError("Copy was blocked by the browser. The text is still visible on screen.");
    }
  }

  function copyActiveBrief() {
    void copyText(briefTabLabel(activeTab), activeBriefText);
  }

  function copyFollowUpEmail() {
    void copyText("Follow-up email", followUpEmailText);
  }
  function copyHandoffPacket() {
    void copyText("Handoff packet", handoffPacketText);
  }

  function resetWorkspace() {
    const firstScenario = scenarios[0];

    window.localStorage.removeItem(workspaceStorageKey);
    setFeedback(defaultFeedback);
    setRole(defaultRole);
    setActivePrompt(rolePrompts[defaultRole][0]);
    loadScenario(firstScenario);
  }

  return (
    <main className="app-shell min-h-screen text-[#17201c]">
      <section className="hero-shell">
        <div className="mx-auto max-w-[1500px] px-5 pt-4">
          <div className="top-command">
            <div className="top-command-title">
              <span className="status-dot" />
              PillarPrep workspace
            </div>
            <div className="top-command-actions">
              {consolePages.map((page) => (
                <button
                  key={page.id}
                  className={cx("command-tab", activePage === page.id && "command-tab-active")}
                  type="button"
                  onClick={() => setActivePage(page.id)}
                >
                  <span>{page.label}</span>
                  <small>{page.detail}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 xl:grid-cols-[1fr_400px] xl:items-stretch">
          <div className="hero-copy">
            <div className="flex items-center gap-4">
              <div className="brand-mark">PP</div>
              <div>
                <p className="eyebrow">AWS Product Console</p>
                <h1 className="mt-1 text-3xl font-black text-white sm:text-5xl">
                  PillarPrep
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/74">
              An SA briefing cockpit that turns customer context into a refined
              pre-meeting plan, then auto-builds the final brief into a living
              project model for the team that has to execute.
            </p>
            <div className="product-strip" aria-label="Product value signals">
              {heroProofPoints.map((point, index) => (
                <span key={point}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {point}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ["Current customer", company || "Customer"],
                ["Primary concern", primaryConcern],
                ["Win theme", activeScenario.winTheme],
              ].map(([label, value]) => (
                <div key={label} className="hero-stat">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="judge-proof-row" aria-label="Judge proof points">
              {judgeProofPoints.map((point) => (
                <div key={point.label} className="judge-proof-chip">
                  <span>{point.label}</span>
                  <strong>{point.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-status">
              <span>AI-backed AWS workload</span>
              <strong>{generationMode === "live" ? "Bedrock ready" : "Fallback ready"}</strong>
            </div>
            <div className="hero-demo-state">
              <div>
                <p className="eyebrow text-[#9fd7c0]">Workspace state</p>
                <h2>{promoted ? "Project model built" : generatedBrief ? "Brief generated" : "Ready to generate"}</h2>
                <p>
                  Ranked priorities, richer questions, and follow-on artifacts are generated in one clean pass.
                </p>
              </div>
              <span className="hero-pill">
                {promoted ? "Follow-on ready" : approved ? "Brief approved" : "Pre-brief loop"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="mini-stat">
                <span>Brief</span>
                <strong>v{briefVersion}</strong>
              </div>
              <div className="mini-stat">
                <span>Rank 1</span>
                <strong>{primaryConcern}</strong>
              </div>
              <div className="mini-stat">
                <span>Runtime</span>
                <strong>{generationMode === "live" ? "AWS" : "Fallback"}</strong>
              </div>
            </div>
            <div className="demo-signal-list">
              {demoSignals.map((signal) => (
                <div key={signal.label} className="demo-signal-card">
                  <strong>{signal.label}</strong>
                  <p>{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pt-5">
        <div className="lifecycle-rail">
          {lifecycleStages.map((stage, index) => {
            const stageActive =
              index === 0 ||
              (briefVersion > 1 && index <= 2) ||
              (approved && index <= 3) ||
              (promoted && index <= 5);

            return (
              <div
                key={stage}
                className={cx("lifecycle-step", stageActive && "lifecycle-step-active")}
              >
                <span>{index + 1}</span>
                <strong>{stage}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {activePage === "aws" ? (
        <div className="page-view">
        <section className="mx-auto max-w-[1500px] px-5 pt-5">
        <div className="spotlight-grid">
          <div className="spotlight-card">
            <span>Customer signal</span>
            <strong>{activeScenario.challenge}</strong>
            <p>{industryFocus}</p>
          </div>
          <div className="spotlight-card spotlight-card-strong">
            <span>AWS value path</span>
            <strong>{primaryConcern}</strong>
            <p>Briefs use ranked Well-Architected priorities to shape model output and delivery context.</p>
          </div>
          <div className="spotlight-card">
            <span>Next best action</span>
            <strong>{promoted ? "Review project model" : approved ? "Capture meeting outcomes" : "Generate the workspace"}</strong>
            <p>{promoted ? "Plans, risks, summaries, and onboarding answers are ready." : "Turn the customer conversation into reusable team memory."}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pt-5">
        <div className="demo-grid">
          <div className="demo-panel">
            <div className="section-head">
              <p>Presentation path</p>
              <h2>90-second story</h2>
            </div>
            <div className="demo-beats">
              {storyBeats.map((beat) => (
                <div key={beat.time} className="demo-beat">
                  <time>{beat.time}</time>
                  <div>
                    <strong>{beat.title}</strong>
                    <p>{beat.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="demo-panel demo-panel-dark">
            <div className="section-head section-head-dark">
              <p>AWS system spine</p>
              <h2>From brief to delivery brain</h2>
            </div>
            <div className="aws-spine">
              {architectureFlow.map((node, index) => (
                <div key={node} className="aws-spine-node">
                  <span>{index + 1}</span>
                  <strong>{node}</strong>
                </div>
              ))}
            </div>
            <div className="aws-spine-caption">
              <span>Guardrails</span>
              <span>CloudWatch</span>
              <span>DynamoDB</span>
              <span>API Gateway</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pt-5">
        <div className="packet-band">
          <div className="section-head">
            <p>Model and memory storage</p>
            <h2>What is stored, and what stays managed by AWS</h2>
          </div>
          <div className="packet-grid">
            {modelStoragePath.map((item, index) => (
              <div key={item.layer} className="packet-tile">
                <span>{index + 1}</span>
                <strong>{item.layer}</strong>
                <small>{item.service}</small>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1500px] px-5 pt-5">
        <div className="aws-runway">
          <div className="section-head">
            <p>AWS run path</p>
            <h2>Designed to deploy as a native AWS workload</h2>
          </div>
          <div className="runway-grid">
            {awsRunway.map((item) => (
              <div key={item.layer} className="runway-card">
                <span>{item.layer}</span>
                <strong>{item.service}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="production-strip">
            {productionChecks.map((check) => (
              <span key={check}>{check}</span>
            ))}
          </div>
          <div className="cost-guardrail-panel">
            <div>
              <p>Cost guardrails</p>
              <strong>Demo target: under 1 USD per day</strong>
            </div>
            <div className="cost-guardrail-grid">
              {costGuardrails.map((item) => (
                <div key={item.label} className="cost-guardrail-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="implementation-queue">
            <div>
              <p>Implementation queue</p>
              <strong>Next build sprint</strong>
            </div>
            <div className="implementation-items">
              {implementationBacklog.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
          </div>
        ) : null}

      <section className="linear-workflow mx-auto max-w-[1500px] px-5 py-5">
        {activePage === "setup" ? (
          <div className="page-view">
        <div className="workflow-heading" id="setup">
          <span>Step 1</span>
          <div>
            <p>Set up the customer</p>
            <h2>Pick a scenario or enter real meeting context</h2>
          </div>
        </div>

        <div className="setup-grid">
          <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
            <div className="border-b border-[#e2e7de] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                Sample scenarios
              </p>
              <h2 className="mt-1 text-xl font-black">Start from a customer scenario</h2>
            </div>
            <div className="grid gap-2 p-5">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  className={cx(
                    "scenario-button",
                    scenarioId === scenario.id && "scenario-button-active"
                  )}
                  onClick={() => loadScenario(scenario)}
                  type="button"
                >
                  <span>{scenario.company}</span>
                  <strong>{scenario.challenge}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
            <div className="border-b border-[#e2e7de] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                Loop 1 input
              </p>
              <h2 className="mt-1 text-xl font-black">Customer context</h2>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="field-label">Company name</span>
                <input
                  className="field"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="field-label">Industry</span>
                  <select
                    className="field"
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                  >
                    {industries.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="field-label">Meeting type</span>
                  <select
                    className="field"
                    value={meetingType}
                    onChange={(event) => setMeetingType(event.target.value)}
                  >
                    {meetingTypes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="field-label">Company size</span>
                <div className="segmented">
                  {companySizes.map((size) => (
                    <button
                      key={size}
                      className={cx(
                        "segment",
                        companySize === size && "segment-active"
                      )}
                      onClick={() => setCompanySize(size)}
                      type="button"
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="field-label">AWS pillar ranking</span>
                <div className="pillar-ranking-list" aria-label="AWS Well-Architected pillar ranking">
                  {selectedPillarDetails.map((pillar, index) => (
                    <div
                      key={pillar.id}
                      className={cx(
                        "pillar-rank-card",
                        index === 0 && "pillar-rank-card-primary"
                      )}
                    >
                      <span className="pillar-rank-number">{index + 1}</span>
                      <span className={cx("h-2.5 w-2.5 rounded-full", pillar.color)} />
                      <div className="pillar-rank-copy">
                        <strong>{pillar.short}</strong>
                        <p>{pillar.id}</p>
                      </div>
                      <div className="pillar-rank-actions">
                        <button
                          aria-label={`Move ${pillar.id} up`}
                          disabled={index === 0}
                          onClick={() => movePillar(pillar.id, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          aria-label={`Move ${pillar.id} down`}
                          disabled={index === selectedPillarDetails.length - 1}
                          onClick={() => movePillar(pillar.id, 1)}
                          type="button"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="field-label">Known context</span>
                <textarea
                  className="field min-h-28 resize-none"
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                />
              </label>

              <div className="decision-context-panel">
                <div className="decision-context-head">
                  <div>
                    <span className="field-label">Decision maker context</span>
                    <h3>Stakeholder lens</h3>
                  </div>
                  <button
                    className="small-action"
                    type="button"
                    onClick={addDecisionMaker}
                  >
                    Add person
                  </button>
                </div>
                <p className="decision-context-note">
                  Customer-approved notes only. No automated LinkedIn scraping.
                </p>
                <div className="decision-maker-list">
                  {decisionMakers.map((person, index) => (
                    <div key={index} className="decision-maker-card">
                      <div className="decision-maker-card-head">
                        <strong>Decision maker {index + 1}</strong>
                        {decisionMakers.length > 1 ? (
                          <button
                            className="text-action"
                            type="button"
                            onClick={() => removeDecisionMaker(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="decision-maker-grid">
                        <label className="block">
                          <span className="field-label">Name</span>
                          <input
                            className="field"
                            value={person.name}
                            onChange={(event) =>
                              updateDecisionMaker(index, "name", event.target.value)
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="field-label">Title</span>
                          <input
                            className="field"
                            value={person.title}
                            onChange={(event) =>
                              updateDecisionMaker(index, "title", event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="field-label">Source label</span>
                        <input
                          className="field"
                          value={person.source ?? ""}
                          onChange={(event) =>
                            updateDecisionMaker(index, "source", event.target.value)
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="field-label">Approved profile / post themes</span>
                        <textarea
                          className="field min-h-24 resize-none"
                          value={person.context}
                          onChange={(event) =>
                            updateDecisionMaker(index, "context", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isGenerating}
                  onClick={refineBrief}
                >
                  <span className="button-icon">+</span>
                  {isGenerating
                    ? generationMode === "live"
                      ? "Generating with AI..."
                      : "Generating brief..."
                    : generationMode === "live"
                      ? "Generate AI brief + project model"
                      : "Generate brief + project model"}
                </button>
                <button
                  className="secondary-link"
                  type="button"
                  disabled={!generatedBrief}
                  onClick={() => setActivePage("brief")}
                >
                  {generatedBrief ? "Review generated brief" : "Review after generation"}
                </button>
              </div>
              <div className="provider-note">
                <span>Generation path</span>
                <strong>
                  {generatedBrief
                    ? `${providerLabel(generatedBrief.provider)} - ${new Date(generatedBrief.generatedAt).toLocaleTimeString()}`
                    : generationMode === "live"
                      ? hostedIamMode
                        ? "IAM browser role ready"
                        : modelStatus.checked
                        ? modelStatus.liveConfigured
                          ? modelStatus.authMode === "iam"
                            ? "IAM-signed Bedrock backend ready"
                            : "Bedrock backend ready"
                          : "Backend not configured"
                        : "Checking Bedrock backend"
                      : "Fallback ready"}
                </strong>
              </div>
              <div className="provider-note">
                <span>Saved artifact</span>
                <strong>{generatedBrief?.metadata?.artifactKey ?? "Not saved yet"}</strong>
              </div>
              {generatedBrief?.metadata?.projectId || generatedBrief?.metadata?.stateKey ? (
                <div className="evidence-tray">
                  {generatedBrief.metadata.projectId ? <span>Project {generatedBrief.metadata.projectId}</span> : null}
                  {generatedBrief.metadata.stateKey ? <span>DynamoDB {generatedBrief.metadata.stateKey}</span> : null}
                  {generatedBrief.metadata.modelId ? <span>{generatedBrief.metadata.modelId}</span> : null}
                  {generatedBrief.metadata.totalTokens ? <span>{generatedBrief.metadata.totalTokens} tokens</span> : null}
                  {generatedBrief.metadata.latencyMs ? <span>{generatedBrief.metadata.latencyMs} ms</span> : null}
                  {generatedBrief.metadata.storageWarning ? <span>{generatedBrief.metadata.storageWarning}</span> : null}
                </div>
              ) : null}
              <div className="workspace-tools">
                <span>Workspace saves locally in this browser</span>
                <button className="text-action" type="button" onClick={resetWorkspace}>
                  Reset workspace
                </button>
              </div>
              {generationNotice ? (
                <p className="notice-note">{generationNotice}</p>
              ) : null}
              {generationError ? (
                <p className="error-note">{generationError}</p>
              ) : null}
            </div>
          </section>
        </div>
          </div>
        ) : null}

        {activePage === "brief" ? (
          <div className="page-view">
        <div className="workflow-heading" id="brief">
          <span>Step 2</span>
          <div>
            <p>Refine the pre-brief</p>
            <h2>Review the output, apply feedback, then approve it</h2>
          </div>
        </div>

        <div className="space-y-5">
          <section className="phase-stack">
            <div className="phase-card">
              <div className="phase-copy">
                <div className="loop-badge">Phase 1</div>
                <h2>Pre-brief refinement</h2>
                <p>
                  Generate the first brief, review it with SA feedback, improve
                  the questions, and approve the customer-ready version.
                </p>
              </div>
              <div className="phase-steps">
                {["Generate", "Review", "Refine", "Approve"].map(
                  (step, index) => (
                    <div key={step} className="flow-step">
                      <span>{index + 1}</span>
                      <strong>{step}</strong>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="phase-bridge">
              <div>
                <span>Project model</span>
                <strong>{promoted ? "Auto-built" : generatedBrief ? "Ready" : "Waiting for brief"}</strong>
              </div>
              <button
                className={cx(
                  "promote-button",
                  promoted && "promote-button-done"
                )}
                type="button"
                disabled={isGenerating}
                onClick={openProjectBrain}
              >
                {promoted ? "View project model" : generatedBrief ? "Open project model" : "Generate project model"}
              </button>
              <p>Latest brief and notes become project context</p>
            </div>

            <div className="phase-card phase-card-project">
              <div className="phase-copy">
                <div className="loop-badge loop-badge-project">Phase 2</div>
                <h2>Follow-on project model</h2>
                <p>
                  Capture meeting outcomes, auto-build the brief into shared
                  memory, and use the project model for delivery follow-through.
                </p>
              </div>
              <div className="phase-steps">
                {["Capture notes", "Auto-build", "Plan", "Update"].map(
                  (step, index) => (
                    <div key={step} className="flow-step project-step">
                      <span>{index + 1}</span>
                      <strong>{step}</strong>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#e2e7de] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                    Final pre-brief workspace
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {company || "Customer"} {meetingType}
                  </h2>
                  <p className="mt-1 text-sm text-[#536158]">
                    {activeScenario.name}: {activeScenario.winTheme}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "technical",
                      "executive",
                      "stakeholders",
                      "gameplan",
                      "objections",
                    ] as BriefTab[]
                  ).map((tab) => (
                    <button
                      key={tab}
                      className={cx(
                        "tab-button",
                        activeTab === tab && "tab-active"
                      )}
                      onClick={() => setActiveTab(tab)}
                      type="button"
                    >
                      {tab === "gameplan"
                        ? "SA game plan"
                        : tab === "stakeholders"
                          ? "Stakeholder lens"
                          : tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <div className={cx("brief-surface", isGenerating && "brief-surface-busy")}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                        {activeTab === "technical"
                          ? "Technical brief"
                          : activeTab === "executive"
                            ? "Executive brief"
                            : activeTab === "stakeholders"
                              ? "Stakeholder lens"
                              : activeTab === "gameplan"
                                ? "SA game plan"
                                : "Objection simulator"}
                      </p>
                      <div className="copy-actions copy-actions-inline">
                        <span className="status-pill">
                          {approved ? "Approved" : "Draft"}
                        </span>
                        <button className="copy-button" type="button" onClick={copyActiveBrief}>
                          Copy tab
                        </button>
                        <button
                          className="copy-button"
                          type="button"
                          disabled={!generatedBrief}
                          onClick={copyHandoffPacket}
                        >
                          Copy packet
                        </button>
                        {copiedLabel === "Handoff packet" ? (
                          <span className="copy-state">Packet copied</span>
                        ) : null}
                        {copiedLabel === briefTabLabel(activeTab) ? (
                          <span className="copy-state">Copied</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 brief-output-canvas">
                      {briefContent[activeTab].map((item) => (
                        <p key={item} className="brief-line">
                          {item}
                        </p>
                      ))}
                    </div>
                    <div className="evidence-tray">
                      {(generatedBrief?.citations ?? evidenceSources).map((source) => (
                        <span key={source}>{source}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black">Refinement feedback</h3>
                      <button
                        className="small-action"
                        type="button"
                        disabled={isGenerating}
                        onClick={refineBrief}
                      >
                        {isGenerating ? "Applying..." : "Apply feedback"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {feedbackOptions.map((option) => (
                        <button
                          key={option}
                          className={cx(
                            "feedback-chip",
                            feedback.includes(option) && "feedback-chip-active"
                          )}
                          onClick={() => toggleFeedback(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="summary-panel stakeholder-summary">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#527064]">
                      Decision makers
                    </p>
                    <div className="mt-4 space-y-2">
                      {usableDecisionMakers.length ? (
                        usableDecisionMakers.slice(0, 3).map((person) => (
                          <div key={`${person.name}-${person.title}`} className="stakeholder-mini">
                            <strong>{person.name || "Decision maker"}</strong>
                            <span>{person.title || "Role to confirm"}</span>
                          </div>
                        ))
                      ) : (
                        <div className="stakeholder-mini stakeholder-mini-empty">
                          <strong>Context needed</strong>
                          <span>Approved notes unlock tailored questions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="summary-panel">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#527064]">
                      Ranked pillars
                    </p>
                    <div className="mt-4 space-y-2">
                      {selectedPillarDetails.slice(0, 4).map((pillar, index) => (
                        <div key={pillar.id} className="rank-summary-item">
                          <span>{index + 1}</span>
                          <div>
                            <strong>{pillar.id}</strong>
                            <p>{index === 0 ? "Primary discovery lens" : pillar.tone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="summary-panel">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#527064]">
                      Brief quality target
                    </p>
                    <div className="mt-4 space-y-3">
                      {briefQualityTargets.map((target) => (
                        <div key={target.label} className="quality-target-item">
                          <strong>{target.label}</strong>
                          <p>{target.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className={cx(
                      "approval-button",
                      approved && "approval-done"
                    )}
                    type="button"
                    onClick={approveBrief}
                  >
                    {approved ? "Brief approved" : "Approve final pre-brief"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
                <div className="border-b border-[#e2e7de] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                    Ranked pillar narrative
                  </p>
                  <h2 className="mt-1 text-xl font-black">Why this matters</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {selectedPillarDetails.map((pillar, index) => (
                    <div key={pillar.id} className="pillar-note">
                      <span className="pillar-note-rank">{index + 1}</span>
                      <span className={cx("h-2.5 w-2.5 rounded-full", pillar.color)} />
                      <div>
                        <strong>{pillar.id}</strong>
                        <p>{pillar.tone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section className="packet-band">
            <div className="section-head">
              <p>Generated packet</p>
              <h2>What the team walks away with</h2>
            </div>
            <div className="packet-grid">
              {packetOutputs.map((packet, index) => (
                <div key={packet.title} className="packet-tile">
                  <span>{index + 1}</span>
                  <strong>{packet.title}</strong>
                  <p>{packet.detail}</p>
                </div>
              ))}
            </div>
          </section>
          </div>
          </div>
        ) : null}

          {activePage === "project" ? (
            <div className="page-view">
          <div className="workflow-heading workflow-heading-dark" id="project-brain">
            <span>Step 3</span>
            <div>
              <p>Auto-build after generation</p>
              <h2>Turn the final brief into the follow-on project model</h2>
            </div>
          </div>

          <section className="rounded-lg border border-[#d8ded2] bg-[#17201c] text-white shadow-sm">
            <div className="grid gap-0 2xl:grid-cols-[380px_1fr]">
              <div className="border-b border-white/10 p-5 2xl:border-b-0 2xl:border-r">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fd7c0]">
                  Loop 2 output
                </p>
                <h2 className="mt-1 text-xl font-black">Project model</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Once generated, the final brief becomes an auto-built project
                  model for people who need to implement, manage, sell, or
                  explain the work.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {(
                    [
                      "Sales",
                      "Executive",
                      "PM",
                      "Engineer",
                      "New member",
                    ] as AudienceRole[]
                  ).map((item) => (
                    <button
                      key={item}
                      className={cx(
                        "role-button",
                        role === item && "role-active"
                      )}
                      onClick={() => {
                        setRole(item);
                        setActivePrompt(rolePrompts[item][0]);
                      }}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
                  <div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {rolePrompts[role].map((prompt) => (
                        <button
                          key={prompt}
                          className={cx(
                            "prompt-chip",
                            activePrompt === prompt && "prompt-chip-active"
                          )}
                          onClick={() => setActivePrompt(prompt)}
                          type="button"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    <div className={cx("project-answer", isGenerating && "project-answer-busy")}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fd7c0]">
                            Answer for {role}
                          </p>
                          <h3 className="mt-1 text-lg font-black">
                            {activePrompt}
                          </h3>
                        </div>
                        <div className="project-answer-actions">
                          <span
                            className={cx(
                              "project-state",
                              promoted
                                ? "project-state-live"
                                : "project-state-waiting"
                            )}
                          >
                            {promoted ? "Project model ready" : "Auto-build pending"}
                          </span>
                          <button
                            className="copy-button copy-button-dark"
                            type="button"
                            onClick={copyFollowUpEmail}
                          >
                            Copy email
                          </button>
                          <button
                            className="copy-button copy-button-dark"
                            type="button"
                            disabled={!generatedBrief}
                            onClick={copyHandoffPacket}
                          >
                            Copy packet
                          </button>
                          {copiedLabel === "Handoff packet" ? (
                            <span className="copy-state copy-state-dark">Packet copied</span>
                          ) : null}
                          {copiedLabel === "Follow-up email" ? (
                            <span className="copy-state copy-state-dark">Copied</span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-5 text-base leading-7 text-white/82">
                        {displayedProjectAnswer}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      {projectArtifactTiles.map((artifact) => (
                        <div key={artifact.title} className="artifact-tile">
                          <span />
                          <strong>{artifact.title}</strong>
                          <small>{artifact.status}</small>
                          <p>{artifact.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="meeting-panel">
                    <label className="block">
                      <span className="dark-label">Meeting outcomes</span>
                      <textarea
                        className="dark-field min-h-36 resize-none"
                        value={meetingNotes}
                        onChange={(event) => setMeetingNotes(event.target.value)}
                      />
                    </label>
                    <div className="mt-4 grid gap-2">
                      {handoffItems.map((item) => (
                        <div key={item.title} className="handoff-item">
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                          </div>
                          <span>{item.status}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className={cx(
                        "project-promote-wide",
                        promoted && "project-promote-wide-done"
                      )}
                      type="button"
                      disabled={isGenerating}
                      onClick={refreshProjectModel}
                    >
                      {isGenerating
                        ? "Updating project model..."
                        : promoted
                          ? "Refresh from latest notes"
                          : "Generate project model"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
