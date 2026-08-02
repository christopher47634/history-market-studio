import { handleHistoryApi } from "../src/server/historyApi.js";

const secure = (response) => {
  const secured = new Response(response.body, response);
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("x-frame-options", "SAMEORIGIN");
  secured.headers.set(
    "content-security-policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  );
  return secured;
};

export default {
  async fetch(request, env) {
    const apiResponse = await handleHistoryApi(request);
    if (apiResponse) return secure(apiResponse);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return secure(response);
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return secure(await env.ASSETS.fetch(new Request(indexUrl, request)));
  },
};
