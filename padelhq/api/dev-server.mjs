/* Runs the score API on your own computer for testing, without Cloudflare.
   Usage:  node padelhq/api/dev-server.mjs          (then open http://localhost:8787/v1/live?provider=demo&id=x)
   It also serves the PadelHQ page itself on http://localhost:8788/ so the two can be tried together. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

const API_PORT = Number(process.env.API_PORT || 8787);
const SITE_PORT = Number(process.env.SITE_PORT || 8788);
const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

http.createServer(async (req, res) => {
  try {
    const request = new Request("http://localhost:" + API_PORT + req.url, { method: req.method, headers: req.headers });
    const r = await worker.fetch(request, { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS }, {});
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
}).listen(API_PORT, () => console.log("Score API   http://localhost:" + API_PORT + "/v1/health"));

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(siteRoot, p));
  if (!file.startsWith(siteRoot)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(SITE_PORT, () => console.log("PadelHQ     http://localhost:" + SITE_PORT + "/?api=http://localhost:" + API_PORT));
