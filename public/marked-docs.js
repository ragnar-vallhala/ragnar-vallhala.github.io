/* marked-docs — a global launcher for pages you've annotated.
 *
 * A circular button in the bottom-right corner of every page. Clicking it
 * opens a portal listing every blog you've marked up (via annotate.js),
 * most-recently-used first, so you can jump straight back. Reads the shared
 * "marginalia:index" from localStorage; lists the documents, not the notes.
 */
(function () {
  "use strict";

  var IDX = "marginalia:index";

  function readIndex() {
    try { return JSON.parse(localStorage.getItem(IDX)) || {}; } catch (e) { return {}; }
  }
  function entries() {
    var o = readIndex();
    return Object.keys(o)
      .map(function (k) { return o[k]; })
      .filter(function (e) { return e && e.count > 0; })
      .sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
  }
  function rel(ts) {
    if (!ts) return "";
    var s = (Date.now() - ts) / 1000;
    if (s < 45) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 604800) return Math.floor(s / 86400) + "d ago";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "/" + d.getDate();
  }
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }

  // ── export / import ──────────────────────────────────────────────────
  // annotate.js stores each page's marks under "marginalia:<path>" and lists
  // the pages in IDX. We read those keys directly (no shared module) and round-
  // trip them as one file, keyed by path — the same shape as annotations.json.
  var PREFIX = "marginalia:";
  function pageData(path) {
    try { return JSON.parse(localStorage.getItem(PREFIX + path)) || []; } catch (e) { return []; }
  }
  function buildExport() {
    var idx = readIndex(), out = {};
    Object.keys(idx).forEach(function (path) {
      var arr = pageData(path);
      if (!arr.length) return;
      out[path] = { title: (idx[path] && idx[path].title) || path, annotations: arr };
    });
    return out;
  }
  function download() {
    var json = JSON.stringify(buildExport(), null, 2);
    var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    var a = el("a"); a.href = url; a.download = "annotations.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function writeIndexEntry(path, title, arr) {
    var idx = readIndex();
    if (!arr.length) { delete idx[path]; }
    else {
      idx[path] = {
        path: path, url: path,
        title: title || (idx[path] && idx[path].title) || path,
        count: arr.length,
        notes: arr.filter(function (a) { return a.note; }).length,
        updated: Date.now()
      };
    }
    try { localStorage.setItem(IDX, JSON.stringify(idx)); } catch (e) {}
  }
  // Merge an uploaded file into local storage. Per page: keep what's there and
  // fold in the upload — same id ⇒ the uploaded mark wins; otherwise it's added
  // (skipping an exact start/end/note duplicate). Existing pages aren't wiped.
  function importData(obj) {
    var pages = 0, added = 0, updated = 0, affectedHere = false;
    Object.keys(obj || {}).forEach(function (path) {
      var entry = obj[path];
      var incoming = Array.isArray(entry) ? entry : (entry && entry.annotations) || [];
      if (!incoming.length) return;
      var existing = pageData(path);
      var byId = {};
      existing.forEach(function (a) { byId[a.id] = a; });
      incoming.forEach(function (a) {
        if (!a || !a.id) return;
        if (byId[a.id]) { Object.assign(byId[a.id], a); updated++; return; }
        var dup = existing.some(function (e) { return e.start === a.start && e.end === a.end && e.note === a.note; });
        if (dup) return;
        existing.push(a); byId[a.id] = a; added++;
      });
      try { localStorage.setItem(PREFIX + path, JSON.stringify(existing)); } catch (e) {}
      writeIndexEntry(path, entry && entry.title, existing);
      if (path === location.pathname) affectedHere = true;
      pages++;
    });
    // Tell this tab's annotate.js (if any) to re-render the current page.
    if (affectedHere) { try { window.dispatchEvent(new CustomEvent("marginalia:external")); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent("marginalia:change")); } catch (e) {}
    return { pages: pages, added: added, updated: updated };
  }
  function pickFile(cb) {
    var inp = el("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { cb(JSON.parse(reader.result)); }
        catch (e) { cb(null); }
      };
      reader.readAsText(f);
    });
    inp.click();
  }

  // ── the corner button ────────────────────────────────────────────────
  var btn = el("button", "md-fab");
  btn.type = "button";
  btn.setAttribute("aria-label", "Marked pages");
  btn.title = "Marked pages";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L7 20V5a1 1 0 0 1 1-1z"/>' +
    '<path d="M10 8.5h4M10 11.5h2.5"/></svg>';
  var badge = el("span", "md-badge");
  btn.appendChild(badge);
  document.body.appendChild(btn);

  // ── the portal ───────────────────────────────────────────────────────
  var portal = el("div", "md-portal");
  portal.setAttribute("role", "dialog");
  portal.setAttribute("aria-label", "Marked pages");
  document.body.appendChild(portal);
  var open = false;

  function render() {
    var list = entries();
    portal.innerHTML = "";

    var head = el("div", "md-head");
    var title = el("span"); title.textContent = "Marked pages";
    var close = el("button", "md-close");
    close.type = "button"; close.title = "Close"; close.setAttribute("aria-label", "Close"); close.textContent = "×";
    close.addEventListener("click", toggle);
    head.appendChild(title); head.appendChild(close);
    portal.appendChild(head);

    if (!list.length) {
      var em = el("div", "md-empty");
      em.textContent = "Nothing marked yet. Select text on any post and highlight it — marked pages collect here. Or import a saved notes file below.";
      portal.appendChild(em);
    } else {
      var ul = el("ul", "md-list");
      list.forEach(function (e) {
        var li = el("li", "md-item");
        if (e.path === location.pathname) li.classList.add("md-current");
        var a = el("a", "md-link");
        a.href = e.url || e.path;
        var t = el("span", "md-title"); t.textContent = e.title || e.path;
        var m = el("span", "md-meta");
        var marks = e.count + (e.count === 1 ? " mark" : " marks");
        var notes = e.notes ? " · " + e.notes + " note" + (e.notes === 1 ? "" : "s") : "";
        m.textContent = marks + notes + " · " + rel(e.updated);
        a.appendChild(t); a.appendChild(m);
        li.appendChild(a);
        ul.appendChild(li);
      });
      portal.appendChild(ul);
    }

    // ── export / import footer ──
    var foot = el("div", "md-foot");
    var actions = el("div", "md-actions");
    var exp = el("button", "md-btn"); exp.type = "button"; exp.textContent = "↓ Export";
    exp.title = "Download all annotations as a JSON file";
    exp.disabled = !list.length;
    exp.addEventListener("click", download);
    var imp = el("button", "md-btn"); imp.type = "button"; imp.textContent = "↑ Import";
    imp.title = "Load a notes file — merged into existing pages";
    var status = el("div", "md-status");
    imp.addEventListener("click", function () {
      pickFile(function (data) {
        if (!data || typeof data !== "object") { status.textContent = "Couldn't read that file."; return; }
        var r = importData(data);
        status.textContent = "Merged " + r.pages + " page" + (r.pages === 1 ? "" : "s") +
          " · " + r.added + " added, " + r.updated + " updated";
        render(); // refresh the list, then restore the status line
        var s2 = portal.querySelector(".md-status");
        if (s2) s2.textContent = status.textContent;
      });
    });
    actions.appendChild(exp); actions.appendChild(imp);
    foot.appendChild(actions); foot.appendChild(status);
    portal.appendChild(foot);
  }

  function setOpen(v) {
    open = v;
    if (open) render();
    portal.classList.toggle("on", open);
    btn.classList.toggle("on", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function toggle() { setOpen(!open); }

  function updateBadge() {
    var n = entries().length;
    badge.textContent = n;
    badge.style.display = n ? "" : "none";
    btn.classList.toggle("md-has", n > 0);
  }

  // ── wiring ───────────────────────────────────────────────────────────
  btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
  document.addEventListener("click", function (e) {
    if (open && !portal.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });
  // live-sync: same-tab edits (custom event) + other-tab edits (storage event)
  window.addEventListener("marginalia:change", function () { if (open) render(); updateBadge(); });
  window.addEventListener("storage", function (e) { if (e.key === IDX) { if (open) render(); updateBadge(); } });

  updateBadge();
})();
