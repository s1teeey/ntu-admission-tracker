/* NTU Admission — 臺大碩士班甄試放榜工具（非官方）
   Everything a visitor enters (selected departments, pasted lists, uploaded 榜單) stays in this browser's localStorage.
   Shared, read-only files: data/config.json (release dates, detector URL), data/catalog.json (department names),
   data/results116.json + data/demo116.json (116 demo, admission numbers only). */
(function () {
"use strict";
var P = window.NTP;
var KEY = "ntua-v1", MAXD = 3, POLL_MS = 10000;
var TABS = [["overview", "NTU", "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  ["roster", "名冊", "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0"],
  ["result", "放榜", "m3 11 18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  ["settings", "設定", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"]];
var TILE = ["t0", "t1", "t2"], SWATCH = ["#93c5fd", "#7dd3b5", "#b9a8ff"];

/* ---------- tiny helpers ---------- */
var $ = function (id) { return document.getElementById(id); };
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function svg(d) { var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); d.split(" M").forEach(function (part, i) { var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", (i ? "M" : "") + part); s.appendChild(p); }); return s; }
function btn(txt, cls, fn) { var b = el("button", "btn sm " + (cls || ""), txt); b.type = "button"; if (fn) b.addEventListener("click", fn); return b; }
var tf = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function fmt(t) { return t ? tf.format(new Date(t)).replace(/\s+/g, " ") : "—"; }
function dur(ms) { var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400); s %= 86400; var h = Math.floor(s / 3600); s %= 3600; var m = Math.floor(s / 60); s %= 60; var p = function (n) { return String(n).padStart(2, "0"); }; return (d ? d + " 天 " : "") + p(h) + ":" + p(m) + ":" + p(s); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function lab(id) { return String(parseInt(String(id).slice(-3), 10)); }
function getJSON(path) { return fetch(path + (path.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
var ALIAS = { "商學研究所": "商研", "國際企業學系": "國企", "財務金融學系": "財金", "會計學系": "會計", "資訊管理學系": "資管", "經濟學系": "經濟",
  "工商管理學系": "工管", "資訊工程學系": "資工", "電機工程學系": "電機", "機械工程學系": "機械", "土木工程學系": "土木", "化學工程學系": "化工",
  "國家發展研究所": "國發所", "新聞研究所": "新聞所", "社會工作學系": "社工", "政治學系": "政治", "法律學系": "法律", "心理學系": "心理",
  "電信工程學研究所": "電信所", "電子工程學研究所": "電子所", "資訊網路與多媒體研究所": "網媒所", "生醫電子與資訊學研究所": "生醫電資所", "應用力學研究所": "應力所",
  "農業經濟學系": "農經", "公共衛生學系": "公衛", "健康政策與管理研究所": "健管所", "資料科學碩士學位學程": "資料科學", "財金碩士學位學程": "財金學程" };
function shortOf(n) {
  n = String(n || "");
  for (var k in ALIAS) if (n.indexOf(k) === 0) { var g0 = (n.match(/([甲乙丙丁戊己庚辛壬癸])組/) || [])[1] || ""; var rest = n.slice(k.length).replace(/^碩士班/, "").replace(/\(.*?\)|（.*?）/g, ""); return ALIAS[k] + (g0 || (rest && rest.length <= 6 && !/組$/.test(rest) ? "" : rest.replace(/組$/, ""))); }
  var g = (n.match(/([甲乙丙丁戊己庚辛壬癸])組/) || [])[1] || "";
  var base = n.replace(/\(.*?\)|（.*?）/g, "").replace(/碩士班.*$|碩士學位學程.*$/, "").replace(/學系$|研究所$|系$/, "");
  if (/學位學程/.test(n) && !/學程$/.test(base)) base += "學程";
  return (base.length > 6 ? base.slice(0, 6) : base) + g;
}
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- state ---------- */
var CFG = { year: null, batches: {}, worker: "", feedback: "", history: "https://reserve-process-checker.vercel.app/" };
var CAT = [], CATBY = {}, DEMO = null, DEMORES = null;
function blank() { return { depts: [], rosters: {}, autoLink: true, results: {}, sim: null, ack: "" }; }
var S = { mode: "mine", mine: blank(), demo: null };
try { var sv = JSON.parse(lsGet(KEY) || "null"); if (sv && sv.mine) S = sv; } catch (e) {}
function save() { lsSet(KEY, JSON.stringify(S)); }
function cur() { return S.mode === "demo" && S.demo ? S.demo : S.mine; }
function isDemo() { return S.mode === "demo" && !!S.demo; }
var tab = "overview", sel = null, filter = "all", query = "", closed = {};
try { closed = JSON.parse(lsGet(KEY + ":closed") || "{}"); } catch (e) {}
var det = { state: "", lastAt: 0, busy: false, err: false, nextAt: 0, note: "" };

/* ---------- derived data ---------- */
function allBlocks() {
  var out = [];
  if (isDemo()) { if (DEMORES) Object.keys(DEMORES.batches).forEach(function (b) { DEMORES.batches[b].blocks.forEach(function (x) { out.push(x); }); }); }
  else Object.keys(S.mine.results || {}).forEach(function (b) { (S.mine.results[b].blocks || []).forEach(function (x) { out.push(x); }); });
  return out;
}
var D = null; // recomputed by derive()
function derive() {
  var st = cur(), blocks = allBlocks(), byName = {};
  blocks.forEach(function (b) { (byName[b.n] = byName[b.n] || []).push(b); });
  var depts = st.depts.slice(0, MAXD);
  // per department: primary block (一般生 first), status index id → {t, r}
  var info = depts.map(function (d) {
    var bl = byName[d.n] || [], prim = bl.filter(function (b) { return b.i === "一般生"; })[0] || bl[0] || null, idx = {};
    bl.forEach(function (b) { var w = 0, p = 0, k = 0; b.r.forEach(function (x) { var t = x[1]; idx[x[0]] = t === "W" ? { t: "win", r: ++w, i: b.i } : t === "P" ? { t: "win", r: ++p, pri: true, i: b.i } : { t: "wait", r: ++k, i: b.i }; }); });
    return { d: d, blocks: bl, prim: prim, idx: idx, has: bl.length > 0 };
  });
  // simulation overrides real results for departments it covers
  if (st.sim) info.forEach(function (x) {
    var s = st.sim[x.d.n]; if (!s) return; var idx = {};
    s.w.forEach(function (id, i) { idx[id] = { t: "win", r: i + 1 }; }); s.b.forEach(function (id, i) { idx[id] = { t: "wait", r: i + 1 }; });
    x.idx = idx; x.has = true; x.simW = s.w; x.simB = s.b;
  });
  // rosters: pasted 一階 list → demo list → people listed in the 榜單
  var lists = info.map(function (x) {
    var n = x.d.n, L = null;
    if (isDemo()) { var r = DEMO && DEMO.rosters[n]; if (r) L = r.map(function (e) { return { id: e[0], p: e[1], name: "" }; }); }
    else if (st.rosters[n] && st.rosters[n].length) L = st.rosters[n];
    x.src = L ? (isDemo() ? "demo" : "paste") : "";
    if (!L && x.blocks.length) { x.src = "result"; L = []; var seen = {}; x.blocks.forEach(function (b) { b.r.forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; L.push({ id: e[0], name: e[2] || "" }); } }); }); L.sort(function (a, b) { return a.id < b.id ? -1 : 1; }); }
    return L || [];
  });
  var persons = P.buildPersons(lists, !!st.autoLink);
  persons.forEach(function (p) { p.n = p.ids.filter(Boolean).length; if (!p.name) p.name = p.p ? "考生" + p.p : p.ids.filter(Boolean)[0]; });
  var byId = info.map(function () { return {}; });
  persons.forEach(function (p) { p.ids.forEach(function (id, k) { if (id) byId[k][id] = p; }); });
  D = { info: info, lists: lists, persons: persons, byId: byId };
}
function statusOf(k, id) { if (!id) return null; var x = D.info[k]; if (!x || !x.has) return { t: "pre" }; return x.idx[id] || { t: "none" }; }
function label(s) { if (!s) return "—"; return s.t === "win" ? (s.pri ? "優先錄取" : "正取") : s.t === "wait" ? "備取 " + s.r : s.t === "none" ? "未列入" : "—"; }
function labelMe(s) { if (!s) return "—"; return s.t === "win" ? (s.pri ? "優先錄取 #" : "正取 #") + s.r : s.t === "wait" ? "備取 #" + s.r : s.t === "none" ? "未列入" : "待放榜"; }
function pill(s) { if (!s || s.t === "pre") return document.createTextNode(""); return el("span", "pill " + s.t, label(s)); }
function cat(p) { return p.n >= 3 ? "三榜" : p.n === 2 ? "二榜" : ""; }
function isMe(p) { return p.ids.some(function (id, k) { var d = D.info[k] && D.info[k].d; return id && d && d.me && d.me === id; }); }
function anyResult() { return D.info.some(function (x) { return x.has; }); }
function realResult() { return D.info.some(function (x) { return x.blocks.length > 0; }); }
function simOn() { return !!cur().sim; }

/* ---------- release schedule (mine mode) ---------- */
function deptBatch(d) { var c = CATBY[d.n]; return c ? String(c.b) : null; }
function batchTime(b) { var x = CFG.batches && CFG.batches[b]; if (!x || !x.date) return null; var t = Date.parse(x.date + "T" + (x.time || "09:00") + ":00+08:00"); return isNaN(t) ? null : t; }
function pending() { // the batch that matters next for the selected departments
  var bs = {}; S.mine.depts.forEach(function (d) { var b = deptBatch(d); if (b) bs[b] = 1; else { bs["1"] = 1; bs["2"] = 1; } });
  var list = Object.keys(bs).sort().filter(function (b) { return !(S.mine.results[b] && S.mine.results[b].year === CFG.year); });
  if (!list.length) return null;
  var withT = list.map(function (b) { return { b: b, t: batchTime(b) }; });
  var dated = withT.filter(function (x) { return x.t; }).sort(function (a, b) { return a.t - b.t; });
  return dated[0] || withT[0];
}
function detecting() { var p = !isDemo() && pending(); if (!p || !p.t || !CFG.worker) return null; var now = Date.now(); return now >= p.t - 5 * 60000 && now < p.t + 14 * 3600000 ? p : null; }

/* ---------- PDF → results ---------- */
var pdfjsP = null;
function pdfjs() { if (!pdfjsP) pdfjsP = import("./lib/pdf.min.mjs").then(function (m) { m.GlobalWorkerOptions.workerSrc = new URL("lib/pdf.worker.min.mjs", location.href).href; return m; }); return pdfjsP; }
function pdfLines(buf) {
  return pdfjs().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise; }).then(function (doc) {
    var out = [], chain = Promise.resolve();
    for (var i = 1; i <= doc.numPages; i++) (function (n) { chain = chain.then(function () { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
      var rows = {}; tc.items.forEach(function (it) { if (!it.str) return; var y = Math.round(it.transform[5]); (rows[y] = rows[y] || []).push([it.transform[4], it.str, it.width]); });
      Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) { var r = rows[y].sort(function (a, b) { return a[0] - b[0]; }), s = "", end = null; r.forEach(function (x) { if (end !== null && x[0] - end > 2) s += " "; s += x[1]; end = x[0] + x[2]; }); out.push(s); });
    }); }); })(i);
    return chain.then(function () { return out; });
  });
}
function toResults(lines, src, url) {
  var r = P.parseResults(lines), chk = P.checkResults(r);
  return { year: r.year, batch: r.batch, at: Date.now(), src: src, url: url || "", check: chk,
    blocks: r.blocks.map(function (b) { return { n: b.name, i: b.ident, d: b.declared, r: b.rows.map(function (x) { return [x[0], x[2], x[1]]; }) }; }) };
}
function storeResults(res) {
  if (!res.blocks.length) throw new Error("這份 PDF 找不到任何系所組別的名單");
  var b = String(res.batch || "2");
  S.mine.results[b] = res; S.mine.sim = null; save();
}
function uploadPdf(file) {
  setBusy("解析中…");
  file.arrayBuffer().then(pdfLines).then(function (lines) {
    var res = toResults(lines, "upload", ""); storeResults(res);
    if (isDemo()) leaveDemo();
    setBusy(""); renderAll(); showModal(res); go("result");
  }).catch(function (e) { setBusy(""); alert("無法讀取這份 PDF：" + (e && e.message || e)); });
}

