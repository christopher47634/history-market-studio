import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("serves the historical-data API before static assets", async () => {
  let calls = 0;
  const env = {
    ASSETS: {
      fetch: async () => {
        calls += 1;
        return new Response("missing", { status: 404 });
      },
    },
  };
  const health = await worker.fetch(
    new Request("https://example.test/api/health"),
    env,
  );
  const healthBody = await health.json();
  assert.equal(health.status, 200);
  assert.equal(healthBody.ok, true);
  assert.ok(healthBody.meta.people >= 150);

  const comparison = await worker.fetch(
    new Request("https://example.test/api/compare?left=liubang&right=xiangyu"),
    env,
  );
  const comparisonBody = await comparison.json();
  assert.equal(comparison.status, 200);
  assert.equal(comparisonBody.pair.left.name, "刘邦");
  assert.equal(comparisonBody.pair.right.name, "项羽");
  assert.ok(comparisonBody.turningPoints.length > 0);
  assert.equal(calls, 0);
});

test("does not turn missing API or write requests into the app shell", async () => {
  let calls = 0;
  const missingApi = await worker.fetch(
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    { ASSETS: { fetch: async () => { calls += 1; return new Response("missing", { status: 404 }); } } },
  );
  assert.equal(missingApi.status, 404);
  assert.equal(calls, 0);

  const write = await worker.fetch(
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => { calls += 1; return new Response("missing", { status: 404 }); } } },
  );
  assert.equal(write.status, 404);
  assert.equal(calls, 1);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));

  const built = await import("../dist/server/index.js");
  const response = await built.default.fetch(
    new Request("https://example.test/api/figures/liubang"),
    { ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.figure.name, "刘邦");
});
