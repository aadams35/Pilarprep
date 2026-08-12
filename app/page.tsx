"use client";

import type { DragEvent } from "react";
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
type ConsolePage = "setup" | "brief" | "project" | "demo" | "library" | "aws";
type WorkflowStepId =
  | "phase1-generate"
  | "phase1-review"
  | "phase1-refine"
  | "phase1-approve"
  | "phase2-capture"
  | "phase2-autobuild"
  | "phase2-plan"
  | "phase2-update";

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
    color: "bg-sky-600",
  },
  {
    id: "Sustainability",
    short: "Sustainability",
    tone: "Right-size resources and reduce waste.",
    risk: "Low" as RiskLevel,
    color: "bg-slate-500",
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
const feedbackCategories = [
  {
    title: "Executive lens",
    description: "Make the brief sharper for business sponsors and decision makers.",
    options: [
      "Make it more board-ready",
      "Reduce AWS jargon",
      "Add ROI and decision criteria",
      "Tighten the executive summary",
    ],
  },
  {
    title: "Technical depth",
    description: "Push the technical brief toward architecture validation and tradeoffs.",
    options: [
      "Add stronger technical depth",
      "Ask deeper architecture questions",
      "Show likely current-state assumptions",
      "Name AWS services with rationale",
    ],
  },
  {
    title: "Risk and compliance",
    description: "Emphasize controls, evidence, resilience, and approval blockers.",
    options: [
      "Lead with security and evidence",
      "Add compliance validation questions",
      "Strengthen RTO and RPO discovery",
      "Surface migration risk and rollback",
    ],
  },
  {
    title: "Cost and value",
    description: "Make the output stronger on economics and measurable outcomes.",
    options: [
      "Add cost angle",
      "Add time-to-value framing",
      "Include success metrics",
      "Separate quick wins from later bets",
    ],
  },
  {
    title: "Customer context",
    description: "Tell the model how to frame the customer starting point.",
    options: [
      "Customer is already on AWS",
      "Customer is migrating from on-prem",
      "Customer has a hybrid environment",
      "Customer has executive urgency",
    ],
  },
  {
    title: "Meeting execution",
    description: "Improve what the SA can actually say and ask live.",
    options: [
      "Improve discovery questions",
      "Add objection handling",
      "Create a tighter meeting agenda",
      "Clarify next-step owners",
    ],
  },
];

const legacyFeedbackMap: Record<string, string> = {
  "Make it more executive": "Executive lens: Make it more board-ready",
  "Add stronger technical depth": "Technical depth: Add stronger technical depth",
  "Reduce AWS jargon": "Executive lens: Reduce AWS jargon",
  "Focus on security": "Risk and compliance: Lead with security and evidence",
  "Add cost angle": "Cost and value: Add cost angle",
  "Improve discovery questions": "Meeting execution: Improve discovery questions",
  "Customer is already on AWS": "Customer context: Customer is already on AWS",
  "Customer is migrating from on-prem": "Customer context: Customer is migrating from on-prem",
};

const defaultFeedback = [
  "Executive lens: Make it more board-ready",
  "Risk and compliance: Lead with security and evidence",
];

function normalizeFeedback(items: unknown) {
  if (!Array.isArray(items)) {
    return defaultFeedback;
  }

  const normalized = items
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => legacyFeedbackMap[item] ?? item)
    .filter((item, index, list) => list.indexOf(item) === index);

  return normalized.length ? normalized : defaultFeedback;
}
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


const evidenceSources = [
  "Customer notes",
  "SA feedback",
  "AWS Well-Architected",
  "Bedrock Knowledge Base",
];

const storyBeats = [
  {
    time: "0:00",
    title: "Frame the problem",
    detail: "Open with the SA pain point: pre-meeting prep is manual, inconsistent, and rarely reusable after the meeting ends.",
  },
  {
    time: "2:00",
    title: "Set the client context",
    detail: "Choose a customer scenario, show the ranked pilar priorities, and explain how the meeting context shapes both technical and executive outputs.",
  },
  {
    time: "4:30",
    title: "Generate the pre-brief",
    detail: "Show the first AI-generated packet with a technical brief, executive brief, stakeholder lens, and SA game plan from the same input.",
  },
  {
    time: "7:00",
    title: "Refine with SA feedback",
    detail: "Apply targeted feedback to improve tone, depth, questions, and objections so the brief becomes customer-ready instead of generic.",
  },
  {
    time: "9:30",
    title: "Approve and promote",
    detail: "Approve the final pre-brief and explain that PilarPrep converts the final packet into follow-on handoff context automatically.",
  },
  {
    time: "12:00",
    title: "Show delivery handoff",
    detail: "Walk through the project handoff outputs for implementation teams, delivery leads, sales follow-up, and new project members catching up.",
  },
  {
    time: "14:00",
    title: "Close with AWS proof",
    detail: "Finish on the AWS story: CloudFront and S3 for the app, API Gateway and Lambda for orchestration, Bedrock for generation, and S3 plus DynamoDB for latest-state storage.",
  },
];

const packetOutputs = [
  {
    title: "Technical brief",
    key: "technical",
    detail: "Architecture assumptions, risk areas, service references, and deep-dive questions.",
  },
  {
    title: "Executive brief",
    key: "executive",
    detail: "Business context, outcome framing, success criteria, and low-jargon questions.",
  },
  {
    title: "Decision-maker lens",
    key: "stakeholders",
    detail: "Approved stakeholder context, likely priorities, tailored questions, and influence notes.",
  },
  {
    title: "SA game plan",
    key: "gameplan",
    detail: "Meeting objective, talk track, likely objections, and closeout checklist.",
  },
  {
    title: "Project handoff",
    key: "handoff",
    detail: "Notes, decisions, owners, risks, timeline, and role-aware follow-on answers.",
  },
] as const;

