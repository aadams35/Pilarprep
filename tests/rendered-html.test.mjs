import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  return fetchWorker("/");
}

async function fetchWorker(path, init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
      ...init,
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the PilarPrep console", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.ok((response.headers.get("content-type") ?? "").startsWith("text/html"));

  const html = await response.text();
  assert.match(html, /PilarPrep/);
  assert.match(html, /PilarPrep workspace/);
  assert.match(html, />Context</);
  assert.match(html, />Brief</);
  assert.match(html, />Handoff</);
  assert.match(html, />Demo</);
  assert.match(html, /Build the meeting context/);
  assert.match(html, /Client workspace/);
  assert.match(html, /Generate brief/);
  assert.match(html, /Context in progress/);
  assert.match(html, /Risk-sensitive modernization/);
  assert.match(html, /Generated packet/);
  assert.match(html, /Saved/);
  assert.match(html, /Architecture/);
  assert.doesNotMatch(html, /Ask Project Brain|Ask Project model|Promote to Project|Lifecycle progress|Quality gate|Pillar heatmap|Run Presenter Guide|Demo state|PilarPrep demo console/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("removes the starter preview shell", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Team handoff|Handoff workspace/);
  assert.ok(page.includes("Generate handoff"));
  assert.ok(page.includes("Generate brief + handoff"));
  assert.ok(page.includes("Copy packet"));
  assert.ok(page.includes("Cost posture"));
  assert.match(page, /under 1 USD/);
  assert.ok(page.includes("Amazon CloudFront"));
  assert.match(page, /Short-lived identity|IAM/);
  assert.ok(page.includes("brief-surface-busy"));
  assert.ok(page.includes("const briefContent = isGenerating"));
  assert.ok(page.includes("setGeneratedBrief(null);"));
  assert.ok(page.includes("const displayedProjectAnswer = isGenerating"));
  assert.doesNotMatch(page, /Ask Project Brain|Ask Project model|Promote to Project|Backend-ready map|AWS-native architecture|hero-progress|quality-bar|telemetry-bar|Run Presenter Guide|Demo state|PilarPrep demo console|AWS Product Console|AI-backed AWS workload/);
  assert.ok(layout.includes("PilarPrep | AWS SA Briefing Copilot"));
  assert.ok(layout.includes("product.css"));
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});
test("generates a demo brief through the API contract", async () => {
  const response = await fetchWorker("/api/brief", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
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
          context: "Modernization governance and board visibility.",
        },
      ],
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "demo");
  assert.match(payload.technical.join("\n"), /Apex Mutual/);
  assert.match(payload.technical.join("\n"), /ranked Well-Architected priorities/i);
  assert.match(payload.executive.join("\n"), /auditability/);
  assert.match(payload.stakeholders.join("\n"), /Lena Ortiz/);
  assert.ok(payload.projectArtifacts.twoWeekPlan.length >= 3);
  assert.ok(payload.projectArtifacts.riskRegister.length >= 2);
  assert.match(payload.projectAnswer, /latest brief|two-week sprint|decision log/i);
});

test("generates a role-aware project model answer", async () => {
  const response = await fetchWorker("/api/brief", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "project",
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
      meetingNotes: "CIO approved a pilot if security evidence is clear.",
      decisionMakers: [
        {
          name: "Lena Ortiz",
          title: "CIO",
          source: "Customer-approved profile notes",
          context: "Modernization governance and board visibility.",
        },
      ],
      role: "Sales",
      prompt: "What should we say in the follow-up email?",
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "demo");
  assert.match(payload.projectArtifacts.followUpEmail.subject, /Apex Mutual/);
  assert.match(payload.projectAnswer, /Sales|Lena Ortiz|stakeholder/i);
});

test("rejects incomplete brief API requests", async () => {
  const response = await fetchWorker("/api/brief", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      company: "",
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /company is required/);
});

test("rejects malformed decision maker context", async () => {
  const response = await fetchWorker("/api/brief", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
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
      decisionMakers: "not an array",
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /decisionMakers must be an array/);
});
