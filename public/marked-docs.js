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
      em.textContent = "Nothing marked yet. Select text on any post and highlight it — marked pages collect here.";
      portal.appendChild(em);
      return;
    }

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
