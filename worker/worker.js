/* Release detector for NTU Admission (Cloudflare Worker, free plan).
   GET /status?year=117&batch=2 → {found, url, foundAt, checkedAt}
   GET /pdf?year=117&batch=2    → the 榜單 PDF (CORS-enabled) once found
   Checks happen only when a visitor asks, at most once every 10 s per year/batch (shared cache).
   A found URL is remembered in KV (binding STATE), so later visitors get it instantly. */
const HOST = "https://www.aca.ntu.edu.tw/WebUPD/aca/";
const DIRS = ["A02", "LocalAdmissionClass"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const ZH = { 1: "一", 2: "二" };

function names(y, b) {
  return [`放榜用-${y}第${b}梯次電子榜單`, `放榜用-${y}第${ZH[b]}梯次電子榜單`, `放榜用-${y}學年度第${b}梯次電子榜單`,
    `放榜用-${y}碩士班甄試第${b}梯次電子榜單`, `${y}第${b}梯次電子榜單`, `${y}學年度碩甄第${b}梯次電子榜單`,
    `${y}學年度碩士班甄試招生第${b}梯次正、備取生名單`, `放榜用-${y}第${b}梯次正備取榜單`];
}
function json(o, maxAge) {
  return new Response(JSON.stringify(o), { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${maxAge}` } });
}
async function probe(url) {
  try {
    const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 0 } });
    return r.ok && /pdf/i.test(r.headers.get("content-type") || "");
  } catch (e) { return false; }
}
async function check(y, b) {
  const urls = DIRS.flatMap(d => names(y, b).map(n => HOST + d + "/" + encodeURIComponent(n + ".pdf")));
  const hits = await Promise.all(urls.map(probe));
  const i = hits.indexOf(true);
  return i >= 0 ? urls[i] : null;
}
export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const u = new URL(req.url), y = u.searchParams.get("year"), b = u.searchParams.get("batch");
    if (!/^\d{3}$/.test(y || "") || !/^[12]$/.test(b || "")) return json({ error: "year=3 digits, batch=1|2" }, 60);
    const key = `found:${y}:${b}`;
    let found = env.STATE ? await env.STATE.get(key, "json") : null;
    if (u.pathname === "/status") {
      if (found) return json({ found: true, ...found, checkedAt: new Date().toISOString() }, 30);
      const cache = caches.default, ck = new Request(`https://detector.cache/status/${y}/${b}`);
      const hit = await cache.match(ck); if (hit) return new Response(hit.body, hit);
      const url = await check(y, b), now = new Date().toISOString();
      let res;
      if (url) { found = { url, foundAt: now }; if (env.STATE) await env.STATE.put(key, JSON.stringify(found)); res = json({ found: true, ...found, checkedAt: now }, 30); }
      else res = json({ found: false, checkedAt: now }, 10);
      ctx.waitUntil(cache.put(ck, res.clone()));
      return res;
    }
    if (u.pathname === "/pdf") {
      if (!found) return json({ found: false }, 10);
      const r = await fetch(found.url, { headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 600, cacheEverything: true } });
      if (!r.ok) return json({ error: "upstream " + r.status }, 10);
      return new Response(r.body, { headers: { ...CORS, "Content-Type": "application/pdf", "Cache-Control": "public, max-age=600" } });
    }
    return json({ ok: true, usage: "/status?year=117&batch=2" }, 60);
  }
};
