/* Pure parsing helpers (no DOM). Used by the page and by node tests. */
(function (root) {
"use strict";
var DASH = /[○〇Ｏ0OoＯ◯●＊*xX×]/;
// "陳○紅" → key "陳紅"; keeps surname + last char so different masks still match
function nameKey(n) {
  n = String(n || "").normalize("NFKC").trim().split(/[\s\u3000]+/)[0] || "";
  if (!n) return "";
  var chars = Array.from(n);
  return chars.length <= 1 ? chars.join("") : chars[0] + chars[chars.length - 1];
}
// one 一階 list pasted from a department page; returns [{id, name}] in text order, de-duplicated
function parsePaste(text) {
  var out = [], seen = {};
  var re = /(?:^|[^\dA-Za-z])([A-Z\d]\d{6})(?!\d)[\s,，、:：\t|]*([^\d\s,，、:：\t|]{1,8}(?:[ 　][A-Za-z○〇Ｏ]+[^\d\s,，、]*)?)?/g, m;
  String(text || "").replace(/\r/g, "").split("\n").forEach(function (line) {
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      var id = m[1]; if (seen[id]) continue; seen[id] = 1;
      var nm = (m[2] || "").trim();
      if (/^(正取|備取|錄取|通過|缺考|備註|姓名|准考證號?)$/.test(nm)) nm = "";
      out.push({ id: id, name: nm });
      re.lastIndex = m.index + 1 + id.length;
    }
  });
  return out;
}
// lines of the school-wide 放榜 PDF (text) → {year, batch, blocks:[{name, ident, rows:[[id,name,tag]], declared:[w,b]|null, none:bool}]}
function parseResults(lines) {
  if (typeof lines === "string") lines = lines.split("\n");
  var res = { year: null, batch: null, blocks: [] }, cur = null;
  var head = lines.slice(0, 8).join(" ").normalize("NFKC");
  var y = head.match(/(\d{3})\s*學年度/); if (y) res.year = +y[1];
  var b = head.match(/第\s*([0-9一二三])\s*梯次/); if (b) res.batch = { "一": 1, "二": 2, "三": 3 }[b[1]] || +b[1];
  lines.forEach(function (raw) {
    var l = String(raw).normalize("NFKC").replace(/\f/g, "").trim(), m;
    if ((m = l.match(/^系所組別[:：]\s*(.+)$/))) { cur = { name: m[1].replace(/\s+/g, ""), ident: "", rows: [], declared: null, none: false }; res.blocks.push(cur); return; }
    if (!cur) return;
    if ((m = l.match(/^身分別[:：]\s*(\S+)/))) { cur.ident = m[1]; return; }
    if ((m = l.match(/^([A-Z\d]\d{6})\s+(.*?)\s*(正取|備取|優先錄取)$/))) { cur.rows.push([m[1], m[2].trim(), m[3] === "正取" ? "W" : m[3] === "優先錄取" ? "P" : "B"]); return; }
    if (/^以上合計錄取/.test(l)) {
      var g = function (k) { var x = l.match(new RegExp(k + "\\s*(\\d+)\\s*名")); return x ? +x[1] : 0; };
      cur.declared = { P: g("優先錄取"), W: g("正取"), B: g("備取") }; return;
    }
    if (/無考生達錄取標準/.test(l)) cur.none = true;
  });
  return res;
}
// check every block's row count against its 以上合計 line
function checkResults(r) {
  var bad = [], unchecked = [];
  r.blocks.forEach(function (b) {
    if (b.none) { if (b.rows.length) bad.push(b.name + " " + b.ident); return; }
    var n = { P: 0, W: 0, B: 0 }; b.rows.forEach(function (x) { n[x[2]]++; });
    var d = b.declared;
    if (!d) { unchecked.push(b.name + " " + b.ident); return; }
    if ( d.P !== n.P || d.W !== n.W || d.B !== n.B) bad.push(b.name + " " + b.ident + "（解析 " + [n.P, n.W, n.B].join("/") + "，榜單 " + [d.P, d.W, d.B].join("/") + "）");
  });
  return { ok: r.blocks.length > 0 && !bad.length && unchecked.length <= 1, blocks: r.blocks.length, bad: bad, unchecked: unchecked };
}
// longest chain of candidate pairs increasing in both list positions
function lis(pairs) {
  pairs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var n = pairs.length, len = [], prev = [], best = -1;
  for (var i = 0; i < n; i++) {
    len[i] = 1; prev[i] = -1;
    for (var j = 0; j < i; j++) if (pairs[j][0] < pairs[i][0] && pairs[j][1] < pairs[i][1] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
    if (best < 0 || len[i] > len[best]) best = i;
  }
  var out = []; for (var k = best; k >= 0; k = prev[k]) out.unshift(pairs[k]);
  return out;
}
// lists: array of [{id,name}] (one per department). Returns persons: [{name, ids:[id|null,...]}]
// auto=true links the same masked name across lists, keeping registration order consistent
// entries may carry an explicit person key p (demo data); otherwise the masked name is used
function linkKey(e) { return e.p ? "#" + e.p : nameKey(e.name); }
function buildPersons(lists, auto) {
  var nodes = [], parent = [];
  lists.forEach(function (L, d) { L.forEach(function (e, i) { parent.push(nodes.length); nodes.push({ d: d, i: i, e: e }); }); });
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  var base = []; var acc = 0; lists.forEach(function (L) { base.push(acc); acc += L.length; });
  if (auto) {
    for (var a = 0; a < lists.length; a++) for (var b = a + 1; b < lists.length; b++) {
      var byKey = {};
      lists[b].forEach(function (e, j) { var k = linkKey(e); if (k) (byKey[k] = byKey[k] || []).push(j); });
      var cand = [];
      lists[a].forEach(function (e, i) { var k = linkKey(e); if (k) (byKey[k] || []).forEach(function (j) { cand.push([i, j]); }); });
      lis(cand).forEach(function (p) {
        var x = find(base[a] + p[0]), y = find(base[b] + p[1]);
        if (x === y) return;
        // never merge two entries from the same department
        var dx = {}, ok = true;
        nodes.forEach(function (n, k) { if (find(k) === x) dx[n.d] = 1; });
        nodes.forEach(function (n, k) { if (find(k) === y && dx[n.d]) ok = false; });
        if (ok) parent[y] = x;
      });
    }
  }
  var groups = {};
  nodes.forEach(function (n, k) { var r = find(k); (groups[r] = groups[r] || { name: "", p: "", ids: lists.map(function () { return null; }) }); groups[r].ids[n.d] = n.e.id; if (!groups[r].name && n.e.name) groups[r].name = n.e.name; if (!groups[r].p && n.e.p) groups[r].p = n.e.p; });
  return Object.keys(groups).map(function (k) { return groups[k]; });
}
var api = { nameKey: nameKey, parsePaste: parsePaste, parseResults: parseResults, checkResults: checkResults, buildPersons: buildPersons };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NTP = api;
})(this);
