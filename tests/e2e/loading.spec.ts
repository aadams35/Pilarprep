import { expect, test, type Page } from "@playwright/test";

const businessCase = Object.fromEntries(
  [
    "scenario",
    "whyNow",
    "currentSituation",
    "desiredOutcomes",
    "successCriteria",
    "businessRisks",
    "decisionRequired",
    "inScope",
    "outOfScope",
    "assumptionsAndUnknowns",
    "stakeholderAlignment",
    "alignmentStatement",
    "nextStepGuidance",
  ].map((key) => [
    key,
    `Apex Mutual ${key} is grounded in approved customer context, named owners, measurable evidence, and a bounded next decision.`,
  ])
);

const completedBrief = {
  provider: "bedrock",
  generatedAt: "2026-08-13T12:00:00.000Z",
  businessCase,
  technical: Array.from(
    { length: 4 },
    (_, index) =>
      `Technical passage ${index + 1} validates architecture evidence, ownership, constraints, and the next decision. Ask: "Which proof is required?"`
  ),
  executive: Array.from(
    { length: 4 },
    (_, index) =>
      `Executive passage ${index + 1} connects customer value, urgency, measurable outcomes, and sponsor confidence. Ask: "What outcome matters?"`
  ),
  stakeholders: Array.from(
    { length: 4 },
    (_, index) =>
      `Stakeholder passage ${index + 1} confirms influence, evidence, ownership, and approval criteria. Ask: "Who decides?"`
  ),
  gameplan: Array.from(
    { length: 4 },
    (_, index) =>
      `Game plan passage ${index + 1} sequences discovery, evidence review, readback, and the decision gate. Ask: "What happens next?"`
  ),
  objections: Array.from(
    { length: 4 },
    (_, index) =>
      `Concern ${index + 1}: evidence is incomplete. Response: use a bounded validation step with a named owner. Ask: "What proof resolves this?"`
  ),
  projectAnswer:
    "Use the approved packet as the shared handoff, validate assumptions, assign evidence owners, and schedule the next decision checkpoint.",
  projectArtifacts: {
    twoWeekPlan: [],
    riskRegister: [],
    stakeholderMap: [],
    followUpEmail: { subject: "", body: "" },
    nextSteps: {
      immediateActions: [],
      openQuestions: [],
      nextMeeting: { purpose: "", timing: "", attendees: [] },
      customerSummary: "",
      internalNotes: "",
    },
  },
  citations: ["Customer context"],
  evidence: [],
  metadata: {
    projectId: "apex-mutual",
    clientId: "apex-mutual",
    packetVersion: 1,
    modelId: "us.amazon.nova-pro-v1:0",
    modelTier: "nova-pro",
    requestedModelTier: "nova-pro",
    fallbackUsed: false,
    latencyMs: 1200,
    estimatedCostUsd: 0.01,
    artifactRetention: "latest-only",
  },
};

async function mockCognito(page: Page) {
  await page.route("https://cognito-identity.us-east-1.amazonaws.com/**", async (route) => {
    const target = route.request().headers()["x-amz-target"] ?? "";
    const body = target.endsWith("GetId")
      ? { IdentityId: "us-east-1:test-identity" }
      : {
          IdentityId: "us-east-1:test-identity",
          Credentials: {
            AccessKeyId: "ASIAPILARPREPTEST",
            SecretKey: "test-secret-key-for-browser-signing-only",
            SessionToken: "test-session-token",
            Expiration: Math.floor(Date.now() / 1000) + 3600,
          },
        };
    await route.fulfill({
      status: 200,
      contentType: "application/x-amz-json-1.1",
      body: JSON.stringify(body),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const entries: number[] = [];
    Object.defineProperty(window, "__pilarprepLongTasks", {
      value: entries,
      configurable: true,
    });
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) entries.push(entry.duration);
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Long-task entries are optional browser diagnostics.
      }
    }
  });
  await mockCognito(page);
});

