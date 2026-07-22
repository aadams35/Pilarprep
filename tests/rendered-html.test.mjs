import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
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
  assert.match(html, /PillarPrep demo console/);
  assert.match(html, /Pre-brief refinement/);
  assert.match(html, /Follow-on project model/);
  assert.match(html, /Project Brain/);
  assert.match(html, /AWS-ready deployment path/);
  assert.match(html, /AWS-native architecture/);
  assert.match(html, /AWS run path/);
  assert.match(html, /S3 \+ CloudFront/);
  assert.match(html, /Live signal profile/);
  assert.match(html, /Implementation queue/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("removes the starter preview shell", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Project Brain/);
  assert.match(page, /Promote to Project/);
  assert.match(layout, /PillarPrep \| AWS SA Briefing Copilot/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});
