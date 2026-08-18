import { mkdir, writeFile } from "node:fs/promises";
import { setDefaultResultOrder } from "node:dns";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { figures } from "../src/data.js";

setDefaultResultOrder("ipv4first");

const timeoutMs = 15_000;
const headers = {
  "user-agent": "HistoryMarketStudioSourceAudit/1.0 (local quality assurance)",
};
const execFileAsync = promisify(execFile);

async function requestViaPowerShell(url, method) {
  const command =
    "$ProgressPreference='SilentlyContinue'; " +
    "$target=$env:HISTORY_AUDIT_URL; $verb=$env:HISTORY_AUDIT_METHOD; " +
    "try {$r=Invoke-WebRequest -UseBasicParsing -Uri $target -Method $verb -TimeoutSec 30; $status=[int]$r.StatusCode; $final=$r.BaseResponse.ResponseUri.AbsoluteUri; $content=$r.Content} " +
    "catch {$status=[int]$_.Exception.Response.StatusCode.value__; $final=$target; $content=''}; " +
    "[pscustomobject]@{status=$status;url=$final;content=$content}|ConvertTo-Json -Compress -Depth 3";
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    {
      env: {
        ...process.env,
        HISTORY_AUDIT_URL: url,
        HISTORY_AUDIT_METHOD: method,
      },
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const payload = JSON.parse(stdout.trim());
  return {
    ok: payload.status >= 200 && payload.status < 400,
    status: payload.status,
    url: payload.url || url,
    json: async () => JSON.parse(payload.content),
  };
}

const chunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

async function request(url, method = "HEAD", attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      if (process.platform === "win32")
        return requestViaPowerShell(url, method);
      if (attempt < attempts - 1)
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function verifyUrl(url) {
  const startedAt = performance.now();
  try {
    let response = await request(url, "HEAD");
    if ([403, 405].includes(response.status)) response = await request(url, "GET");
    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      error: error.name === "AbortError" ? "timeout" : error.message,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

async function verifyPrimarySources(urls, concurrency = 8) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (cursor < urls.length) {
        const index = cursor++;
        results[index] = await verifyUrl(urls[index]);
      }
    }),
  );
  return results;
}

async function verifyWikipediaSubjects(subjects) {
  const results = [];
  for (const batch of chunks(subjects, 40)) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      titles: batch.map((item) => item.title).join("|"),
    });
    const response = await request(
      `https://zh.wikipedia.org/w/api.php?${params.toString()}`,
      "GET",
    );
    if (!response.ok)
      throw new Error(`Wikipedia API returned ${response.status}`);
    const payload = await response.json();
    const normalized = new Map(
      (payload.query?.normalized || []).map((item) => [item.from, item.to]),
    );
    const redirects = new Map(
      (payload.query?.redirects || []).map((item) => [item.from, item.to]),
    );
    const pages = new Map(
      (payload.query?.pages || []).map((page) => [page.title, page]),
    );
    for (const subject of batch) {
      const normalizedName = normalized.get(subject.title) || subject.title;
      const resolvedName = redirects.get(normalizedName) || normalizedName;
      const page = pages.get(resolvedName);
      results.push({
        name: subject.name,
        requestedTitle: subject.title,
        resolvedName,
        ok: Boolean(page && !page.missing),
        pageId: page?.pageid || null,
      });
    }
  }
  return results;
}

const sourceMap = new Map();
for (const figure of figures) {
  for (const source of figure.sources || []) {
    if (source.type === "secondary" || !source.url) continue;
    if (!sourceMap.has(source.url))
      sourceMap.set(source.url, {
        url: source.url,
        label: source.label,
        type: source.type,
      });
  }
}

const [sourceChecks, subjectChecks] = await Promise.all([
  verifyPrimarySources([...sourceMap.keys()]),
  verifyWikipediaSubjects(
    figures.map((figure) => {
      const source = figure.sources.find(
        (item) => item.type === "secondary" && item.scope === "subject",
      );
      const title = source
        ? decodeURIComponent(new URL(source.url).pathname.split("/").pop())
        : figure.name;
      return { name: figure.name, title };
    }),
  ),
]);
const sourceResults = sourceChecks.map((result) => ({
  ...sourceMap.get(result.url),
  ...result,
}));
const failedSources = sourceResults.filter((item) => !item.ok);
const missingSubjects = subjectChecks.filter((item) => !item.ok);
const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    figures: figures.length,
    uniquePrimaryOrInstitutionalSources: sourceResults.length,
    reachableSources: sourceResults.length - failedSources.length,
    subjectPages: subjectChecks.length,
    resolvedSubjectPages: subjectChecks.length - missingSubjects.length,
  },
  failedSources,
  missingSubjects,
  sourceResults,
  subjectChecks,
};

await mkdir(new URL("../output/audits/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../output/audits/source-link-audit.json", import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log(
  `Source audit: ${report.totals.reachableSources}/${report.totals.uniquePrimaryOrInstitutionalSources} source indexes reachable; ` +
    `${report.totals.resolvedSubjectPages}/${report.totals.subjectPages} subject pages resolved.`,
);
if (failedSources.length || missingSubjects.length) {
  console.error(JSON.stringify({ failedSources, missingSubjects }, null, 2));
  process.exitCode = 1;
}