test("live job keeps the workspace responsive with an in-app clock", async ({ page }) => {
  let postCount = 0;
  let pollCount = 0;
  await page.route("https://test.execute-api.us-east-1.amazonaws.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path === "/clients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ clients: [] }),
      });
      return;
    }
    if (route.request().method() === "POST") {
      postCount += 1;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-0001",
          clientId: "apex-mutual",
          projectId: "apex-mutual",
          status: "queued",
          pollAfterMs: 750,
        }),
      });
      return;
    }

    pollCount += 1;
    const status = pollCount < 3 ? "queued" : pollCount < 6 ? "running" : "complete";
    await route.fulfill({
      status: status === "complete" ? 200 : 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "job-0001",
        clientId: "apex-mutual",
        projectId: "apex-mutual",
        status,
        pollAfterMs: 750,
        result: status === "complete" ? completedBrief : undefined,
      }),
    });
  });

  await page.goto("/");
  const generate = page.getByRole("button", {
    name: /Generate AI prebrief/i,
  });
  const duplicateSubmit = page.locator(".workspace-context-action button").last();
  const workspace = page.locator("main");
  const pageView = page.locator(".page-view");
  const workflowNavigation = page.getByRole("navigation", {
    name: "Customer lifecycle",
  });
  const briefNavigation = workflowNavigation.getByRole("button", {
    name: /Refine/,
  });

  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(duplicateSubmit).toBeDisabled();
  await expect(workspace).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Waiting for generation")).toBeVisible();
  await expect(briefNavigation).toBeDisabled();
  const processingIndicator = page.locator(".processing-indicator").first();
  await expect(processingIndicator).toBeVisible();
  await expect(processingIndicator.locator(".processing-clock")).toBeVisible();
  await expect
    .poll(() => pageView.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe("wait");
  await expect
    .poll(() => pageView.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe("progress");

  const shellLayout = await page.evaluate(() => {
    const root = document.scrollingElement;
    const briefPane = document.querySelector(".brief-surface");
    return {
      rootVerticalOverflow: root ? root.scrollHeight - window.innerHeight : 0,
      rootHorizontalOverflow: root ? root.scrollWidth - window.innerWidth : 0,
      briefOverflowStyle: briefPane ? getComputedStyle(briefPane).overflowY : "",
      pageY: window.scrollY,
    };
  });
  expect(shellLayout.rootVerticalOverflow).toBeGreaterThan(0);
  expect(shellLayout.rootHorizontalOverflow).toBeLessThanOrEqual(2);
  expect(shellLayout.briefOverflowStyle).toBe("visible");
  expect(shellLayout.pageY).toBeGreaterThanOrEqual(0);

  await expect(workspace).toHaveAttribute("aria-busy", "false", {
    timeout: 10_000,
  });
  await expect(briefNavigation).toBeEnabled();
  await expect(duplicateSubmit).toBeEnabled();
  await expect
    .poll(() => pageView.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe("wait");
  expect(postCount).toBe(1);
  expect(pollCount).toBe(6);

  const longestTask = await page.evaluate(
    () =>
      Math.max(
        0,
        ...((window as typeof window & { __pilarprepLongTasks?: number[] })
          .__pilarprepLongTasks ?? [])
      )
  );
  expect(longestTask).toBeLessThan(250);
});

test("navigation aborts a running poll and immediately restores interaction", async ({ page }) => {
  let pollCount = 0;
  await page.route("https://test.execute-api.us-east-1.amazonaws.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path === "/clients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ clients: [] }),
      });
      return;
    }
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-0002",
          clientId: "apex-mutual",
          projectId: "apex-mutual",
          status: "queued",
          pollAfterMs: 750,
        }),
      });
      return;
    }
    pollCount += 1;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "job-0002",
        clientId: "apex-mutual",
        projectId: "apex-mutual",
        status: "running",
        pollAfterMs: 750,
      }),
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: /Generate AI prebrief/i })
    .click();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");

  await page
    .getByRole("button", { name: "Open catch-up workspace" })
    .click();

  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByText("Get a new teammate up to speed")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".page-view").evaluate((element) => getComputedStyle(element).cursor)
    )
    .not.toBe("wait");
  expect(pollCount).toBeLessThanOrEqual(1);
});