/* ---------- detector (Cloudflare worker; see worker/) ---------- */
function pollDetector() {
  var p = detecting(); if (!p || det.busy) return;
  det.busy = true;
  getJSON(CFG.worker.replace(/\/$/, "") + "/status?year=" + CFG.year + "&batch=" + p.b).then(function (j) {
    det.lastAt = Date.now(); det.err = false; det.note = j.note || "";
    if (j.found) return fetch(CFG.worker.replace(/\/$/, "") + "/pdf?year=" + CFG.year + "&batch=" + p.b).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(pdfLines).then(function (lines) { var res = toResults(lines, "auto", j.url); res.batch = res.batch || +p.b; storeResults(res); renderAll(); showModal(res); });
  }).catch(function () { det.err = true; }).then(function () { det.busy = false; det.nextAt = Date.now() + POLL_MS; renderHero(); renderLive(); });
}

/* ---------- simulation ---------- */
function makeSim() {
  var sim = {};
  D.info.forEach(function (x, k) {
    if (x.src === "result" || !D.lists[k].length) return;
    var ids = shuffle(D.lists[k].map(function (e) { return e.id; })), w = Math.min(ids.length, x.d.q || Math.ceil(ids.length * 0.45)), b = Math.min(ids.length - w, Math.ceil(w * 0.5));
    sim[x.d.n] = { w: ids.slice(0, w), b: ids.slice(w, w + b) };
  });
  return Object.keys(sim).length ? sim : null;
}
function canSim() { return D.info.some(function (x, k) { return x.src !== "result" && D.lists[k].length; }); }

