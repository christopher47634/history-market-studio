import {
  buildComparison,
  figureById,
  figures,
  getPairColors,
  getTurningPoints,
} from "../data.js";
import { getCandleView } from "../marketEngine.js";
import { getPeerFigures, getRankings, RANKING_METRICS } from "./analytics.js";

const VERSION = "2026.08.04";
const totalEvents = figures.reduce(
  (sum, figure) => sum + figure.events.length,
  0,
);
const DATA_LOADED_AT = new Date().toISOString();
const CATALOG_ETAG = `W/"history-${VERSION}-${figures.length}-${totalEvents}"`;

const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

const headers = {
  ...baseHeaders,
  "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
  etag: CATALOG_ETAG,
};

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers:
      status >= 400
        ? { ...baseHeaders, "cache-control": "no-store", ...extraHeaders }
        : { ...headers, ...extraHeaders },
  });

const stripWeakPrefix = (tag) => tag.replace(/^W\//i, "");

const matchesIfNoneMatch = (headerValue, etag) => {
  if (!headerValue) return false;
  const target = stripWeakPrefix(etag);
  return headerValue
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => token === "*" || stripWeakPrefix(token) === target);
};

const respondCacheable = (request, bodyOrFactory, extraHeaders = {}) => {
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), CATALOG_ETAG)) {
    return new Response(null, { status: 304, headers: { ...headers, ...extraHeaders } });
  }
  const body = typeof bodyOrFactory === "function" ? bodyOrFactory() : bodyOrFactory;
  return json(body, 200, extraHeaders);
};

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

const SEARCH_INDEX = figures.map((figure) => ({
  figure,
  searchText: searchableText(figure),
  period: normalizeText(figure.period),
  dynasty: normalizeText(figure.dynasty),
  domain: normalizeText(figure.domain),
}));

const summarizeFacet = (key) =>
  Object.entries(
    figures.reduce((counts, figure) => {
      const value = figure[key] || "未分类";
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {}),
  )
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "zh-CN"));

const INDEX_FACETS = {
  periods: summarizeFacet("period"),
  dynasties: summarizeFacet("dynasty"),
  domains: summarizeFacet("domain"),
};

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
    return respondCacheable(request, () => {
      const query = normalizeText(url.searchParams.get("q"));
      const period = normalizeText(url.searchParams.get("period"));
      const dynasty = normalizeText(url.searchParams.get("dynasty"));
      const domain = normalizeText(url.searchParams.get("domain"));
      const filtered = SEARCH_INDEX.filter(
        (entry) =>
          (!query || entry.searchText.includes(query)) &&
          (!period || entry.period === period) &&
          (!dynasty || entry.dynasty === dynasty) &&
          (!domain || entry.domain === domain),
      ).map((entry) => entry.figure);
      const page = filtered.slice(offset, offset + limit);
      return {
        meta: apiMeta(),
        page: {
          total: filtered.length,
          returned: page.length,
          offset,
          limit,
          hasMore: offset + page.length < filtered.length,
        },
        figures: compact ? page.map(compactFigure) : page,
      };
    });
  }

  if (url.pathname === "/api/index") {
    return respondCacheable(request, () => ({
      meta: apiMeta(),
      facets: INDEX_FACETS,
    }));
  }

  if (url.pathname === "/api/rankings") {
    const metric = url.searchParams.get("metric") || "peak";
    const order = url.searchParams.get("order") || "desc";
    if (!RANKING_METRICS.includes(metric)) {
      return json(
        {
          error: "invalid_metric",
          message: `metric must be one of: ${RANKING_METRICS.join(", ")}`,
        },
        400,
      );
    }
    if (!["asc", "desc"].includes(order)) {
      return json({ error: "invalid_order", message: "order must be asc or desc" }, 400);
    }
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, figures.length);
    const limit = boundedInteger(url.searchParams.get("limit"), 20, 1, figures.length);
    if (offset === null || limit === null) {
      return json(
        {
          error: "invalid_pagination",
          message: `offset must be 0—${figures.length}; limit must be 1—${figures.length}`,
        },
        400,
      );
    }
    return respondCacheable(request, () => ({
      meta: apiMeta(),
      ...getRankings({
        metric,
        order,
        domain: url.searchParams.get("domain") || "",
        period: url.searchParams.get("period") || "",
        dynasty: url.searchParams.get("dynasty") || "",
        offset,
        limit,
      }),
    }));
  }

  if (url.pathname.startsWith("/api/figures/") && url.pathname.endsWith("/peers")) {
    const rawId = url.pathname.slice("/api/figures/".length, -"/peers".length);
    let id;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      return json({ error: "invalid_figure_id" }, 400);
    }
    if (!figureById[id]) {
      return json({ error: "figure_not_found", id }, 404);
    }
    const limit = boundedInteger(url.searchParams.get("limit"), 5, 1, 20);
    if (limit === null) {
      return json({ error: "invalid_limit", message: "limit must be 1—20" }, 400);
    }
    const crossDynasty = url.searchParams.get("crossDynasty") === "1";
    return respondCacheable(request, () => ({
      meta: apiMeta(),
      ...getPeerFigures(id, { limit, crossDynasty }),
    }));
  }

  if (url.pathname.startsWith("/api/figures/")) {
    let id;
    try {
      id = decodeURIComponent(url.pathname.slice("/api/figures/".length));
    } catch {
      return json({ error: "invalid_figure_id" }, 400);
    }
    const figure = figureById[id];
    if (!figure) {
      return json({ error: "figure_not_found", id }, 404);
    }
    return respondCacheable(request, () => ({ meta: apiMeta(), figure }));
  }

  if (url.pathname === "/api/compare") {
    const pair = getPair(url);
    if (!pair) {
      return json(
        { error: "invalid_pair", message: "left/right must be two different known figure ids" },
        400,
      );
    }
    return respondCacheable(
      request,
      () => {
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
        return response;
      },
      { "cache-control": "public, max-age=300, s-maxage=3600" },
    );
  }

  return json({ error: "api_route_not_found" }, 404, { "cache-control": "no-store" });
}
