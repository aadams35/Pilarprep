"use client";

import { useMemo, useState } from "react";

type BriefTab = "technical" | "executive" | "gameplan" | "objections";
type AudienceRole = "Sales" | "Executive" | "PM" | "Engineer" | "New member";
type RiskLevel = "Low" | "Medium" | "High";

type Scenario = {
  id: string;
  name: string;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  context: string;
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
  "Generate",
  "Refine",
  "Approve",
  "Promote",
  "Execute",
];

const evidenceSources = [
  "Customer notes",
  "SA feedback",
  "AWS Well-Architected",
  "Bedrock Knowledge Base",
];

const demoBeats = [
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
    title: "Promote to project",
    detail: "Capture meeting outcomes and turn the brief into shared delivery memory.",
  },
  {
    time: "1:15",
    title: "Ask Project Brain",
    detail: "Switch roles and generate the plan, exec summary, or onboarding answer.",
  },
];

const architectureFlow = [
  "Context",
  "Bedrock",
  "Refine",
  "S3",
  "Knowledge Base",
  "Project Brain",
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
    title: "SA game plan",
    detail: "Meeting objective, talk track, likely objections, and closeout checklist.",
  },
  {
    title: "Project handoff",
    detail: "Notes, decisions, owners, risks, timeline, and role-aware follow-on answers.",
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
    detail: "Thin request layer for brief generation, feedback capture, and project promotion.",
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

const signalMetrics = [
  { label: "Context fit", value: 92 },
  { label: "Pillar match", value: 88 },
  { label: "Handoff depth", value: 81 },
  { label: "AWS readiness", value: 94 },
];

const heroProofPoints = [
  "Bedrock generation loop",
  "Well-Architected pillar scoring",
  "Project Brain handoff",
  "AWS-ready deployment path",
];

const runtimeSignals = [
  "Bedrock",
  "Lambda",
  "S3",
  "DynamoDB",
  "CloudWatch",
];

const implementationBacklog = [
  "CDK or SAM stack",
  "Bedrock prompt contract",
  "Knowledge Base bucket",
  "DynamoDB project schema",
  "Guardrail policy",
  "CloudWatch dashboard",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function riskWidth(level: RiskLevel) {
  if (level === "High") {
    return "88%";
  }

  if (level === "Medium") {
    return "62%";
  }

  return "34%";
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState("apex");
  const activeScenario =
    scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];
  const [company, setCompany] = useState(activeScenario.company);
  const [industry, setIndustry] = useState(activeScenario.industry);
  const [meetingType, setMeetingType] = useState(activeScenario.meetingType);
  const [companySize, setCompanySize] = useState(activeScenario.companySize);
  const [selectedPillars, setSelectedPillars] = useState(
    activeScenario.pillars
  );
  const [context, setContext] = useState(activeScenario.context);
  const [meetingNotes, setMeetingNotes] = useState(
    activeScenario.meetingNotes
  );
  const [activeTab, setActiveTab] = useState<BriefTab>("technical");
  const [briefVersion, setBriefVersion] = useState(1);
  const [feedback, setFeedback] = useState<string[]>([
    "Make it more executive",
    "Focus on security",
  ]);
  const [approved, setApproved] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [role, setRole] = useState<AudienceRole>("PM");
  const [activePrompt, setActivePrompt] = useState(
    "Create the first two-week plan."
  );

  const selectedPillarDetails = pillars.filter((pillar) =>
    selectedPillars.includes(pillar.id)
  );
  const primaryConcern = selectedPillarDetails[0]?.id ?? "Discovery";
  const readinessScore = promoted ? 96 : approved ? 84 : briefVersion > 1 ? 71 : 58;
  const lifecycleProgress = promoted ? 100 : approved ? 72 : briefVersion > 1 ? 48 : 22;

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

  const qualityChecks = useMemo(
    () => [
      {
        label: "Pillar coverage",
        value: Math.min(96, 58 + selectedPillars.length * 11),
        detail: `${selectedPillars.length} AWS Well-Architected priorities selected`,
      },
      {
        label: "Executive clarity",
        value: feedback.includes("Reduce AWS jargon") ? 92 : 78,
        detail: feedback.includes("Reduce AWS jargon")
          ? "Jargon filter applied"
          : "Needs low-jargon refinement",
      },
      {
        label: "Handoff readiness",
        value: approved ? (promoted ? 96 : 84) : 62,
        detail: promoted
          ? "Project workspace is ready"
          : approved
            ? "Ready to promote after meeting"
            : "Approve final brief first",
      },
      {
        label: "Grounding path",
        value: 88,
        detail: "Designed for Bedrock Knowledge Bases and citations",
      },
    ],
    [approved, feedback, promoted, selectedPillars.length]
  );

  const briefContent = useMemo(
    () => ({
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
      gameplan: [
        "Open by confirming the business event driving urgency, then map technical unknowns to business impact.",
        `Spend the first half on ${selectedPillars.join(", ").toLowerCase()} and use the final ten minutes to agree on success measures and next steps.`,
        "Close with a crisp handoff: confirmed goals, known risks, unanswered questions, owners, timeline, and whether the brief should be promoted into a project workspace.",
      ],
      objections: [
        "Customer pushback: We cannot risk disruption during this program.",
        `Response: propose a bounded pilot around ${selectedPillars[0]?.toLowerCase() || "the top priority"}, define rollback criteria, and connect each technical checkpoint to business continuity.`,
        "Customer pushback: This sounds expensive. Response: start with unit-cost visibility, right-sizing, and a decision checkpoint before scaling the implementation.",
      ],
    }),
    [
      activeScenario.winTheme,
      company,
      companySize,
      industryFocus,
      selectedPillars,
    ]
  );

  const projectAnswer = useMemo(() => {
    const customerName = company || "the customer";

    if (role === "PM") {
      return `Start with a two-week discovery sprint for ${customerName}: confirm stakeholders, validate the ${selectedPillars[0]?.toLowerCase() || "top"} risk, capture current-state architecture, and publish a decision log. Track owners for security, data, app dependencies, and executive success criteria.`;
    }

    if (role === "Engineer") {
      return `Begin with the narrow technical spine: ingestion path, identity model, API boundary, data store, and observability. Use the final pre-brief assumptions as hypotheses, then validate them before committing to architecture.`;
    }

    if (role === "Executive") {
      return `${customerName} needs a controlled modernization path. The business case is reduced delivery risk, better visibility into cost and reliability, and faster movement on high-value customer-facing work.`;
    }

    if (role === "Sales") {
      return `Lead the follow-up with the outcome they cared about most: ${industryFocus}. Keep it short, confirm what we heard, and propose a focused working session that turns the brief into an implementation plan.`;
    }

    return `This project started as an SA pre-brief for ${customerName}. The final brief, meeting notes, assumptions, risks, and decisions become the source of truth for anyone joining later.`;
  }, [company, industryFocus, role, selectedPillars]);

  const handoffItems = [
    {
      title: "Final brief",
      status: approved ? "Ready" : "Draft",
      detail: `v${briefVersion} with ${feedback.length} refinements`,
    },
    {
      title: "Meeting outcomes",
      status: meetingNotes.length > 80 ? "Captured" : "Needs notes",
      detail: "Objections, decisions, and next steps",
    },
    {
      title: "Project memory",
      status: promoted ? "Live" : "Pending",
      detail: "Brief, notes, risks, actions, and decisions",
    },
    {
      title: "Next artifacts",
      status: promoted ? "Generated" : "Queued",
      detail: "Plan, risk list, exec summary, onboarding",
    },
  ];

  function loadScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
    setCompany(nextScenario.company);
    setIndustry(nextScenario.industry);
    setMeetingType(nextScenario.meetingType);
    setCompanySize(nextScenario.companySize);
    setSelectedPillars(nextScenario.pillars);
    setContext(nextScenario.context);
    setMeetingNotes(nextScenario.meetingNotes);
    setBriefVersion(1);
    setApproved(false);
    setPromoted(false);
  }

  function togglePillar(pillar: string) {
    setSelectedPillars((current) =>
      current.includes(pillar)
        ? current.filter((item) => item !== pillar)
        : [...current, pillar]
    );
  }

  function toggleFeedback(option: string) {
    setFeedback((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  function refineBrief() {
    setBriefVersion((version) => version + 1);
    setApproved(false);
    setPromoted(false);
  }

  function approveBrief() {
    setApproved(true);
    setPromoted(false);
  }

  function promoteProject() {
    setApproved(true);
    setPromoted(true);
  }

  return (
    <main className="app-shell min-h-screen text-[#17201c]">
      <section className="hero-shell">
        <div className="mx-auto max-w-7xl px-5 pt-4">
          <div className="top-command">
            <div className="top-command-title">
              <span className="status-dot" />
              PillarPrep demo console
            </div>
            <div className="top-command-services" aria-label="AWS runtime services">
              {runtimeSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 xl:grid-cols-[1fr_380px] xl:items-stretch">
          <div className="hero-copy">
            <div className="flex items-center gap-4">
              <div className="brand-mark">PP</div>
              <div>
                <p className="eyebrow">AWS Hackathon Product Console</p>
                <h1 className="mt-1 text-3xl font-black text-white sm:text-5xl">
                  PillarPrep
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/74">
              An SA briefing cockpit that turns customer context into a refined
              pre-meeting plan, then promotes the final brief into a living
              project brain for the team that has to execute.
            </p>
            <div className="product-strip" aria-label="Hackathon value signals">
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
          </div>

          <div className="hero-panel">
            <div className="panel-status">
              <span>Live AWS workload concept</span>
              <strong>Hackathon ready</strong>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-[#9fd7c0]">Demo readiness</p>
                <strong className="mt-2 block text-5xl font-black text-white">
                  {readinessScore}
                  <span className="text-2xl text-white/50">%</span>
                </strong>
              </div>
              <span className="hero-pill">
                {promoted ? "Project live" : approved ? "Brief approved" : "In refinement"}
              </span>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-white/58">
                <span>Lifecycle progress</span>
                <span>{lifecycleProgress}%</span>
              </div>
              <div className="hero-progress">
                <span style={{ width: `${lifecycleProgress}%` }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="mini-stat">
                <span>Brief</span>
                <strong>v{briefVersion}</strong>
              </div>
              <div className="mini-stat">
                <span>Pillars</span>
                <strong>{selectedPillars.length}</strong>
              </div>
              <div className="mini-stat">
                <span>Runtime</span>
                <strong>AWS</strong>
              </div>
            </div>
            <div className="telemetry-screen">
              <div className="telemetry-header">
                <span>Live signal profile</span>
                <strong>{company || "Customer"}</strong>
              </div>
              <div className="telemetry-bars">
                {signalMetrics.map((metric) => (
                  <div key={metric.label} className="telemetry-row">
                    <div>
                      <span>{metric.label}</span>
                      <strong>{metric.value}%</strong>
                    </div>
                    <div className="telemetry-bar">
                      <span style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-5">
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

      <section className="mx-auto max-w-7xl px-5 pt-5">
        <div className="spotlight-grid">
          <div className="spotlight-card">
            <span>Customer signal</span>
            <strong>{activeScenario.challenge}</strong>
            <p>{industryFocus}</p>
          </div>
          <div className="spotlight-card spotlight-card-strong">
            <span>AWS value path</span>
            <strong>{primaryConcern}</strong>
            <p>Briefs are mapped to Well-Architected priorities and promoted into delivery context.</p>
          </div>
          <div className="spotlight-card">
            <span>Next best action</span>
            <strong>{promoted ? "Run the project brain" : approved ? "Capture meeting outcomes" : "Refine the pre-brief"}</strong>
            <p>{promoted ? "Generate plans, status summaries, and onboarding answers." : "Turn the customer conversation into reusable team memory."}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-5">
        <div className="demo-grid">
          <div className="demo-panel">
            <div className="section-head">
              <p>Hackathon demo lane</p>
              <h2>90-second story</h2>
            </div>
            <div className="demo-beats">
              {demoBeats.map((beat) => (
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

      <section className="mx-auto max-w-7xl px-5 pt-5">
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

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
            <div className="border-b border-[#e2e7de] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                Demo scenarios
              </p>
              <h2 className="mt-1 text-xl font-black">Pick the story</h2>
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
                <span className="field-label">AWS pillar priorities</span>
                <div className="grid grid-cols-2 gap-2">
                  {pillars.map((pillar) => (
                    <button
                      key={pillar.id}
                      className={cx(
                        "pillar-toggle",
                        selectedPillars.includes(pillar.id) &&
                          "pillar-toggle-active"
                      )}
                      onClick={() => togglePillar(pillar.id)}
                      type="button"
                    >
                      <span className={cx("h-2.5 w-2.5 rounded-full", pillar.color)} />
                      {pillar.short}
                    </button>
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

              <button
                className="primary-button w-full"
                type="button"
                onClick={refineBrief}
              >
                <span className="button-icon">+</span>
                Generate / refine brief
              </button>
            </div>
          </section>
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1fr_280px_1fr]">
              <div className="loop-panel">
                <div className="loop-badge">Loop 1</div>
                <h2 className="text-xl font-black">Pre-brief refinement</h2>
                <p className="mt-2 text-sm leading-6 text-[#536158]">
                  The SA reviews the generated brief, gives targeted feedback,
                  and improves it before the customer conversation.
                </p>
                <div className="mt-5 grid gap-2">
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

              <div className="flex min-h-64 flex-col items-center justify-center border-y border-[#e2e7de] bg-[#f7f9f3] p-5 lg:border-x lg:border-y-0">
                <div className="diagram-core">
                  <div className="diagram-ring">
                    <span>Brief</span>
                    <strong>{approved ? "Approved" : "Draft"}</strong>
                  </div>
                  <div className="diagram-line" />
                  <button
                    className={cx(
                      "promote-button",
                      promoted && "promote-button-done"
                    )}
                    type="button"
                    onClick={promoteProject}
                  >
                    Promote to Project
                  </button>
                </div>
                <p className="mt-4 max-w-48 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#718078]">
                  Final brief becomes project context
                </p>
              </div>

              <div className="loop-panel">
                <div className="loop-badge loop-badge-project">Loop 2</div>
                <h2 className="text-xl font-black">Follow-on project model</h2>
                <p className="mt-2 text-sm leading-6 text-[#536158]">
                  After the meeting, notes and decisions turn the approved
                  brief into a living assistant for delivery and leadership.
                </p>
                <div className="mt-5 grid gap-2">
                  {["Capture notes", "Promote", "Ask", "Update"].map(
                    (step, index) => (
                      <div key={step} className="flow-step project-step">
                        <span>{index + 1}</span>
                        <strong>{step}</strong>
                      </div>
                    )
                  )}
                </div>
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
                      {tab === "gameplan" ? "SA game plan" : tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <div className="brief-surface">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                        {activeTab === "technical"
                          ? "Technical brief"
                          : activeTab === "executive"
                            ? "Executive brief"
                            : activeTab === "gameplan"
                              ? "SA game plan"
                              : "Objection simulator"}
                      </p>
                      <span className="status-pill">
                        {approved ? "Approved" : "Draft"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {briefContent[activeTab].map((item) => (
                        <p key={item} className="brief-line">
                          {item}
                        </p>
                      ))}
                    </div>
                    <div className="evidence-tray">
                      {evidenceSources.map((source) => (
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
                        onClick={refineBrief}
                      >
                        Apply feedback
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
                  <div className="summary-panel">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#527064]">
                      Pillar heatmap
                    </p>
                    <div className="mt-4 space-y-3">
                      {pillars.map((pillar) => (
                        <div key={pillar.id}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold">
                            <span>{pillar.short}</span>
                            <span>{pillar.risk}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#e6ebe1]">
                            <div
                              className={cx(
                                "h-2 rounded-full",
                                selectedPillars.includes(pillar.id)
                                  ? pillar.color
                                  : "bg-[#b8c2b7]"
                              )}
                              style={{ width: riskWidth(pillar.risk) }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="summary-panel">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#527064]">
                      Quality gate
                    </p>
                    <div className="mt-4 space-y-4">
                      {qualityChecks.map((check) => (
                        <div key={check.label}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
                            <span>{check.label}</span>
                            <span>{check.value}%</span>
                          </div>
                          <div className="quality-bar">
                            <span style={{ width: `${check.value}%` }} />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#657269]">
                            {check.detail}
                          </p>
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
                    AWS-native architecture
                  </p>
                  <h2 className="mt-1 text-xl font-black">Backend-ready map</h2>
                </div>
                <div className="p-5">
                  <div className="architecture-map">
                    {[
                      "S3 + CloudFront",
                      "API Gateway",
                      "Lambda",
                      "Bedrock",
                      "Knowledge Base",
                      "DynamoDB",
                      "S3 artifacts",
                      "Guardrails",
                      "CloudWatch",
                    ].map((service, index) => (
                      <div key={service} className="architecture-node">
                        <span>{index + 1}</span>
                        <strong>{service}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#536158]">
                    Bedrock generates the brief, Knowledge Bases ground the
                    Project Brain, S3 stores artifacts, and DynamoDB tracks
                    project state.
                  </p>
                </div>
              </section>

              <section className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
                <div className="border-b border-[#e2e7de] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                    Selected pillar narrative
                  </p>
                  <h2 className="mt-1 text-xl font-black">Why this matters</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {selectedPillarDetails.map((pillar) => (
                    <div key={pillar.id} className="pillar-note">
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

          <section className="rounded-lg border border-[#d8ded2] bg-[#17201c] text-white shadow-sm">
            <div className="grid gap-0 2xl:grid-cols-[380px_1fr]">
              <div className="border-b border-white/10 p-5 2xl:border-b-0 2xl:border-r">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fd7c0]">
                  Loop 2 output
                </p>
                <h2 className="mt-1 text-xl font-black">Project Brain</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Once promoted, the final brief becomes an askable project
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

                    <div className="project-answer">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fd7c0]">
                            Answer for {role}
                          </p>
                          <h3 className="mt-1 text-lg font-black">
                            {activePrompt}
                          </h3>
                        </div>
                        <span
                          className={cx(
                            "project-state",
                            promoted
                              ? "project-state-live"
                              : "project-state-waiting"
                          )}
                        >
                          {promoted ? "Project live" : "Waiting for promotion"}
                        </span>
                      </div>
                      <p className="mt-5 text-base leading-7 text-white/82">
                        {projectAnswer}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      {[
                        "Implementation plan",
                        "Risk list",
                        "Exec summary",
                        "Onboarding answers",
                      ].map((artifact) => (
                        <div key={artifact} className="artifact-tile">
                          <span />
                          <strong>{artifact}</strong>
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
                      onClick={promoteProject}
                    >
                      {promoted
                        ? "Project model updated"
                        : "Promote notes into Project Brain"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