const awsArchitectureColumns = [
  {
    title: "Experience edge",
    detail: "Customer-facing delivery for the console and demo path.",
    services: [
      {
        badge: "USR",
        service: "User browser",
        note: "The seller or architect runs the workflow from a shared web console.",
      },
      {
        badge: "CF",
        service: "Amazon CloudFront",
        note: "HTTPS delivery, caching, and SPA routing for the React experience.",
      },
      {
        badge: "S3",
        service: "Amazon S3 frontend bucket",
        note: "Private origin that stores the built static UI assets.",
      },
    ],
  },
  {
    title: "Identity and API",
    detail: "Public demo access without exposing an API key.",
    services: [
      {
        badge: "COG",
        service: "Cognito Identity Pool",
        note: "Issues short-lived browser credentials for the public demo flow.",
      },
      {
        badge: "IAM",
        service: "Demo invoke role",
        note: "Limits the browser to invoking only the approved brief route.",
      },
      {
        badge: "API",
        service: "Amazon API Gateway",
        note: "Enforces IAM auth on POST /brief and forwards the request to Lambda.",
      },
    ],
  },
  {
    title: "Generation plane",
    detail: "Prompt orchestration, safety, and model invocation.",
    services: [
      {
        badge: "LMB",
        service: "AWS Lambda brief function",
        note: "Builds the prompt contract, validates JSON, and saves the response.",
      },
      {
        badge: "BR",
        service: "Amazon Bedrock",
        note: "Invokes the configured foundation model for brief and handoff content.",
      },
      {
        badge: "GRD",
        service: "Bedrock Guardrails",
        note: "Adds safety filtering and prompt-attack protection around generation.",
      },
    ],
  },
  {
    title: "Project memory",
    detail: "Latest-only artifacts, team context, and operations visibility.",
    services: [
      {
        badge: "DDB",
        service: "Amazon DynamoDB",
        note: "Tracks the active project state, provider, and approved packet metadata.",
      },
      {
        badge: "DOC",
        service: "Amazon S3 artifacts",
        note: "Stores the latest JSON packet and DOCX brief for each client workspace.",
      },
      {
        badge: "CW",
        service: "CloudWatch and Budget",
        note: "Captures logs, alarms, and daily demo cost guardrails.",
      },
    ],
  },
] as const;

const awsServiceIcons: Record<string, string> = {
  USR: "/globe.svg",
  CF: "/aws-services/cloudfront.svg",
  S3: "/aws-services/s3.svg",
  COG: "/aws-services/cognito.svg",
  IAM: "/aws-services/iam.svg",
  API: "/aws-services/api-gateway.svg",
  LMB: "/aws-services/lambda.svg",
  BR: "/aws-services/bedrock.svg",
  GRD: "/aws-services/bedrock.svg",
  DDB: "/aws-services/dynamodb.svg",
  DOC: "/aws-services/s3.svg",
  CW: "/aws-services/cloudwatch.svg",
};
const consolePages: Array<{ id: ConsolePage; label: string }> = [
  { id: "setup", label: "1. Context" },
  { id: "brief", label: "2. Brief" },
  { id: "project", label: "3. Handoff" },
  { id: "demo", label: "4. Demo" },
  { id: "aws", label: "AWS" },
];

const prebriefWorkflowSteps: Array<{
  id: WorkflowStepId;
  label: string;
  page: ConsolePage;
  sectionId: string;
}> = [
  { id: "phase1-generate", label: "Generate", page: "setup", sectionId: "setup" },
  { id: "phase1-review", label: "Review", page: "brief", sectionId: "brief-review-section" },
  { id: "phase1-refine", label: "Refine", page: "brief", sectionId: "brief-refine-section" },
  { id: "phase1-approve", label: "Approve", page: "brief", sectionId: "brief-approve-section" },
];