/* ---------- rendering: shared bits ---------- */
function foldHead(key, title, right) { var h = el("button", "gtog"); h.type = "button"; h.setAttribute("aria-expanded", closed[key] ? "false" : "true"); h.appendChild(el("span", "chev", closed[key] ? "▸" : "▾")); h.appendChild(el("b", null, title)); if (right) h.appendChild(el("span", "k", right)); h.addEventListener("click", function () { closed[key] = !closed[key]; lsSet(KEY + ":closed", JSON.stringify(closed)); renderCircles(); }); return h; }
function sep(t) { return el("div", "sep", t); }
function legendInto(id, items) { var lg = $(id); lg.textContent = ""; items.forEach(function (x) { var s = el("span"); s.appendChild(el("i", x[0])); s.appendChild(document.createTextNode(x[1])); lg.appendChild(s); }); }
function rings() { var r = []; if (D.info.length > 1) r.push(["rg2", "二榜"]); if (D.info.length > 2) r.push(["rg3", "三榜"]); r.push(["m", "我"]); return r; }
function circle(p, k) {
  var id = p.ids[k], s = statusOf(k, id), c = ["c"], b = el("button", null, lab(id)); b.type = "button";
  if (s && s.t !== "pre") c.push(s.t);
  if (p.n >= 3) c.push("rg3"); else if (p.n === 2) c.push("rg2");
  if (isMe(p)) c.push("self"); if (sel === p) c.push("sel");
  b.className = c.join(" ");
  b.title = p.name + " · " + D.info[k].d.s + " " + id + (s && s.t !== "pre" ? " · " + label(s) : ""); b.setAttribute("aria-label", b.title);
  b.addEventListener("click", function () { sel = sel === p ? null : p; renderCircles(); renderPicked(); });
  return b;
}
function dotsOf(arr, k) { var d = el("div", "dots"); arr.forEach(function (p) { d.appendChild(circle(p, k)); }); return d; }
function deptPeople(k) { return D.lists[k].map(function (e) { return D.byId[k][e.id]; }).filter(Boolean); }

