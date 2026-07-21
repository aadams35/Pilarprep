"use client";

import { useMemo, useState } from "react";

type BriefTab = "technical" | "executive" | "gameplan";
type AudienceRole = "Sales" | "Executive" | "PM" | "Engineer" | "New member";

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

const pillars = [
  {
    id: "Operational Excellence",
    short: "Ops",
    tone: "Improve operating rhythm and measurable ownership.",
    risk: "Medium",
    color: "bg-cyan-500",
  },
  {
    id: "Security",
    short: "Security",
    tone: "Protect identities, data, and customer trust.",
    risk: "High",
    color: "bg-red-500",
  },
  {
    id: "Reliability",
    short: "Reliability",
    tone: "Recover quickly and reduce customer-facing disruption.",
    risk: "High",
    color: "bg-amber-500",
  },
  {
    id: "Performance Efficiency",
    short: "Performance",
    tone: "Keep latency low while demand changes.",
    risk: "Medium",
    color: "bg-blue-500",
  },
  {
    id: "Cost Optimization",
    short: "Cost",
    tone: "Connect spend to outcomes and unit economics.",
    risk: "High",
    color: "bg-emerald-500",
  },
  {
    id: "Sustainability",
    short: "Sustainability",
    tone: "Right-size resources and reduce waste.",
    risk: "Low",
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const [company, setCompany] = useState("Apex Mutual");
  const [industry, setIndustry] = useState("Financial Services");
  const [meetingType, setMeetingType] = useState("Executive Briefing");
  const [companySize, setCompanySize] = useState("Enterprise");
  const [selectedPillars, setSelectedPillars] = useState([
    "Security",
    "Reliability",
    "Cost Optimization",
  ]);
  const [context, setContext] = useState(
    "Customer is modernizing a customer portal, worried about compliance, and wants a clearer migration path without disrupting peak business periods."
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

  const briefContent = useMemo(
    () => ({
      technical: [
        `${company || "The customer"} likely needs a secure landing zone, governed identity model, observable application path, and migration pattern that reduces production risk.`,
        `Discovery should validate current architecture, data classification, RTO/RPO, incident response, network dependencies, and ownership across ${companySize.toLowerCase()} teams.`,
        "Reference AWS services: Amazon Bedrock, Amazon S3, AWS Lambda, Amazon API Gateway, Amazon CloudWatch, AWS WAF, AWS IAM Identity Center, Amazon DynamoDB, and AWS Well-Architected Tool.",
      ],
      executive: [
        `${company || "The customer"} is balancing modernization speed with risk control. The conversation should stay centered on ${industryFocus}.`,
        "Position AWS as a way to improve decision quality, reduce operational drag, and make progress measurable without forcing a risky all-at-once transformation.",
        "Avoid service-first language. Lead with outcomes: faster launch cycles, clearer accountability, lower business interruption risk, and cost visibility.",
      ],
      gameplan: [
        "Open by confirming the business event driving urgency, then map technical unknowns to business impact.",
        `Spend the first half on ${selectedPillars.join(", ").toLowerCase()} and use the final ten minutes to agree on success measures and next steps.`,
        "Close with a concise handoff: confirmed goals, known risks, unanswered questions, owners, and whether the brief should be promoted into a project workspace.",
      ],
    }),
    [company, companySize, industryFocus, selectedPillars]
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
    <main className="min-h-screen bg-[#f5f7f2] text-[#17201c]">
      <section className="border-b border-[#d8ded2] bg-[#fbfcf8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-[#263a33] bg-[#17201c] text-sm font-black text-white">
              PP
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#527064]">
                AWS Hackathon Product Console
              </p>
              <h1 className="text-2xl font-black tracking-tight text-[#17201c] sm:text-3xl">
                PillarPrep
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#d8ded2] bg-white p-2 text-center shadow-sm">
            <div className="px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-[#6f7c73]">
                Brief
              </p>
              <p className="text-sm font-black">v{briefVersion}</p>
            </div>
            <div className="border-x border-[#e2e7de] px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-[#6f7c73]">
                Stage
              </p>
              <p className="text-sm font-black">
                {promoted ? "Project" : approved ? "Approved" : "Refine"}
              </p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-[#6f7c73]">
                Model
              </p>
              <p className="text-sm font-black">Bedrock</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[380px_1fr]">
        <aside className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
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

            <button className="primary-button w-full" type="button" onClick={refineBrief}>
              <span className="button-icon">+</span>
              Generate / refine brief
            </button>
          </div>
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
                  {["Generate", "Review", "Refine", "Approve"].map((step, index) => (
                    <div key={step} className="flow-step">
                      <span>{index + 1}</span>
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex min-h-64 flex-col items-center justify-center border-y border-[#e2e7de] bg-[#f7f9f3] p-5 lg:border-x lg:border-y-0">
                <div className="diagram-core">
                  <div className="diagram-ring">Brief</div>
                  <div className="diagram-line" />
                  <button
                    className={cx("promote-button", promoted && "promote-button-done")}
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

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#e2e7de] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                    Final pre-brief workspace
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {company || "Customer"} {meetingType}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["technical", "executive", "gameplan"] as BriefTab[]).map(
                    (tab) => (
                      <button
                        key={tab}
                        className={cx("tab-button", activeTab === tab && "tab-active")}
                        onClick={() => setActiveTab(tab)}
                        type="button"
                      >
                        {tab === "gameplan" ? "SA game plan" : tab}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
                <div className="space-y-4">
                  <div className="brief-surface">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                        {activeTab === "technical"
                          ? "Technical brief"
                          : activeTab === "executive"
                            ? "Executive brief"
                            : "SA game plan"}
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
                              style={{
                                width:
                                  pillar.risk === "High"
                                    ? "88%"
                                    : pillar.risk === "Medium"
                                      ? "62%"
                                      : "34%",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className={cx("approval-button", approved && "approval-done")}
                    type="button"
                    onClick={approveBrief}
                  >
                    {approved ? "Brief approved" : "Approve final pre-brief"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#d8ded2] bg-white shadow-sm">
              <div className="border-b border-[#e2e7de] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527064]">
                  AWS-native architecture
                </p>
                <h2 className="mt-1 text-xl font-black">Backend-ready map</h2>
              </div>
              <div className="p-5">
                <div className="architecture-map">
                  {[
                    "React",
                    "API Gateway",
                    "Lambda",
                    "Bedrock",
                    "Knowledge Base",
                    "S3 + DynamoDB",
                    "Guardrails",
                  ].map((service, index) => (
                    <div key={service} className="architecture-node">
                      <span>{index + 1}</span>
                      <strong>{service}</strong>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[#536158]">
                  The front end is ready for the hackathon path: Bedrock
                  generates the brief, Knowledge Bases ground the Project
                  Brain, S3 stores artifacts, and DynamoDB tracks project state.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d8ded2] bg-[#17201c] text-white shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[380px_1fr]">
              <div className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
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
                      className={cx("role-button", role === item && "role-active")}
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
                      <h3 className="mt-1 text-lg font-black">{activePrompt}</h3>
                    </div>
                    <span
                      className={cx(
                        "project-state",
                        promoted ? "project-state-live" : "project-state-waiting"
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
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
