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

test("server-renders the PillarPrep console", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /PillarPrep/);
  assert.match(html, /PillarPrep workspace/);
  assert.match(html, /1\. Context/);
  assert.match(html, /2\. Brief/);
  assert.match(html, /3\. Project/);
  assert.match(html, /Pick a scenario or enter real meeting context/);
  assert.match(html, /Project model/);
  assert.match(html, /Project model/);
  assert.match(html, /Generate AI brief \+ project model|Generate brief \+ project model/);
  assert.match(html, /AWS-ready deployment path/);
  assert.match(html, /Workspace state/);
  assert.match(html, /Ranked discovery/);
  assert.doesNotMatch(html, /Ask Project Brain|Ask Project model|Promote to Project|Lifecycle progress|Quality gate|Pillar heatmap|Run Judge Mode|Demo state|PillarPrep demo console/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("removes the starter preview shell", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Project model/);
  assert.match(page, /Generate project model/);
  assert.match(page, /Generate brief \+ project model/);
  assert.match(page, /Copy packet/);
  assert.match(page, /Cost guardrails/);
  assert.match(page, /under 1 USD per day/);
  assert.match(page, /CloudFront \+ S3/);
  assert.match(page, /IAM signed/);
  assert.match(page, /brief-surface-busy/);
  assert.match(page, /const briefContent = isGenerating/);
  assert.match(page, /setGeneratedBrief\(null\);/);
  assert.match(page, /const displayedProjectAnswer = isGenerating/);
  assert.doesNotMatch(page, /Ask Project Brain|Ask Project model|Promote to Project|Backend-ready map|AWS-native architecture|hero-progress|quality-bar|telemetry-bar|Run Judge Mode|Demo state|PillarPrep demo console/);
  assert.match(layout, /PillarPrep \| AWS SA Briefing Copilot/);
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