/* ---------- 名冊 ---------- */
function pasteBox(d, k, onDone) {
  var w = el("div", "paste");
  var ta = el("textarea"); ta.placeholder = "把系網公告的一階名單整段複製貼上（准考證號＋姓名）"; ta.setAttribute("aria-label", d.s + " 一階名單"); ta.value = "";
  var hint = el("div", "hint", "可以連標題、表格一起貼上，會自動抓出 7 碼准考證號");
  ta.addEventListener("input", function () { var n = P.parsePaste(ta.value); hint.className = "hint" + (ta.value && !n.length ? " bad" : n.length ? " ok" : ""); hint.textContent = !ta.value ? "可以連標題、表格一起貼上，會自動抓出 7 碼准考證號" : n.length ? "抓到 " + n.length + " 人（" + n[0].id + " " + n[0].name + " … " + n[n.length - 1].id + "）" : "找不到准考證號"; });
  var acts = el("div", "row");
  acts.appendChild(btn("儲存名單", "", function () { var n = P.parsePaste(ta.value); if (!n.length) { ta.focus(); return; } n.sort(function (a, b) { return a.id < b.id ? -1 : 1; }); S.mine.rosters[d.n] = n; save(); sel = null; renderAll(); }));
  if (onDone) acts.appendChild(btn("取消", "link", onDone));
  w.appendChild(ta); w.appendChild(hint); w.appendChild(acts);
  return w;
}
var editing = {};
function renderRoster() {
  var box = $("rosterGroups"); box.textContent = "";
  $("autoLink").checked = !!cur().autoLink;
  if (!D.info.length) { box.appendChild(emptyPick()); $("rosterTag").textContent = "—"; legendInto("legendR", []); return; }
  D.info.forEach(function (x, k) {
    var d = x.d, key = "roster:" + d.n, people = deptPeople(k), w = el("div", "grp"); if (k) w.style.borderTop = "1px solid var(--line)";
    var head = el("div", "gh"); head.style.marginBottom = "0";
    head.appendChild(foldHead(key, d.s, people.length ? people.length + " 人" + (x.src === "result" ? "（榜單）" : "") : ""));
    if (!isDemo() && x.src === "paste" && !editing[d.n]) { var a = el("div", "row"); a.appendChild(btn("重新貼上", "link", function () { editing[d.n] = 1; renderRoster(); })); a.appendChild(btn("清除", "link", function () { delete S.mine.rosters[d.n]; save(); sel = null; renderAll(); })); head.appendChild(a); }
    w.appendChild(head);
    if (!closed[key]) {
      if (!isDemo() && (x.src !== "paste" || editing[d.n])) {
        w.appendChild(pasteBox(d, k, editing[d.n] ? function () { delete editing[d.n]; renderRoster(); } : null));
        if (x.src === "result") w.appendChild(el("div", "hint", "還沒貼一階名單，下面先顯示榜單上的人"));
      }
      if (people.length && !editing[d.n]) { var dd = dotsOf(people, k); dd.style.marginTop = "12px"; w.appendChild(dd); }
    }
    box.appendChild(w);
  });
  var cnt = { "二榜": 0, "三榜": 0 }; D.persons.forEach(function (p) { var c = cat(p); if (c) cnt[c]++; });
  $("rosterTag").textContent = D.info.length < 2 ? D.persons.length + " 人" : "二榜 " + cnt["二榜"] + (D.info.length > 2 ? " · 三榜 " + cnt["三榜"] : "");
  legendInto("legendR", rings());
}
function emptyPick() { var w = el("div", "pad"); w.appendChild(el("p", "hint", "還沒有選系所。")); w.appendChild(btn("選擇系所", "", function () { go("settings"); })); return w; }

/* ---------- 放榜 ---------- */
function renderResult() {
  var box = $("resultGroups"); box.textContent = "";
  var real = realResult(), sim = simOn(), ban = $("banner"), acts = $("banActs"); acts.textContent = "";
  ban.className = "banner" + (sim ? " sim" : real ? " done" : "");
  $("banH").textContent = sim ? "模擬放榜" : real ? (isDemo() ? "116 榜單" : "已放榜") : "未放榜";
  var srcs = []; if (!isDemo()) Object.keys(S.mine.results).forEach(function (b) { var r = S.mine.results[b]; srcs.push((r.year || "") + " 第" + b + "梯次" + (r.src === "auto" ? "（自動）" : "（上傳）")); });
  $("banP").textContent = sim ? "隨機結果，只是體驗" : isDemo() ? "真實榜單，只有准考證號" : srcs.join(" · ");
  if (sim) acts.appendChild(btn("清除模擬", "", function () { cur().sim = null; save(); sel = null; renderAll(); }));
  else {
    if (canSim() && (isDemo() || !realResult())) acts.appendChild(btn("模擬放榜", "", function () { cur().sim = makeSim(); save(); sel = null; renderAll(); }));
    if (!isDemo()) acts.appendChild(btn("上傳榜單 PDF", "ghost", pickPdf));
  }
  if (!D.info.length) { box.appendChild(emptyPick()); legendInto("legendX", []); renderValid(); return; }
  D.info.forEach(function (x, k) {
    var d = x.d, key = "result:" + d.n, people = deptPeople(k), w = el("div", "grp"); if (k) w.style.borderTop = "1px solid var(--line)";
    var W = x.simW || (x.prim ? x.prim.r.filter(function (e) { return e[1] !== "B"; }).map(function (e) { return e[0]; }) : []);
    var B = x.simB || (x.prim ? x.prim.r.filter(function (e) { return e[1] === "B"; }).map(function (e) { return e[0]; }) : []);
    w.appendChild(foldHead(key, d.s, x.has ? "正取 " + W.length + " · 備取 " + B.length : people.length + " 人"));
    if (!closed[key]) {
      var body = el("div"); body.style.marginTop = "12px";
      if (!x.has) { if (people.length) body.appendChild(dotsOf(people, k)); else body.appendChild(el("div", "hint", "尚無名單")); }
      else {
        var seen = {}, put = function (ids, t) { var arr = ids.map(function (i) { seen[i] = 1; return D.byId[k][i]; }).filter(Boolean); body.appendChild(sep(t + " " + arr.length)); body.appendChild(dotsOf(arr, k)); };
        put(W, "正取"); put(B, "備取");
        var rest = people.filter(function (p) { return !seen[p.ids[k]] && !(x.idx[p.ids[k]]); });
        if (x.src !== "result") { body.appendChild(sep("未列入 " + rest.length)); body.appendChild(dotsOf(rest, k)); }
        if (!x.simW) x.blocks.forEach(function (b) { if (b === x.prim || !b.r.length) return; var nw = b.r.filter(function (e) { return e[1] !== "B"; }).length; body.appendChild(el("div", "fl", b.i + "：正取 " + nw + " · 備取 " + (b.r.length - nw))); });
      }
      w.appendChild(body);
    }
    box.appendChild(w);
  });
  legendInto("legendX", anyResult() ? [["w", "正取"], ["t", "備取"], ["n", "未列入"]].concat(rings()) : rings());
  renderValid();
}
function renderValid() {
  var c = $("validCard"); c.textContent = ""; c.hidden = true;
  if (isDemo()) return;
  var bad = []; Object.keys(S.mine.results).forEach(function (b) { var r = S.mine.results[b], ch = r.check || {}; (ch.bad || []).forEach(function (t) { bad.push("第" + b + "梯次 " + t); }); });
  var keys = Object.keys(S.mine.results); if (!keys.length) return;
  c.hidden = false;
  var h = el("div", "sh"); h.appendChild(el("h3", null, "榜單核對")); h.appendChild(el("span", "tg " + (bad.length ? "bad" : "ok"), bad.length ? "有 " + bad.length + " 處不一致" : "通過")); c.appendChild(h);
  var b = el("div", "pad");
  if (!bad.length) keys.forEach(function (k) { var r = S.mine.results[k]; b.appendChild(el("div", "mono", "第" + k + "梯次：" + r.blocks.length + " 個系所組別，人數和榜單合計一致")); });
  else bad.slice(0, 12).forEach(function (t) { b.appendChild(el("div", "mono", t)); });
  c.appendChild(b);
}
function renderCircles() { renderRoster(); renderResult(); }
function renderPicked() {
  ["pickedR", "pickedX"].forEach(function (id) {
    var box = $(id); box.textContent = ""; if (!sel) return;
    var n = el("div", "pn", sel.name); if (cat(sel)) n.appendChild(el("span", "cat", cat(sel))); box.appendChild(n);
    sel.ids.forEach(function (v, k) { if (!v) return; var l = el("div", "pl"); l.appendChild(el("span", "mono", D.info[k].d.s + " " + v)); l.appendChild(pill(statusOf(k, v))); box.appendChild(l); });
  });
}

