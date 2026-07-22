import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function fetchWorker(path, init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("eval", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
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

function scoreBrief(scenario, brief) {
  let score = 0;
  const notes = [];
  const technicalText = brief.technical.join("\n");
  const executiveText = brief.executive.join("\n");
  const allText = [
    technicalText,
    executiveText,
    brief.stakeholders.join("\n"),
    brief.gameplan.join("\n"),
    brief.objections.join("\n"),
    brief.projectAnswer,
  ].join("\n");

  if (brief.provider) score += 10;
  if (brief.technical.length >= 3) score += 15;
  if (brief.executive.length >= 3) score += 15;
  if (brief.stakeholders.length >= 2) score += 10;
  if (brief.gameplan.length >= 3) score += 15;
  if (brief.objections.length >= 3) score += 10;
  if (brief.citations.length >= 3) score += 10;
  if (allText.includes(scenario.company)) score += 10;
  if (scenario.decisionMakers?.some((person) => allText.includes(person.name))) {
    score += 10;
  }
  if (/Bedrock|Knowledge Bases|Well-Architected/.test(technicalText)) score += 10;

  if (/API Gateway|Lambda|DynamoDB|CloudWatch/.test(executiveText)) {
    notes.push("Executive brief contains service-level jargon.");
  } else {
    score += 5;
  }

  return { score, notes };
}

const scenarios = JSON.parse(
  await readFile(new URL("../data/demo-scenarios.json", import.meta.url), "utf8"),
);

const results = [];

for (const scenario of scenarios) {
  const response = await fetchWorker("/api/brief", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "prebrief",
      ...scenario,
    }),
  });

  assert.equal(response.status, 200, `${scenario.id} API request failed`);
  const brief = await response.json();
  const result = scoreBrief(scenario, brief);
  results.push({ scenario: scenario.id, ...result });
  assert.ok(result.score >= 80, `${scenario.id} score too low: ${result.score}`);
}

const projectResponse = await fetchWorker("/api/brief", {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    mode: "project",
    role: "PM",
    prompt: "Create the first two-week plan.",
    ...scenarios[0],
  }),
});

assert.equal(projectResponse.status, 200, "project mode API request failed");
const projectBrief = await projectResponse.json();
assert.match(projectBrief.projectAnswer, /two-week sprint/i);
assert.match(projectBrief.projectAnswer, /PM|project team/i);

console.table(results);
console.log("Brief quality eval passed.");