const projectWorkflowSteps: Array<{
  id: WorkflowStepId;
  label: string;
  page: ConsolePage;
  sectionId: string;
}> = [
  { id: "phase2-capture", label: "Capture notes", page: "project", sectionId: "project-notes-section" },
  { id: "phase2-autobuild", label: "Auto-build", page: "project", sectionId: "project-autobuild-section" },
  { id: "phase2-plan", label: "Plan", page: "project", sectionId: "project-plan-section" },
  { id: "phase2-update", label: "Update", page: "project", sectionId: "project-handoff-section" },
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
  const [draggedPillar, setDraggedPillar] = useState<string | null>(null);
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
  const [briefHistory, setBriefHistory] = useState<BriefHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
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
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);

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
      setFeedback(normalizeFeedback(saved.feedback));
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
      setBriefHistory(
        Array.isArray(saved.briefHistory)
          ? saved.briefHistory.filter(
              (entry): entry is BriefHistoryEntry =>
                typeof entry === "object" && entry !== null
            )
          : []
      );
      setSelectedHistoryId(
        typeof saved.selectedHistoryId === "string" ? saved.selectedHistoryId : null
      );
      setProjectBrainAnswer(
        typeof saved.projectBrainAnswer === "string"
          ? saved.projectBrainAnswer
          : ""
      );
      setProjectAnswerKey(
        typeof saved.projectAnswerKey === "string" ? saved.projectAnswerKey : ""
      );
      setJudgeMode(Boolean(saved.judgeMode));
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
        briefHistory,
        selectedHistoryId,
        projectBrainAnswer,
        projectAnswerKey,
        judgeMode,
      })
    );
  }, [
    activePrompt,
    activeTab,
    approved,
    briefHistory,
    briefVersion,
    company,
    companySize,
    context,
    decisionMakers,
    feedback,
    generatedBrief,
    industry,
    judgeMode,
    meetingNotes,
    meetingType,
    projectAnswerKey,
    projectBrainAnswer,
    promoted,
    role,
    scenarioId,
    selectedHistoryId,
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
      : blankBriefContent;
  const activeBriefText = [
    `${company || "Customer"} - ${briefTabLabel(activeTab)}`,
    "",
    ...briefContent[activeTab],
    "",
    `Sources: ${(generatedBrief?.citations ?? evidenceSources).join(", ")}`,
  ].join("\n");

  const followUpEmailText = generatedBrief?.projectArtifacts?.followUpEmail
    ? `Subject: ${generatedBrief.projectArtifacts.followUpEmail.subject}\n\n${generatedBrief.projectArtifacts.followUpEmail.body}`
    : `Subject: Follow-up from PilarPrep briefing for ${company || "the customer"}\n\nThanks for the conversation. We captured ${industryFocus} as the main outcome path and ${selectedPillars[0]?.toLowerCase() || "the first priority"} as the first validation area.\n\nRecommended next step: schedule a focused working session to confirm stakeholders, success criteria, risks, pilot scope, and owners.`;

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
      `PilarPrep handoff packet - ${company || "Customer"}`,
      `Meeting: ${meetingType} | Industry: ${industry} | Size: ${companySize}`,
      `Generation path: ${generatedBrief ? providerLabel(generatedBrief.provider) : "Not generated yet"}`,
      metadata?.artifactKey ? `S3 JSON: ${metadata.artifactKey}` : "S3 JSON: Not saved yet",
      metadata?.docxArtifactKey ? `S3 DOCX: ${metadata.docxArtifactKey}` : "S3 DOCX: Not saved yet",
      metadata?.docxDownloadUrl ? `DOCX download: ${metadata.docxDownloadUrl}` : "DOCX download: Not generated yet",
      metadata?.stateKey ? `DynamoDB state: ${metadata.stateKey}` : "DynamoDB state: Not saved yet",
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
      "Team handoff answer",
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

  const handoffReady = Boolean(
    generatedBrief &&
      promoted &&
      generatedBrief.metadata?.docxArtifactKey &&
      generatedBrief.metadata?.stateKey &&
      generatedBrief.projectArtifacts?.twoWeekPlan?.length &&
      generatedBrief.projectArtifacts?.riskRegister?.length &&
      generatedBrief.projectArtifacts?.stakeholderMap?.length
  );
  const selectedHistoryEntry = useMemo(
    () => briefHistory.find((entry) => entry.id === selectedHistoryId) ?? briefHistory[0] ?? null,
    [briefHistory, selectedHistoryId]
  );

  const selectedHistoryPacketItems = useMemo(
    () =>
      packetOutputs.map((packet) => ({
        ...packet,
        status: selectedHistoryEntry ? "Saved" : "Empty",
      })),
    [selectedHistoryEntry]
  );

  const libraryPreviewCards = useMemo(() => {
    if (!selectedHistoryEntry) {
      return [];
    }

    const savedBrief = selectedHistoryEntry.generatedBrief;

    return [
      {
        title: "Technical brief",
        detail: savedBrief.technical[0] ?? "No technical brief saved yet.",
      },
      {
        title: "Executive brief",
        detail: savedBrief.executive[0] ?? "No executive brief saved yet.",
      },
      {
        title: "Stakeholder lens",
        detail: savedBrief.stakeholders[0] ?? "No stakeholder detail saved yet.",
      },
      {
        title: "Handoff signal",
        detail:
          savedBrief.projectArtifacts?.twoWeekPlan?.[0]?.title ??
          savedBrief.gameplan[0] ??
          "No handoff detail saved yet.",
      },
    ];
  }, [selectedHistoryEntry]);

  const packetPreviewItems = useMemo(
    () =>
      packetOutputs.map((packet) => {
        if (packet.key === "technical" || packet.key === "executive") {
          return {
            ...packet,
            status: generatedBrief ? (approved ? "Approved" : "Generated") : "Queued",
          };
        }

        if (packet.key === "stakeholders") {
          return {
            ...packet,
            status: usableDecisionMakers.length
              ? generatedBrief
                ? "Tailored"
                : "Context ready"
              : "Needs context",
          };
        }

        if (packet.key === "gameplan") {
          return {
            ...packet,
            status: generatedBrief ? "Generated" : "Queued",
          };
        }

        return {
          ...packet,
          status: handoffReady
            ? "Ready"
            : promoted
              ? "Building"
              : generatedBrief
                ? "Next step"
                : "Queued",
        };
      }),
    [approved, generatedBrief, handoffReady, promoted, usableDecisionMakers.length]
  );
  const currentWorkflowStep = useMemo<WorkflowStepId>(() => {
    if (activePage === "project") {
      if (handoffReady) {
        return "phase2-update";
      }

      if (promoted) {
        return generatedBrief?.projectArtifacts?.twoWeekPlan?.length
          ? "phase2-plan"
          : "phase2-autobuild";
      }

      return "phase2-capture";
    }

    if (activePage === "brief") {
      if (approved) {
        return "phase1-approve";
      }

      if (briefVersion > 1) {
        return "phase1-refine";
      }

      return "phase1-review";
    }

    return "phase1-generate";
  }, [activePage, approved, briefVersion, generatedBrief, handoffReady, promoted]);
  const completedWorkflowSteps = useMemo(() => {
    const steps = new Set<WorkflowStepId>();

    if (generatedBrief) {
      steps.add("phase1-generate");
    }

    if (generatedBrief && activePage !== "setup") {
      steps.add("phase1-review");
    }

    if (briefVersion > 1) {
      steps.add("phase1-refine");
    }

    if (approved) {
      steps.add("phase1-approve");
    }

    if (approved && meetingNotes.trim()) {
      steps.add("phase2-capture");
    }

    if (promoted) {
      steps.add("phase2-autobuild");
    }

    if (promoted && generatedBrief?.projectArtifacts?.twoWeekPlan?.length) {
      steps.add("phase2-plan");
    }

    if (handoffReady) {
      steps.add("phase2-update");
    }

    return steps;
  }, [activePage, approved, briefVersion, generatedBrief, handoffReady, meetingNotes, promoted]);
  const presenterSteps = [
    {
      label: "0-3 min",
      value: "Problem, user, and customer context",
    },
    {
      label: "3-7 min",
      value: generatedBrief ? "Live brief generated" : "Generate the pre-brief live",
    },
    {
      label: "7-11 min",
      value: approved ? "Refined brief approved" : generatedBrief ? "Refine and approve the packet" : "Show feedback-to-brief loop",
    },
    {
      label: "11-15 min",
      value: handoffReady ? "Handoff and AWS proof ready" : promoted ? "Open handoff and AWS architecture" : "Promote into handoff and close on AWS",
    },
  ];

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

  function reorderPillar(pillar: string, targetIndex: number) {
    setSelectedPillars((current) => {
      const ranked = normalizePillarRanking(current);
      const currentIndex = ranked.indexOf(pillar);
      const boundedTargetIndex = Math.min(
        Math.max(targetIndex, 0),
        ranked.length - 1
      );

      if (currentIndex < 0 || currentIndex === boundedTargetIndex) {
        return ranked;
      }

      const nextRanking = [...ranked];
      const [movedPillar] = nextRanking.splice(currentIndex, 1);
      nextRanking.splice(boundedTargetIndex, 0, movedPillar);

      return nextRanking;
    });
  }

  function promotePillar(pillar: string) {
    reorderPillar(pillar, 0);
  }

  function handlePillarDragOver(
    event: DragEvent<HTMLDivElement>,
    targetPillar: string
  ) {
    event.preventDefault();

    if (!draggedPillar || draggedPillar === targetPillar) {
      return;
    }

    const targetIndex = selectedPillars.indexOf(targetPillar);
    reorderPillar(draggedPillar, targetIndex);
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

  function pushBriefHistory(nextBrief: BriefResponse, nextBriefVersion: number, nextApproved: boolean) {
    const historyEntry: BriefHistoryEntry = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      savedAt: nextBrief.generatedAt || new Date().toISOString(),
      company,
      industry,
      meetingType,
      companySize,
      selectedPillars: [...selectedPillars],
      context,
      decisionMakers: cloneDecisionMakers(usableDecisionMakers),
      meetingNotes,
      feedback: [...feedback],
      briefVersion: nextBriefVersion,
      approved: nextApproved,
      promoted: true,
      generatedBrief: nextBrief,
    };

    setBriefHistory((current) => [historyEntry, ...current].slice(0, 8));
    setSelectedHistoryId(historyEntry.id);
  }

  function loadBriefHistoryEntry(entry: BriefHistoryEntry) {
    setCompany(entry.company);
    setIndustry(entry.industry);
    setMeetingType(entry.meetingType);
    setCompanySize(entry.companySize);
    setSelectedPillars(normalizePillarRanking(entry.selectedPillars));
    setContext(entry.context);
    setDecisionMakers(cloneDecisionMakers(entry.decisionMakers));
    setMeetingNotes(entry.meetingNotes);
    setFeedback([...entry.feedback]);
    setBriefVersion(entry.briefVersion);
    setApproved(entry.approved);
    setPromoted(entry.promoted);
    setGeneratedBrief(entry.generatedBrief);
    setProjectBrainAnswer(entry.generatedBrief.projectAnswer || "");
    setProjectAnswerKey(`${role}::${activePrompt}`);
    setSelectedHistoryId(entry.id);
    setGenerationError("");
    setGenerationNotice("");
    setActiveTab("technical");
    setActivePage("brief");
  }

  function resetWorkspace() {
    window.localStorage.removeItem(workspaceStorageKey);
    setBriefHistory([]);
    setSelectedHistoryId(null);
    setFeedback(defaultFeedback);
    setRole(defaultRole);
    setActivePrompt(rolePrompts[defaultRole][0]);
    setActivePage("setup");
    setPendingSectionId(null);
    setJudgeMode(false);
    setCopiedLabel("");
    setGenerationNotice("");
    loadScenario(scenarios[0]);
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

      const nextApproved = mode === "project";
      const nextBriefVersion = mode === "project" ? briefVersion : briefVersion + 1;

      setGeneratedBrief(nextBrief);
      pushBriefHistory(nextBrief, nextBriefVersion, nextApproved);
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

  function copyDocxPath() {
    void copyText("DOCX path", generatedBrief?.metadata?.docxArtifactKey ?? "");
  }

  function openWorkflowStep(stepId: WorkflowStepId) {
    const step = [...prebriefWorkflowSteps, ...projectWorkflowSteps].find(
      (candidate) => candidate.id === stepId
    );

    if (!step) {
      return;
    }

    setActivePage(step.page);
    setPendingSectionId(step.sectionId);
  }

  useEffect(() => {
    if (!pendingSectionId) {
      return;
    }

    const scrollToSection = () => {
      const section = document.getElementById(pendingSectionId);

      if (!section) {
        return false;
      }

      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToSection()) {
      const frame = window.requestAnimationFrame(() => {
        setPendingSectionId(null);
      });

      return () => window.cancelAnimationFrame(frame);
    }
    const timeout = window.setTimeout(() => {
      if (scrollToSection()) {
        setPendingSectionId(null);
      }
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [activePage, generatedBrief, pendingSectionId, promoted]);

  function toggleJudgeMode() {
    const nextJudgeMode = !judgeMode;
    setJudgeMode(nextJudgeMode);

    if (nextJudgeMode) {
      setActivePage(handoffReady || promoted ? "project" : generatedBrief ? "brief" : "setup");
    }
  }

  const currentStageLabel = handoffReady
    ? "Handoff ready"
    : approved
      ? "Ready for handoff"
      : generatedBrief
        ? "Brief in review"
        : "Context in progress";

  function continueWorkflow() {
    if (!generatedBrief) {
      refineBrief();
      return;
    }

    if (!approved) {
      setActivePage("brief");
      return;
    }

    if (!handoffReady) {
      openProjectBrain();
      return;
    }

    setActivePage("demo");
  }
  return (
    <main className={cx("app-shell min-h-screen text-[#111827]", judgeMode && "presenter-guide-on")}>
      <header className="app-header">
        <div className="app-header-inner">
          <button className="product-brand" type="button" onClick={() => setActivePage("setup")} aria-label="Open PilarPrep context">
            <span className="product-mark">P</span>
            <span>PilarPrep</span>
          </button>

          <nav className="workflow-nav" aria-label="PilarPrep workflow">
            {consolePages.filter((page) => page.id !== "aws").map((page, index) => {
              const isComplete =
                (page.id === "setup" && Boolean(generatedBrief)) ||
                (page.id === "brief" && approved) ||
                (page.id === "project" && handoffReady);

              return (
                <button
                  key={page.id}
                  className={cx(
                    "workflow-nav-item",
                    activePage === page.id && "workflow-nav-item-active",
                    isComplete && "workflow-nav-item-complete"
                  )}
                  type="button"
                  onClick={() => setActivePage(page.id)}
                >
                  <span>{isComplete ? "✓" : index + 1}</span>
                  <strong>{page.label.replace(/^\d+\.\s*/, "")}</strong>
                </button>
              );
            })}
          </nav>

          <div className="utility-nav">
            <button
              className={cx("utility-button", activePage === "library" && "utility-button-active")}
              type="button"
              onClick={() => setActivePage("library")}
              aria-label="Open saved briefs"
              title="Saved briefs"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5a2.5 2.5 0 0 0-2.5-2.5H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M6.5 3v15.5M9 7h7M9 11h7M9 15h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span>Saved</span>
              {briefHistory.length ? <small>{briefHistory.length}</small> : null}
            </button>
            <button
              className={cx("utility-button", activePage === "aws" && "utility-button-active")}
              type="button"
              onClick={() => setActivePage("aws")}
              aria-label="Open AWS architecture"
              title="AWS architecture"
            >
              <span className="aws-wordmark">AWS</span>
              <span>Architecture</span>
            </button>
            <button
              className={cx("presenter-button", judgeMode && "presenter-button-active")}
              type="button"
              onClick={toggleJudgeMode}
              aria-pressed={judgeMode}
            >
              {judgeMode ? "Presenter on" : "Presenter"}
            </button>
          </div>
        </div>

        <div className="workspace-context-bar">
          <div className="workspace-context-main">
            <span className="workspace-avatar">{(company || "P").slice(0, 1).toUpperCase()}</span>
            <div>
              <small>Client workspace</small>
              <strong>{company || "Select a client"}</strong>
            </div>
          </div>
          <div className="workspace-context-meta" aria-label="Current client context">
            <span>{meetingType}</span>
            <span>{industry}</span>
            <span>Top pilar: {selectedPillars[0] ?? "Set ranking"}</span>
          </div>
          <div className="workspace-context-action">
            <span className={cx("stage-state", handoffReady && "stage-state-complete")}>{currentStageLabel}</span>
            <button type="button" onClick={continueWorkflow} disabled={isGenerating}>
              {isGenerating
                ? "Generating..."
                : !generatedBrief
                  ? "Generate brief"
                  : !approved
                    ? "Review brief"
                    : !handoffReady
                      ? "Open handoff"
                      : "Open demo"}
            </button>
          </div>
        </div>

        <div className="sr-only">PilarPrep workspace</div>
        {judgeMode ? (
          <div className="presenter-strip presenter-strip-v2" aria-label="Presenter walkthrough guide">
            {presenterSteps.map((step, index) => (
              <div key={step.label} className={cx("presenter-step", index === presenterSteps.length - 1 && handoffReady && "presenter-step-ready")}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.value}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </header>      {activePage === "library" ? (
        <div className="page-view">
          <section className="mx-auto max-w-[1500px] px-5 pt-5">
            <div className="library-shell">
              <div className="library-titlebar">
                <div>
                  <p>Saved briefs</p>
                  <h1>Pick up where the team left off</h1>
                  <span>Review a previous customer packet, download the latest document, or load it back into the working brief.</span>
                </div>
                <button className="small-action primary-small-action" type="button" onClick={() => setActivePage("setup")}>
                  New brief
                </button>
              </div>              {briefHistory.length ? (
                <div className="library-grid">
                  <div className="library-list">
                    {briefHistory.map((entry) => (
                      <button
                        key={entry.id}
                        className={cx("library-entry", selectedHistoryEntry?.id === entry.id && "library-entry-active")}
                        type="button"
                        onClick={() => setSelectedHistoryId(entry.id)}
                      >
                        <div className="library-entry-head">
                          <strong>{entry.company}</strong>
                          <span>{new Date(entry.savedAt).toLocaleString()}</span>
                        </div>
                        <p>{entry.meetingType} / {entry.industry} / {entry.companySize}</p>
                        <div className="library-entry-meta">
                          <span>Top pilar: {entry.selectedPillars[0] ?? "Not set"}</span>
                          <span>{entry.approved ? "Approved packet" : `Draft v${entry.briefVersion}`}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="library-detail">
                    {selectedHistoryEntry ? (
                      <>
                        <div className="library-detail-head">
                          <div>
                            <p>Selected packet</p>
                            <h3>{selectedHistoryEntry.company}</h3>
                            <span>{selectedHistoryEntry.meetingType} / {selectedHistoryEntry.industry} / {selectedHistoryEntry.companySize}</span>
                          </div>
                          <div className="library-detail-actions">
                            <button className="small-action primary-small-action" type="button" onClick={() => loadBriefHistoryEntry(selectedHistoryEntry)}>
                              Load into workspace
                            </button>
                            {selectedHistoryEntry.generatedBrief.metadata?.docxDownloadUrl ? (
                              <a
                                className="setup-packet-link"
                                href={selectedHistoryEntry.generatedBrief.metadata.docxDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Download DOCX
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="packet-grid library-packet-grid">
                          {selectedHistoryPacketItems.map((packet, index) => (
                            <div key={packet.title} className="packet-tile">
                              <span>{index + 1}</span>
                              <small>{packet.status}</small>
                              <strong>{packet.title}</strong>
                              <p>{packet.detail}</p>
                            </div>
                          ))}
                        </div>
                        <div className="library-preview-grid">
                          {libraryPreviewCards.map((card) => (
                            <div key={card.title} className="library-preview-card">
                              <span>{card.title}</span>
                              <p>{card.detail}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="library-empty-state">
                  <strong>No saved briefs yet</strong>
                  <p>Generate a brief once and it will appear here for fast catch-up and handoff review.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activePage === "aws" ? (
        <div className="page-view architecture-page">
          <section className="content-shell">
            <div className="page-titlebar">
              <div className="page-title-copy">
                <span className="page-number page-number-aws">AWS</span>
                <div>
                  <p>Solution architecture</p>
                  <h1>A focused serverless path from context to handoff</h1>
                  <span>Every service has one clear job: deliver the workspace, authorize the request, generate the packet, and retain only the latest client state.</span>
                </div>
              </div>
              <div className="architecture-posture">
                <span>Serverless</span>
                <span>IAM controlled</span>
                <span>Latest-only storage</span>
              </div>
            </div>

            <div className="architecture-board-v2">
              <div className="architecture-board-head">
                <div>
                  <span>Request path</span>
                  <h2>PilarPrep on AWS</h2>
                </div>
                <p>One synchronous generation path with durable handoff artifacts and operational guardrails.</p>
              </div>

              <div className="architecture-flow-v2">
                {awsArchitectureColumns.map((column, columnIndex) => (
                  <div className="architecture-zone" key={column.title}>
                    <div className="architecture-zone-label">
                      <span>{String(columnIndex + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{column.title}</strong>
                        <small>{column.detail}</small>
                      </div>
                    </div>
                    <div className="architecture-services">
                      {column.services.map((service) => (
                        <div className="architecture-service" key={service.service}>
                          <span
                            className={cx("architecture-service-icon", `architecture-service-icon-${columnIndex + 1}`)}
                            style={{ backgroundImage: `url(${awsServiceIcons[service.badge]})` }}
                            aria-hidden="true"
                          />
                          <div>
                            <strong>{service.service}</strong>
                            <p>{service.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {columnIndex < awsArchitectureColumns.length - 1 ? (
                      <span className="architecture-connector" aria-hidden="true">→</span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="architecture-foundation">
                <div>
                  <span>Security boundary</span>
                  <strong>Short-lived identity, route-scoped IAM, least-privilege Lambda permissions, and Bedrock Guardrails.</strong>
                </div>
                <div>
                  <span>Cost posture</span>
                  <strong>Pay-per-request services, no idle compute, latest-only artifacts, and a daily budget target under 1 USD.</strong>
                </div>
                <div>
                  <span>Operations</span>
                  <strong>CloudWatch logs and alarms make the demo observable without adding a separate operations tier.</strong>
                </div>
              </div>
            </div>

            <div className="architecture-explainer">
              <div>
                <span>How to explain it</span>
                <h2>The brief is generated; the client context is retained.</h2>
              </div>
              <p>
                Amazon Bedrock remains an AWS-managed foundation model. PilarPrep stores the approved prompt context,
                generated packet, and handoff state in client-scoped S3 and DynamoDB records so the same workflow can
                support a different customer without copying or hosting model weights.
              </p>
            </div>
          </section>
        </div>
      ) : null}
      <section className="linear-workflow mx-auto max-w-[1500px] px-5 py-5">
        {activePage === "setup" ? (
          <div className="page-view">
        <div className="page-titlebar" id="setup">
          <div className="page-title-copy">
            <span className="page-number">01</span>
            <div>
              <p>Customer preparation</p>
              <h1>Build the meeting context</h1>
              <span>Choose a starting scenario, confirm what matters, and rank the AWS pillars that should shape the conversation.</span>
            </div>
          </div>
          <div className="page-title-status">
            <small>Next outcome</small>
            <strong>A tailored technical and executive brief</strong>
          </div>
        </div>

        <section className={cx("packet-glance", generatedBrief && "packet-glance-ready")} aria-label="Generated packet">
          <div className="packet-glance-intro">
            <span>Generated packet</span>
            <strong>{generatedBrief ? "Your packet is ready to review" : "One input creates five reusable outputs"}</strong>
          </div>
          <div className="packet-glance-items">
            {packetPreviewItems.map((packet, index) => (
              <button
                key={packet.title}
                type="button"
                onClick={() => setActivePage(packet.key === "handoff" ? "project" : "brief")}
                disabled={!generatedBrief}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{packet.title}</strong>
                  <small>{packet.status}</small>
                </div>
              </button>
            ))}
          </div>
          {generatedBrief?.metadata?.docxDownloadUrl ? (
            <a href={generatedBrief.metadata.docxDownloadUrl} target="_blank" rel="noreferrer">
              Download DOCX
            </a>
          ) : null}
        </section>
        <div className="setup-grid">
          <section className="rounded-lg border border-[#d7dee8] bg-white shadow-sm">
            <div className="border-b border-[#e0e7ef] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#446076]">
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

          <section className="rounded-lg border border-[#d7dee8] bg-white shadow-sm">
            <div className="border-b border-[#e0e7ef] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#446076]">
                Brief inputs
              </p>
              <h2 className="mt-1 text-xl font-black">Customer context</h2>
            </div>

            <div className="brief-input-grid p-5">
              <div className="brief-input-column brief-input-basics">
                <div className="brief-input-column-head">
                  <span>01</span>
                  <div>
                    <strong>Customer</strong>
                    <small>Who is in the meeting</small>
                  </div>
                </div>
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
              </div>
              <div className="brief-input-column brief-input-priorities">
                <div className="brief-input-column-head">
                  <span>02</span>
                  <div>
                    <strong>Priorities</strong>
                    <small>Drag to rank the discovery lens</small>
                  </div>
                </div>

              <div>
                <span className="field-label">AWS pillar ranking</span>
                <div className="pillar-ranking-list" aria-label="AWS Well-Architected pillar ranking">
                  {selectedPillarDetails.map((pillar, index) => (
                    <div
                      aria-label={`${pillar.id} ranked ${index + 1}`}
                      aria-roledescription="draggable ranking item"
                      draggable
                      key={pillar.id}
                      onDragEnd={() => setDraggedPillar(null)}
                      onDragOver={(event) => handlePillarDragOver(event, pillar.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", pillar.id);
                        setDraggedPillar(pillar.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDraggedPillar(null);
                      }}
                      className={cx(
                        "pillar-rank-card",
                        index === 0 && "pillar-rank-card-primary",
                        draggedPillar === pillar.id && "pillar-rank-card-dragging"
                      )}
                    >
                      <button
                        aria-label={`Drag ${pillar.id} priority`}
                        className="pillar-rank-grip"
                        tabIndex={-1}
                        type="button"
                      />
                      <span className="pillar-rank-number">{index + 1}</span>
                      <span className={cx("h-2.5 w-2.5 rounded-full", pillar.color)} />
                      <div className="pillar-rank-copy">
                        <strong>{pillar.short}</strong>
                        <p>{pillar.id}</p>
                      </div>
                      <button
                        className="pillar-rank-promote"
                        disabled={index === 0}
                        onClick={() => promotePillar(pillar.id)}
                        type="button"
                      >
                        {index === 0 ? "Top" : "Make top"}
                      </button>
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
              </div>
              <div className="brief-input-column brief-input-stakeholders">
                <div className="brief-input-column-head">
                  <span>03</span>
                  <div>
                    <strong>Stakeholders</strong>
                    <small>Approved decision-maker context</small>
                  </div>
                </div>

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
                      ? "Generate AI brief + handoff"
                      : "Generate brief + handoff"}
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
                <span>Saved packet</span>
                <strong>{generatedBrief?.metadata?.docxArtifactKey ?? generatedBrief?.metadata?.artifactKey ?? "Not saved yet"}</strong>
              </div>
              {generatedBrief?.metadata?.projectId || generatedBrief?.metadata?.stateKey ? (
                <div className="evidence-tray">
                  {generatedBrief.metadata.clientId || generatedBrief.metadata.projectId ? <span>Client {generatedBrief.metadata.clientId ?? generatedBrief.metadata.projectId}</span> : null}
                  {generatedBrief.metadata.stateKey ? <span>DynamoDB {generatedBrief.metadata.stateKey}</span> : null}
                  {generatedBrief.metadata.modelId ? <span>{generatedBrief.metadata.modelId}</span> : null}
                  {generatedBrief.metadata.totalTokens ? <span>{generatedBrief.metadata.totalTokens} tokens</span> : null}
                  {generatedBrief.metadata.latencyMs ? <span>{generatedBrief.metadata.latencyMs} ms</span> : null}
                  {generatedBrief.metadata.storageWarning ? <span>{generatedBrief.metadata.storageWarning}</span> : null}
                </div>
              ) : null}
              <div className="artifact-actions">
                {generatedBrief?.metadata?.docxDownloadUrl ? (
                  <a
                    className="artifact-action artifact-action-primary"
                    href={generatedBrief.metadata.docxDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download DOCX
                  </a>
                ) : null}
                <button
                  className="artifact-action"
                  type="button"
                  disabled={!generatedBrief?.metadata?.docxArtifactKey}
                  onClick={copyDocxPath}
                >
                  Copy DOCX path
                </button>
                {copiedLabel === "DOCX path" ? <span className="copy-state">DOCX path copied</span> : null}
              </div>
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
        <div className="page-titlebar page-titlebar-brief" id="brief">
          <div className="page-title-copy">
            <span className="page-number">02</span>
            <div>
              <p>Brief review</p>
              <h1>Shape the customer conversation</h1>
              <span>Review each audience view, apply focused feedback, and approve the version the team will use.</span>
            </div>
          </div>
          <div className="page-title-actions">
            <span className={cx("approval-state", approved && "approval-state-done")}>
              {approved ? "Approved" : generatedBrief ? `Draft v${briefVersion}` : "Waiting for generation"}
            </span>
            <button type="button" disabled={!generatedBrief || approved} onClick={approveBrief}>
              {approved ? "Brief approved" : "Approve brief"}
            </button>
          </div>
        </div>

        <div className="inline-workflow" aria-label="Brief workflow">
          {prebriefWorkflowSteps.map((step, index) => (
            <button
              key={step.id}
              className={cx(
                "inline-workflow-step",
                currentWorkflowStep === step.id && "inline-workflow-step-active",
                completedWorkflowSteps.has(step.id) && "inline-workflow-step-complete"
              )}
              type="button"
              onClick={() => openWorkflowStep(step.id)}
            >
              <span>{completedWorkflowSteps.has(step.id) ? "✓" : index + 1}</span>
              <strong>{step.label}</strong>
            </button>
          ))}
        </div>

        <div className="space-y-5">          <section id="brief-review-section" className="brief-review-layout">
            <div className="brief-workspace-shell">
              <div className="flex flex-col gap-4 border-b border-[#e0e7ef] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#446076]">
                    Final pre-brief workspace
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {company || "Customer"} {meetingType}
                  </h2>
                  <p className="mt-1 text-sm text-[#526070]">
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

              <div className="brief-workspace-main">
                <div className="space-y-4">
                  <div className={cx("brief-surface", isGenerating && "brief-surface-busy")}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#446076]">
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
                      {briefContent[activeTab].length ? (
                        briefContent[activeTab].map((item) => (
                          <p key={item} className="brief-line">
                            {item}
                          </p>
                        ))
                      ) : (
                        <div className="brief-empty-state">
                          <strong>{isGenerating ? "Building the customer brief..." : "No brief generated yet"}</strong>
                          <p>{isGenerating ? "The workspace will populate when the packet is ready." : "Return to Customer Context and generate the first packet."}</p>
                        </div>
                      )}
                    </div>                    <div className="evidence-tray">
                      {(generatedBrief?.citations ?? evidenceSources).map((source) => (
                        <span key={source}>{source}</span>
                      ))}
                    </div>
                  </div>

                  <div className="refinement-panel" id="brief-refine-section">
                    <div className="refinement-header">
                      <div>
                        <h3 className="text-sm font-black">Refinement feedback</h3>
                        <p>{feedback.length} selected across {feedbackCategories.length} categories</p>
                      </div>
                      <div className="refinement-actions">
                        <button
                          className="small-action"
                          type="button"
                          disabled={!feedback.length || isGenerating}
                          onClick={() => setFeedback([])}
                        >
                          Clear
                        </button>
                        <button
                          className="small-action primary-small-action"
                          type="button"
                          disabled={isGenerating}
                          onClick={refineBrief}
                        >
                          {isGenerating ? "Applying..." : "Apply feedback"}
                        </button>
                      </div>
                    </div>
                    <div className="feedback-category-grid">
                      {feedbackCategories.map((category) => {
                        const categoryValues = category.options.map(
                          (option) => `${category.title}: ${option}`
                        );
                        const selectedCount = categoryValues.filter((option) =>
                          feedback.includes(option)
                        ).length;

                        return (
                          <section className="feedback-category" key={category.title}>
                            <div className="feedback-category-title">
                              <div>
                                <strong>{category.title}</strong>
                                <span>{category.description}</span>
                              </div>
                              <em>{selectedCount}/{category.options.length}</em>
                            </div>
                            <div className="feedback-chip-row">
                              {category.options.map((option) => {
                                const value = `${category.title}: ${option}`;
                                return (
                                  <button
                                    key={value}
                                    className={cx(
                                      "feedback-chip",
                                      feedback.includes(value) && "feedback-chip-active"
                                    )}
                                    onClick={() => toggleFeedback(value)}
                                    type="button"
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                    <div className={cx("refinement-approve-row", approved && "refinement-approve-row-done")} id="brief-approve-section">
                      <div>
                        <strong>{approved ? "Approved for team use" : "Approval is the final quality gate"}</strong>
                        <p>
                          {approved
                            ? "This version now anchors the delivery handoff and saved packet."
                            : "Use the approval action at the top once the audience views and questions are ready."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="summary-panel stakeholder-summary">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#446076]">
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
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#446076]">
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


                </div>
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-[#d7dee8] bg-white shadow-sm">
                <div className="border-b border-[#e0e7ef] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#446076]">
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


          </div>
          </div>
        ) : null}


          {activePage === "demo" ? (
            <div className="page-view demo-page">
              <section className="content-shell">
                <div className="page-titlebar page-titlebar-demo">
                  <div className="page-title-copy">
                    <span className="page-number">04</span>
                    <div>
                      <p>Presentation workspace</p>
                      <h1>Tell the PilarPrep story in 15 minutes</h1>
                      <span>A judge-ready view of the customer problem, generated packet, team handoff, and AWS architecture.</span>
                    </div>
                  </div>
                  <div className="demo-ready-state">
                    <span className={cx("demo-ready-dot", generatedBrief && approved && "demo-ready-dot-complete")} />
                    <div>
                      <small>Walkthrough status</small>
                      <strong>{approved ? "Ready to present" : generatedBrief ? "Approve the brief to finish" : "Generate a packet to begin"}</strong>
                    </div>
                  </div>
                </div>

                <section className="demo-packet">
                  <div className="demo-section-heading">
                    <div>
                      <span>Generated packet</span>
                      <h2>{generatedBrief ? `${company} meeting packet` : "The five outputs judges will see"}</h2>
                    </div>
                    <div>
                      <button type="button" onClick={() => setActivePage("brief")}>Open brief</button>
                      <button type="button" onClick={openProjectBrain}>Open handoff</button>
                    </div>
                  </div>
                  <div className="demo-packet-grid-v2">
                    {packetPreviewItems.map((packet, index) => (
                      <button
                        key={packet.title}
                        type="button"
                        onClick={() => setActivePage(packet.key === "handoff" ? "project" : "brief")}
                        className={cx(generatedBrief && "demo-packet-item-ready")}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{packet.title}</strong>
                        <p>{packet.detail}</p>
                        <small>{packet.status}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="demo-stage-grid-v2">
                  <section className="demo-story-v2">
                    <div className="demo-section-heading">
                      <div>
                        <span>Presenter timeline</span>
                        <h2>The walkthrough</h2>
                      </div>
                    </div>
                    <div className="demo-timeline-v2">
                      {storyBeats.map((beat, index) => (
                        <button
                          key={beat.time}
                          type="button"
                          onClick={() => {
                            if (index <= 1) setActivePage("setup");
                            else if (index <= 4) setActivePage("brief");
                            else if (index === 5) setActivePage("project");
                            else setActivePage("aws");
                          }}
                        >
                          <time>{beat.time}</time>
                          <span />
                          <div>
                            <strong>{beat.title}</strong>
                            <p>{beat.detail}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <aside className="demo-run-card">
                    <div>
                      <span>Live demo path</span>
                      <h2>Three scenes. One customer story.</h2>
                    </div>
                    <ol>
                      <li>
                        <span>1</span>
                        <div>
                          <strong>Prepare</strong>
                          <p>Load a customer scenario and show how ranked priorities shape the brief.</p>
                        </div>
                      </li>
                      <li>
                        <span>2</span>
                        <div>
                          <strong>Decide</strong>
                          <p>Review technical and executive views, apply feedback, then approve.</p>
                        </div>
                      </li>
                      <li>
                        <span>3</span>
                        <div>
                          <strong>Continue</strong>
                          <p>Open the team handoff and close with the concise AWS architecture.</p>
                        </div>
                      </li>
                    </ol>
                    <button type="button" onClick={() => setActivePage("setup")}>Start walkthrough</button>
                    <button className="demo-architecture-link" type="button" onClick={() => setActivePage("aws")}>View AWS architecture</button>
                  </aside>
                </div>
              </section>
            </div>
          ) : null}
          {activePage === "project" ? (
            <div className="page-view">
          <div className="page-titlebar page-titlebar-handoff" id="project-brain">
            <div className="page-title-copy">
              <span className="page-number">03</span>
              <div>
                <p>Team continuity</p>
                <h1>Turn the approved brief into action</h1>
                <span>Capture meeting outcomes, generate role-aware follow-through, and give every team member the same project context.</span>
              </div>
            </div>
            <div className="page-title-status">
              <small>Handoff state</small>
              <strong>{handoffReady ? "Ready for the team" : promoted ? "Build in progress" : "Waiting for approved brief"}</strong>
            </div>
          </div>

          <div id="project-handoff-section" className={cx("handoff-ready-card", handoffReady && "handoff-ready-card-done")}>
            <div>
              <span>{handoffReady ? "Handoff packet ready" : "Handoff packet building"}</span>
              <h3>{handoffReady ? `${company || "Customer"} is ready for project handoff` : "Generate and review the handoff to finish the demo"}</h3>
              <p>
                {handoffReady
                  ? "The latest DOCX, JSON packet, project state, implementation plan, risks, stakeholders, and follow-up email are ready for the delivery team."
                  : "The finish state appears once the brief is generated, promoted into the handoff workspace, and saved as the latest client packet."}
              </p>
            </div>
            <div className="handoff-ready-actions">
              {generatedBrief?.metadata?.docxDownloadUrl ? (
                <a
                  className="handoff-ready-action handoff-ready-action-primary"
                  href={generatedBrief.metadata.docxDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download DOCX
                </a>
              ) : null}

              <button
                className="handoff-ready-action"
                type="button"
                disabled={!generatedBrief}
                onClick={copyHandoffPacket}
              >
                Copy packet
              </button>
            </div>
          </div>

          <section className="rounded-lg border border-[#d7dee8] bg-[#111827] text-white shadow-sm">
            <div className="grid gap-0 2xl:grid-cols-[380px_1fr]">
              <div className="border-b border-white/10 p-5 2xl:border-b-0 2xl:border-r">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">
                  Handoff workspace
                </p>
                <h2 className="mt-1 text-xl font-black">Team handoff</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Once generated, the final brief becomes an auto-built handoff
                  workspace for people who need to implement, manage, sell, or
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
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">
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
                            {promoted ? "Team handoff ready" : "Handoff pending"}
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

                    <div id="project-plan-section" className="mt-5 grid gap-3 md:grid-cols-4">
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

                  <div className="meeting-panel" id="project-notes-section">
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
                      id="project-autobuild-section"
                      className={cx(
                        "project-promote-wide",
                        promoted && "project-promote-wide-done"
                      )}
                      type="button"
                      disabled={isGenerating}
                      onClick={refreshProjectModel}
                    >
                      {isGenerating
                        ? "Updating handoff..."
                        : promoted
                          ? "Refresh from latest notes"
                          : "Generate handoff"}
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










