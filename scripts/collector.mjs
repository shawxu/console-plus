import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4173);
const received = [];

/** 纯静态页面（file:// 或本地域）跨域提交，必须允许任意 Origin 与预检。 */
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

/** 回显 Origin 比固定 * 更兼容 Chrome 的 Private Network Access 预检。 */
function corsHeaders(req) {
  return {
    ...CORS,
    "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    Vary: "Origin",
  };
}

function json(req, res, status, payload) {
  const headers = { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) };
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/__collect") {
    return json(req, res, 404, { error: "collector only serves /__collect" });
  }

  const origin = req.headers.origin ?? null;
  if (req.method === "GET") {
    return json(req, res, 200, {
      count: received.length,
      items: received.slice(-10),
      origin,
    });
  }
  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    received.push({
      at: new Date().toISOString(),
      bytes: body.length,
      preview: body.slice(0, 500),
      origin,
    });
    console.log(
      `[collect] +1 (${body.length} bytes) origin=${origin ?? "unknown"}, total=${received.length}`,
    );
    const failed = url.searchParams.get("fail") === "1";
    return json(
      req,
      res,
      200,
      failed ? { code: 500, msg: "simulated failure" } : { code: 0, msg: "ok" },
    );
  }
  return json(req, res, 405, { error: "method not allowed" });
});

server.listen(PORT, () => {
  console.log(`collector (CORS echo Origin) → http://127.0.0.1:${PORT}/__collect`);
  console.log(
    `static page                  → 直接打开 tests/browser/index.html，或在 VS Code 按 F5`,
  );
});