/* ---------- table ---------- */
function renderTable() {
  var th = $("th"), tb = $("tb"); th.textContent = ""; tb.textContent = "";
  $("tblCard").hidden = !D.persons.length;
  var tr0 = el("tr"); tr0.appendChild(el("th", null, "姓名")); D.info.forEach(function (x) { tr0.appendChild(el("th", null, x.d.s)); }); th.appendChild(tr0);
  var q = query.trim().toLowerCase(), rows = 0;
  D.persons.slice().sort(function (a, b) { var x = a.ids.filter(Boolean)[0], y = b.ids.filter(Boolean)[0]; return x < y ? -1 : 1; }).forEach(function (p) {
    var c = cat(p);
    if (filter === "二榜" || filter === "三榜") { if (c !== filter) return; } else if (/^d\d$/.test(filter) && !p.ids[+filter.slice(1)]) return;
    if (q && (p.name + " " + p.ids.filter(Boolean).join(" ")).toLowerCase().indexOf(q) < 0) return;
    if (rows++ > 600) return;
    var tr = el("tr", isMe(p) ? "self" : ""), nm = el("td", null, p.name); if (c) nm.appendChild(el("span", "cat", c)); tr.appendChild(nm);
    p.ids.forEach(function (id, k) { var td = el("td"); if (id) { td.appendChild(el("span", "mono", id.slice(-3) + " ")); td.appendChild(pill(statusOf(k, id))); } tr.appendChild(td); });
    tb.appendChild(tr);
  });
  $("tblTag").textContent = rows + " 人";
}
function buildChips() {
  var box = $("chips"); box.textContent = "";
  var list = [["all", "全部"]]; if (D.info.length > 1) list.push(["二榜", "二榜"]); if (D.info.length > 2) list.push(["三榜", "三榜"]);
  D.info.forEach(function (x, k) { list.push(["d" + k, x.d.s]); });
  if (!list.some(function (x) { return x[0] === filter; })) filter = "all";
  list.forEach(function (x) { var b = el("button", "chip", x[1]); b.type = "button"; b.setAttribute("aria-pressed", filter === x[0] ? "true" : "false"); b.addEventListener("click", function () { filter = x[0]; buildChips(); renderTable(); }); box.appendChild(b); });
}

