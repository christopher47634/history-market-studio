import {
  buildComparison,
  figureById,
  figures,
  getPairColors,
  getTurningPoints,
} from "../data.js";
import { getCandleView } from "../marketEngine.js";

const VERSION = "2026.08.04";
const totalEvents = figures.reduce(
  (sum, figure) => sum + figure.events.length,
  0,
);
const DATA_LOADED_AT = new Date().toISOString();
const CATALOG_ETAG = `W/"history-${VERSION}-${figures.length}-${totalEvents}"`;

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
  "x-content-type-options": "nosniff",
  etag: CATALOG_ETAG,
};

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, ...extraHeaders },
  });

const compactFigure = (figure) => ({
  id: figure.id,
  name: figure.name,
  courtesy: figure.courtesy,
  dynasty: figure.dynasty,
  era: figure.era,
  period: figure.period,
  domain: figure.domain,
  born: figure.born,
  died: figure.died,
  lifeSpan: figure.lifeSpan,
  color: figure.color,
  thesis: figure.thesis,
  metrics: figure.metrics,
  eventCount: figure.events.length,
  dateCertainty: figure.dateCertainty,
  provenance: figure.provenance,
  sources: figure.sources,
});

const apiMeta = () => ({
  version: VERSION,
  people: figures.length,
  events: totalEvents,
  generatedAt: DATA_LOADED_AT,
  axis: "actual-age",
  model: "source-backed-legacy-aware-potential-v2",
  sourceModel: "primary-or-institutional-plus-subject-reference",
  scoreNature: "interpretive-model-not-historical-fact",
  terminalRetentionFloor: 0.8,
  deathResetsToZero: false,
  qualityGates: {
    sourceIndexesReachable: 61,
    subjectPagesResolved: figures.length,
    checkedAt: "2026-08-04",
  },
});

const normalizeText = (value) =>
  String(value || "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN");

const searchableText = (figure) =>
  normalizeText(
    [
      figure.name,
      figure.courtesy,
      figure.dynasty,
      figure.era,
      figure.period,
      figure.domain,
      figure.thesis,
      ...figure.events.flatMap((event) => [event.title, event.summary]),
    ].join(" "),
  );

const boundedInteger = (value, fallback, min, max) => {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
};

function getPair(url) {
  const left = figureById[url.searchParams.get("left") || "liubang"];
  const right = figureById[url.searchParams.get("right") || "xiangyu"];
  if (!left || !right || left.id === right.id) return null;
  return { left, right };
}

export async function handleHistoryApi(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, HEAD, OPTIONS",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "Content-Type, Accept",
      },
    });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return json({ error: "method_not_allowed" }, 405, { allow: "GET, HEAD, OPTIONS" });
  }

  if (
    request.method === "GET" &&
    url.pathname !== "/api/health" &&
    request.headers.get("if-none-match") === CATALOG_ETAG
  ) {
    return new Response(null, { status: 304, headers });
  }

  if (url.pathname === "/api/health") {
    return json({ ok: true, meta: apiMeta() }, 200, { "cache-control": "no-store" });
  }

  if (url.pathname === "/api/figures") {
    const compact = url.searchParams.get("compact") === "1";
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, figures.length);
    const limit = boundedInteger(
      url.searchParams.get("limit"),
      figures.length,
      1,
      figures.length,
    );
    if (offset === null || limit === null) {
      return json(
        {
          error: "invalid_pagination",
          message: `offset must be 0—${figures.length}; limit must be 1—${figures.length}`,
        },
        400,
      );
    }
    const query = normalizeText(url.searchParams.get("q"));
    const period = normalizeText(url.searchParams.get("period"));
    const dynasty = normalizeText(url.searchParams.get("dynasty"));
    const domain = normalizeText(url.searchParams.get("domain"));
    const filtered = figures.filter(
      (figure) =>
        (!query || searchableText(figure).includes(query)) &&
        (!period || normalizeText(figure.period) === period) &&
        (!dynasty || normalizeText(figure.dynasty) === dynasty) &&
        (!domain || normalizeText(figure.domain) === domain),
    );
    const page = filtered.slice(offset, offset + limit);
    return json({
      meta: apiMeta(),
      page: {
        total: filtered.length,
        returned: page.length,
        offset,
        limit,
        hasMore: offset + page.length < filtered.length,
      },
      figures: compact ? page.map(compactFigure) : page,
    });
  }

  if (url.pathname === "/api/index") {
    const summarize = (key) =>
      Object.entries(
        figures.reduce((counts, figure) => {
          const value = figure[key] || "未分类";
          counts[value] = (counts[value] || 0) + 1;
          return counts;
        }, {}),
      )
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "zh-CN"));
    return json({
      meta: apiMeta(),
      facets: {
        periods: summarize("period"),
        dynasties: summarize("dynasty"),
        domains: summarize("domain"),
      },
    });
  }

  if (url.pathname.startsWith("/api/figures/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/figures/".length));
    const figure = figureById[id];
    return figure
      ? json({ meta: apiMeta(), figure })
      : json({ error: "figure_not_found", id }, 404);
  }

  if (url.pathname === "/api/compare") {
    const pair = getPair(url);
    if (!pair) {
      return json(
        { error: "invalid_pair", message: "left/right must be two different known figure ids" },
        400,
      );
    }
    const comparison = buildComparison(pair.left, pair.right);
    const response = {
      meta: apiMeta(),
      pair: {
        left: compactFigure(pair.left),
        right: compactFigure(pair.right),
      },
      colors: getPairColors(pair.left, pair.right),
      comparison,
      turningPoints: getTurningPoints(comparison, pair.left, pair.right),
    };
    if (url.searchParams.get("candles") === "1") {
      const target = url.searchParams.get("target") === pair.right.id
        ? pair.right
        : pair.left;
      const span = Math.max(
        7,
        Math.min(100, Number(url.searchParams.get("span")) || 100),
      );
      response.candles = {
        figure: compactFigure(target),
        ...getCandleView(target, span),
      };
    }
    return json(response, 200, { "cache-control": "public, max-age=300, s-maxage=3600" });
  }

  return json({ error: "api_route_not_found" }, 404, { "cache-control": "no-store" });
}