/* ---------- overview ---------- */
function renderMine() {
  var b = $("mine"); b.textContent = "";
  D.info.forEach(function (x, k) { if (!x.d.me) return; var m = el("div", "m"); m.appendChild(el("span", null, x.d.s)); var s = statusOf(k, x.d.me); m.appendChild(s && s.t !== "pre" ? el("span", "pill " + s.t, labelMe(s)) : el("span", "pill pre", "待放榜")); b.appendChild(m); });
  b.hidden = !b.childNodes.length;
}
function heroSet(cls, tag, h, p, num) { $("hero").className = "hero " + (cls || ""); $("heroTag").textContent = tag; $("heroH").textContent = h; $("heroP").textContent = p || ""; var n = $("heroN"); n.hidden = num == null; if (num != null) n.textContent = num; }
var NTU_ACA = "https://www.aca.ntu.edu.tw/w/aca/RecruitAnnouncementsMaster";
var heroActsKey = "";
function renderHero() {
  var real = $("heroActs"), acts = document.createDocumentFragment(), keyParts = [];
  var origAppend = acts.appendChild.bind(acts);
  acts.appendChild = function (n) { keyParts.push(n.textContent); return origAppend(n); };
  heroInner(acts);
  var key = keyParts.join("|");
  if (key !== heroActsKey) { heroActsKey = key; real.textContent = ""; real.appendChild(acts); }
}
function heroInner(acts) {
  $("demoBar").hidden = !isDemo();
  $("bigTitle").textContent = (isDemo() ? 116 : CFG.year || "") + " 碩士班甄試放榜";
  if (isDemo()) { heroSet(simOn() ? "" : "found", simOn() ? "模擬中" : "116 試玩", simOn() ? "模擬放榜中" : "116 學年度榜單已載入", "到「設定」輸入你的准考證號，或在「放榜」按模擬放榜體驗一次"); return; }
  if (!S.mine.depts.length) { heroSet("", "開始", "先選擇要比對的系所", "最多 3 個，之後可以換"); acts.appendChild(btn("選擇系所", "", function () { go("settings"); })); acts.appendChild(btn("116 試玩", "ghost", enterDemo)); return; }
  if (simOn()) { heroSet("", "模擬中", "模擬放榜中", "結果是隨機的"); return; }
  var p = pending(), now = Date.now();
  if (!p) { var last = 0; Object.keys(S.mine.results).forEach(function (b) { last = Math.max(last, S.mine.results[b].at || 0); }); heroSet("found", "已放榜", "榜單已載入", "載入時間 " + fmt(last)); acts.appendChild(btn("查看榜單", "", function () { go("result"); })); return; }
  var bl = "第 " + p.b + " 梯次";
  if (!p.t) { heroSet("", "未公布", bl + "放榜日尚未公布", "公布後這裡會開始倒數"); return; }
  if (now < p.t) { heroSet("", "倒數", bl + " " + fmt(p.t) + " 放榜", "", dur(p.t - now)); return; }
  if (detecting()) { heroSet("watching", "偵測中", "每 10 秒檢查一次教務處網站", det.lastAt ? "上次檢查 " + fmt(det.lastAt) + (det.err ? " · 連線失敗，重試中" : "") : "連線中…"); acts.appendChild(btn("自己上傳 PDF", "ghost", pickPdf)); return; }
  heroSet("timeout", "放榜時間已到", "到教務處下載榜單 PDF，再上傳到這裡", bl);
  var a = el("a", "btn sm", "前往教務處"); a.href = NTU_ACA; a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); acts.appendChild(btn("上傳榜單 PDF", "ghost", pickPdf));
}
function renderTiles() {
  var b = $("tiles"); b.textContent = ""; b.className = "tiles n" + D.info.length;
  b.hidden = !D.info.length;
  D.info.forEach(function (x, k) {
    var t = el("div", "tile " + TILE[k]), s = x.d.me ? statusOf(k, x.d.me) : null, big;
    if (s) big = s.t === "pre" ? "待放榜" : labelMe(s);
    else if (x.has) { var W = x.simW ? x.simW.length : x.prim ? x.prim.r.filter(function (e) { return e[1] !== "B"; }).length : 0, B = x.simB ? x.simB.length : x.prim ? x.prim.r.filter(function (e) { return e[1] === "B"; }).length : 0; big = W + " / " + B; }
    else big = D.lists[k].length ? D.lists[k].length + " 人" : "—";
    t.appendChild(el("b", null, big)); t.appendChild(el("span", null, x.d.s + (s ? "" : x.has ? " 正取 / 備取" : " 一階"))); b.appendChild(t);
  });
  var on = anyResult(), t4 = el(on ? "button" : "div", "tile tgo" + (on ? " on" : ""));
  if (on) { t4.type = "button"; t4.addEventListener("click", function () { go("result"); }); }
  t4.appendChild(el("b", null, simOn() ? "模擬放榜" : on ? "已放榜" : "等待放榜")); t4.appendChild(el("span", null, on ? "點擊查詢" : "尚未出現")); b.appendChild(t4);
}
function renderMe() {
  var box = $("meBoxes"); box.textContent = ""; box.className = "mecards" + (D.info.length >= 3 ? " n3" : "");
  $("meCard").hidden = !D.info.length;
  D.info.forEach(function (x, k) {
    var d = x.d, s = d.me ? statusOf(k, d.me) : null, c = el("div", "mc");
    c.appendChild(el("div", "d", d.s)); c.appendChild(el("div", "i", d.me || "未輸入准考證號"));
    c.appendChild(el("div", "o " + (s ? s.t : "pre"), s ? labelMe(s) : "—"));
    var t = "";
    if (s && s.t === "wait") t = "正取 " + (x.simW ? x.simW.length : x.prim ? x.prim.r.filter(function (e) { return e[1] !== "B"; }).length : "?") + " 名";
    else if (s && s.t === "none") t = "此所未列入榜單";
    else if (d.q) t = "正取 " + d.q + " 名";
    c.appendChild(el("div", "t", t || d.n));
    box.appendChild(c);
  });
}
function renderFoot() {
  document.querySelectorAll("[data-foot]").forEach(function (f) {
    f.textContent = ""; f.appendChild(el("span", null, "非官方工具，所有資訊以臺大教務處公告為準。"));
    if (CFG.feedback) { var a = el("a", null, "意見回饋"); a.href = CFG.feedback; a.target = "_blank"; a.rel = "noopener"; var s = el("span"); s.appendChild(a); f.appendChild(s); }
    else f.appendChild(el("span", null, "意見回饋表單準備中"));
  });
  $("histLink").href = CFG.history;
}
function renderDate() { $("dateLine").textContent = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", weekday: "long", month: "long", day: "numeric" }).format(new Date()); }
var busyMsg = "";
function setBusy(m) { busyMsg = m; renderLive(); }
function renderLive() {
  var cls = "live off", txt = "—";
  if (busyMsg) { cls = "live"; txt = busyMsg; }
  else if (isDemo()) txt = "116 試玩";
  else if (detecting()) { cls = det.err ? "live bad" : "live"; txt = det.busy ? "檢查中…" : "偵測中 · " + Math.max(0, Math.ceil((det.nextAt - Date.now()) / 1000)) + "s"; }
  else if (realResult()) txt = "已放榜";
  else if (S.mine.depts.length) txt = "等待放榜";
  ["liveS", "liveT"].forEach(function (id) { var e = $(id); e.className = cls; e.querySelector(".lt").textContent = txt; });
  $("simTag").classList.toggle("on", simOn());
}

/* ---------- settings ---------- */
function catSearch(q) {
  q = String(q || "").replace(/\s+/g, ""); if (!q) return [];
  var out = [];
  CAT.forEach(function (c) { var s = shortOf(c.n), hay = c.n + " " + s + " " + (c.c || ""); var score = hay.indexOf(q) >= 0 ? 0 : (s.indexOf(q[0]) >= 0 && q.split("").every(function (ch) { return c.n.indexOf(ch) >= 0; })) ? 1 : -1; if (score >= 0) out.push([score, c]); });
  return out.sort(function (a, b) { return a[0] - b[0] || a[1].n.length - b[1].n.length; }).slice(0, 30).map(function (x) { return x[1]; });
}
function deptEditor(d, k) {
  var st = cur(), w = el("div", "dept");
  var dh = el("div", "dh"), title = el("b"); var sw = el("span", "sw"); sw.style.background = SWATCH[k]; title.appendChild(sw); title.appendChild(document.createTextNode(d.s || "系所 " + (k + 1))); dh.appendChild(title);
  dh.appendChild(btn("移除", "link", function () { st.depts.splice(k, 1); st.sim = null; save(); sel = null; renderAll(); })); w.appendChild(dh);
  var f = el("div", "fields");
  // department (autocomplete over the catalog; free text allowed)
  var f1 = el("div", "field ac"), l1 = el("label", null, "系所組別"), i1 = el("input"); i1.value = d.n; i1.placeholder = "例：商研、國企、財金甲"; i1.autocomplete = "off"; i1.id = "dn" + k; l1.htmlFor = i1.id;
  var ul = el("ul"); ul.hidden = true; ul.setAttribute("role", "listbox");
  function choose(n) { var c = CATBY[n]; d.n = n; d.s = shortOf(n); if (!d.q && c && c.w) d.q = null; st.sim = null; save(); ul.hidden = true; sel = null; renderAll(); }
  i1.addEventListener("input", function () { var r = catSearch(i1.value); ul.textContent = ""; r.forEach(function (c, i) { var li = el("li", null, c.n); li.setAttribute("role", "option"); li.appendChild(el("small", null, "第" + c.b + "梯次")); li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(c.n); }); ul.appendChild(li); }); ul.hidden = !r.length; });
  i1.addEventListener("keydown", function (e) { if (e.key === "Enter") { var first = ul.querySelector("li"); if (first && !ul.hidden) { e.preventDefault(); first.dispatchEvent(new MouseEvent("mousedown")); } else if (i1.value.trim()) choose(i1.value.trim()); } if (e.key === "Escape") ul.hidden = true; });
  i1.addEventListener("blur", function () { setTimeout(function () { if (!i1.isConnected) return; ul.hidden = true; var v = i1.value.trim(); if (v && v !== d.n) choose(v); }, 120); });
  f1.appendChild(l1); f1.appendChild(i1); f1.appendChild(ul); f.appendChild(f1);
  // short label
  var f2 = el("div", "field"), l2 = el("label", null, "簡稱"), i2 = el("input"); i2.value = d.s || ""; i2.maxLength = 8; i2.id = "ds" + k; l2.htmlFor = i2.id;
  i2.addEventListener("change", function () { d.s = i2.value.trim() || shortOf(d.n); save(); renderAll(); }); f2.appendChild(l2); f2.appendChild(i2); f.appendChild(f2);
  // quota
  var c = CATBY[d.n], f3 = el("div", "field"), l3 = el("label", null, "正取名額"), i3 = el("input"); i3.type = "number"; i3.inputMode = "numeric"; i3.min = "0"; i3.value = d.q || ""; i3.placeholder = c && c.w ? "116：" + c.w : ""; i3.id = "dq" + k; l3.htmlFor = i3.id;
  i3.addEventListener("change", function () { var v = parseInt(i3.value, 10); d.q = v > 0 ? v : null; save(); renderAll(); }); f3.appendChild(l3); f3.appendChild(i3); f.appendChild(f3);
  // my admission number
  var f4 = el("div", "field"), l4 = el("label", null, "我的准考證號"), i4 = el("input"); i4.value = d.me || ""; i4.maxLength = 7; i4.inputMode = "text"; i4.autocapitalize = "characters"; i4.placeholder = c && c.c ? c.c + "xxx" : "7 碼"; i4.id = "dm" + k; l4.htmlFor = i4.id;
  i4.addEventListener("change", function () { var v = i4.value.trim().toUpperCase(); d.me = /^[A-Z\d]\d{6}$/.test(v) ? v : ""; i4.value = d.me; save(); renderAll(); }); f4.appendChild(l4); f4.appendChild(i4); f.appendChild(f4);
  w.appendChild(f);
  return w;
}
function renderSettings() {
  var st = cur(), box = $("deptList"); box.textContent = "";
  st.depts.forEach(function (d, k) { box.appendChild(deptEditor(d, k)); });
  if (!st.depts.length) box.appendChild(el("div", "dept hint", "還沒有選系所"));
  $("deptCount").textContent = st.depts.length + " / " + MAXD;
  $("addDept").disabled = st.depts.length >= MAXD;
  var keys = isDemo() ? [] : Object.keys(S.mine.results);
  $("resInfo").textContent = isDemo() ? "試玩中使用 116 榜單" : keys.length ? keys.map(function (b) { var r = S.mine.results[b]; return (r.year || "") + " 第" + b + "梯次 · " + fmt(r.at); }).join("、") : "尚未載入";
  $("demoBtn").textContent = isDemo() ? "離開試玩" : "116 試玩";
  $("dataCard").querySelector("[data-act=upload]").disabled = isDemo();
}
$("addDept").addEventListener("click", function () { var st = cur(); if (st.depts.length >= MAXD) return; st.depts.push({ n: "", s: "", q: null, me: "" }); save(); renderAll(); setTimeout(function () { var i = $("dn" + (st.depts.length - 1)); if (i) i.focus(); }, 0); });
$("wipe").addEventListener("click", function () { if (!confirm("清除這台裝置上的系所、名單和榜單？")) return; S = { mode: "mine", mine: blank(), demo: null }; save(); sel = null; renderAll(); go("overview"); });
$("demoBtn").addEventListener("click", function () { if (isDemo()) leaveDemo(); else enterDemo(); });
function enterDemo() {
  if (!DEMO) return;
  if (!S.demo) S.demo = { depts: DEMO.pick.map(function (n) { var x = DEMO.depts.filter(function (d) { return d.n === n; })[0]; return { n: n, s: x ? x.s : shortOf(n), q: null, me: "" }; }), rosters: {}, autoLink: true, results: {}, sim: null };
  S.mode = "demo"; save(); sel = null; renderAll(); go("overview");
}
function leaveDemo() { S.mode = "mine"; save(); sel = null; renderAll(); }
function pickPdf() { if (isDemo()) return; $("pdfIn").value = ""; $("pdfIn").click(); }
$("pdfIn").addEventListener("change", function () { var f = this.files && this.files[0]; if (f) uploadPdf(f); });
$("autoLink").addEventListener("change", function () { cur().autoLink = this.checked; save(); sel = null; renderAll(); });
$("q").addEventListener("input", function (e) { query = e.target.value; renderTable(); });
document.addEventListener("click", function (e) {
  var t = e.target.closest && e.target.closest("[data-go],[data-act]"); if (!t) return;
  if (t.dataset.go) go(t.dataset.go);
  if (t.dataset.act === "leave-demo") leaveDemo();
  if (t.dataset.act === "upload") pickPdf();
});

/* ---------- modal ---------- */
function showModal(res) {
  var m = $("modal"), key = (res.year || "") + ":" + (res.batch || "") + ":" + res.at; if (S.mine.ack === key) return;
  $("mTitle").textContent = "已放榜"; $("mSub").textContent = (res.year || "") + " 第 " + (res.batch || "?") + " 梯次 · " + fmt(res.at);
  var r = $("mRes"); r.textContent = "";
  D.info.forEach(function (x, k) { var d = el("div"); d.appendChild(el("span", null, x.d.s)); var s = x.d.me ? statusOf(k, x.d.me) : null; d.appendChild(s ? el("span", "pill " + s.t, labelMe(s)) : el("span", "pill pre", x.has ? "已出榜" : "不在這份榜單")); r.appendChild(d); });
  m.hidden = false; m.dataset.key = key; setTimeout(function () { $("mOk").focus(); }, 0);
  document.title = "【已放榜】NTU Admission";
}
$("mOk").addEventListener("click", function () { S.mine.ack = $("modal").dataset.key || ""; save(); $("modal").hidden = true; document.title = "NTU Admission"; go("result"); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) $("mOk").click(); });
document.addEventListener("dblclick", function (e) { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });

/* ---------- tabs ---------- */
function buildNav() {
  var n = $("nav"), b = $("bottom"); n.textContent = ""; b.textContent = "";
  TABS.forEach(function (t) { [n, b].forEach(function (host, idx) { var x = el("button"); x.type = "button"; x.appendChild(svg(t[2])); x.appendChild(idx === 0 ? document.createTextNode(t[1]) : el("span", null, t[1])); if (t[0] === tab) x.setAttribute("aria-current", "page"); x.addEventListener("click", function () { go(t[0]); }); host.appendChild(x); }); });
  var a = el("a", "ext"); a.href = CFG.history; a.target = "_blank"; a.rel = "noopener"; a.appendChild(svg("M7 17 17 7 M7 7h10v10")); a.appendChild(document.createTextNode("歷年遞補")); n.appendChild(a);
}
function go(t) { tab = t; try { history.replaceState(null, "", "#" + t); } catch (e) {} TABS.forEach(function (x) { $("tab-" + x[0]).classList.toggle("on", x[0] === t); if (x[0] === t) $("pageTitle").textContent = x[1]; }); buildNav(); window.scrollTo(0, 0); }
function renderAll() { derive(); renderMine(); renderHero(); renderTiles(); renderMe(); renderCircles(); renderPicked(); buildChips(); renderTable(); renderSettings(); renderFoot(); renderLive(); }

/* ---------- boot ---------- */
buildNav(); renderDate();
var h0 = (location.hash || "").slice(1); go(TABS.some(function (t) { return t[0] === h0; }) ? h0 : "overview");
renderAll();
Promise.all([
  getJSON("data/config.json").then(function (j) { CFG = Object.assign(CFG, j); }).catch(function () {}),
  getJSON("data/catalog.json").then(function (j) { CAT = j.list || []; CATBY = {}; CAT.forEach(function (c) { CATBY[c.n] = c; }); }).catch(function () {}),
  getJSON("data/demo116.json").then(function (j) { DEMO = j; }).catch(function () {}),
  getJSON("data/results116.json").then(function (j) { DEMORES = j; }).catch(function () {})
]).then(function () { if (S.mode === "demo" && !S.demo) S.mode = "mine"; buildNav(); renderAll(); });
setInterval(function () { renderDate(); if (detecting() && !det.busy && Date.now() >= det.nextAt) pollDetector(); renderHero(); renderLive(); }, 1000);
setInterval(function () { getJSON("data/config.json").then(function (j) { CFG = Object.assign(CFG, j); }).catch(function () {}); }, 10 * 60000);
})();
