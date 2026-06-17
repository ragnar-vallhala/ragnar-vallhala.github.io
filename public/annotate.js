/* marginalia — a reader's annotation layer.
 *
 * Select prose to highlight it in a colour or attach a note. Everything lives
 * in localStorage keyed to the page path: fully offline, no account, no
 * network. Highlights restore on reload; notes show in the right margin; and
 * printing drops the UI and renders the notes as numbered endnotes, so a
 * printed page reads like a marked-up paper.
 *
 * Anchoring is by character offset into the article text (stable for a static
 * page, and consistent even across the KaTeX/Mermaid DOM because we count the
 * same text nodes on save and on restore). No build step, no dependency.
 */
(function () {
  "use strict";

  var root = document.querySelector(".prose");
  if (!root) return;
  if (getComputedStyle(root).position === "static") root.style.position = "relative";

  var COLORS = [
    { id: "yellow", label: "Yellow" },
    { id: "green", label: "Green" },
    { id: "blue", label: "Blue" },
    { id: "pink", label: "Pink" },
    { id: "accent", label: "Terracotta" }
  ];
  var KEY = "marginalia:" + location.pathname;

  // ── storage ──────────────────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(anns.map(strip))); } catch (e) {}
    updateIndex();
  }
  function strip(a) { return { id: a.id, start: a.start, end: a.end, quote: a.quote, color: a.color, note: a.note }; }
  var anns = load();

  // A site-wide index of which pages carry annotations, read by the global
  // "marked pages" launcher (marked-docs.js). Keyed by path; updated time
  // drives the most-recently-used ordering there.
  var IDX = "marginalia:index";
  function pageTitle() {
    var h = document.querySelector(".post-title");
    return (h ? h.textContent : (document.title.split(" — ")[0] || document.title)).trim();
  }
  function updateIndex() {
    var idx;
    try { idx = JSON.parse(localStorage.getItem(IDX)) || {}; } catch (e) { idx = {}; }
    var path = location.pathname;
    if (!anns.length) {
      delete idx[path];
    } else {
      idx[path] = {
        path: path, url: path, title: pageTitle(),
        count: anns.length,
        notes: anns.filter(function (a) { return a.note; }).length,
        updated: Date.now()
      };
    }
    try { localStorage.setItem(IDX, JSON.stringify(idx)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("marginalia:change")); } catch (e) {}
  }

  function uid() { return "a" + Math.random().toString(36).slice(2, 9); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  // ── offsets ──────────────────────────────────────────────────────────
  // Global character offset of (container, offset) within the article. Uses a
  // range's text length so element boundaries resolve correctly; counts the
  // same characters the wrap() walker does.
  function offsetOf(container, offset) {
    var r = document.createRange();
    r.selectNodeContents(root);
    try { r.setEnd(container, offset); } catch (e) { return -1; }
    return r.toString().length;
  }

  function currentRange() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    var anc = r.commonAncestorContainer;
    var node = anc.nodeType === 1 ? anc : anc.parentNode;
    if (!root.contains(node)) return null;
    if (node.closest(".anno-ui, .anno-margin, .anno-flag, .katex, .mermaid, svg")) return null;
    return r;
  }

  // The last valid selection, captured as character offsets so a highlight can
  // be created even after the live selection collapses — which it does the
  // instant a finger taps anything on touch (and the OS copy/share/search menu
  // takes over). There is no reliable mouseup-with-selection on mobile.
  var pending = null;
  function captureRange() {
    var r = currentRange();
    if (!r) return null;
    var start = offsetOf(r.startContainer, r.startOffset);
    var end = offsetOf(r.endContainer, r.endOffset);
    if (start < 0 || end < 0) return null;
    if (end < start) { var t = start; start = end; end = t; }
    if (end - start < 1) return null;
    return { start: start, end: end, quote: r.toString().trim() };
  }

  // ── wrap / unwrap ────────────────────────────────────────────────────
  function wrap(a) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var pos = 0, node, targets = [];
    while ((node = w.nextNode())) {
      var len = node.nodeValue.length, ns = pos, ne = pos + len;
      if (ne > a.start && ns < a.end) {
        // Count every text node for offset stability, but never wrap inside
        // rendered math/diagrams — that would distort their layout.
        var skip = node.parentElement && node.parentElement.closest(".katex, .mermaid, svg");
        if (!skip) {
          var s = Math.max(0, a.start - ns), e = Math.min(len, a.end - ns);
          if (e > s) targets.push([node, s, e]);
        }
      }
      pos = ne;
      if (pos >= a.end) break;
    }
    var marks = [];
    for (var i = targets.length - 1; i >= 0; i--) {
      var t = targets[i], r = document.createRange();
      r.setStart(t[0], t[1]); r.setEnd(t[0], t[2]);
      var m = el("mark", "anno");
      m.dataset.id = a.id; m.dataset.color = a.color;
      try { r.surroundContents(m); marks.unshift(m); } catch (err) {}
    }
    return marks;
  }

  function clearLayer() {
    root.querySelectorAll(".anno-flag").forEach(function (n) { n.remove(); });
    var ml = root.querySelector(".anno-margin"); if (ml) ml.remove();
    root.querySelectorAll("mark.anno").forEach(function (m) {
      var p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
    root.normalize();
  }

  // ── render ───────────────────────────────────────────────────────────
  var margin = null;
  function renderAll() {
    clearLayer();
    anns.sort(function (a, b) { return a.start - b.start; });
    anns.forEach(function (a) { a._marks = wrap(a); });
    root.querySelectorAll("mark.anno").forEach(function (m) {
      m.addEventListener("click", function (e) { e.stopPropagation(); openPopover(m.dataset.id, m); });
    });
    // flags + margin notes for annotations that carry a note
    margin = el("div", "anno-margin anno-ui");
    root.appendChild(margin);
    var n = 0;
    anns.forEach(function (a) {
      if (!a.note || !a._marks.length) return;
      n++;
      var last = a._marks[a._marks.length - 1];
      var flag = el("sup", "anno-flag");
      flag.dataset.n = n; flag.dataset.id = a.id;
      flag.addEventListener("click", function (e) { e.stopPropagation(); openPopover(a.id, last); });
      last.appendChild(flag);
      var mn = el("aside", "anno-mnote");
      mn.dataset.color = a.color;
      var num = el("span", "anno-mnote-n"); num.textContent = n;
      var txt = el("span", "anno-mnote-t"); txt.textContent = a.note;
      mn.appendChild(num); mn.appendChild(txt);
      mn.addEventListener("click", function () { openPopover(a.id, last); });
      margin.appendChild(mn);
      a._note = mn; a._first = a._marks[0];
    });
    positionNotes();
    updateDock();
  }

  function positionNotes() {
    if (!margin) return;
    var pr = root.getBoundingClientRect();
    var used = [];
    anns.forEach(function (a) {
      if (!a._note || !a._first) return;
      var top = a._first.getBoundingClientRect().top - pr.top;
      // avoid overlap: keep a minimum gap from the previous note
      var prev = used.length ? used[used.length - 1] : -1e9;
      if (top < prev + 46) top = prev + 46;
      used.push(top);
      a._note.style.top = top + "px";
    });
  }

  // ── create from selection ────────────────────────────────────────────
  function addFromSelection(color, withNote) {
    var sel = pending || captureRange();
    if (!sel) return;
    var a = { id: uid(), start: sel.start, end: sel.end, quote: sel.quote, color: color, note: "" };
    anns.push(a);
    pending = null;
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    hideBar();
    renderAll();
    persist();
    if (withNote) openPopover(a.id, document.querySelector('mark.anno[data-id="' + a.id + '"]'));
  }

  function removeAnn(id) {
    anns = anns.filter(function (a) { return a.id !== id; });
    renderAll(); persist(); closePopover();
  }
  function recolor(id, color) {
    var a = find(id); if (!a) return; a.color = color; renderAll(); persist();
  }
  function setNote(id, note) {
    var a = find(id); if (!a) return; a.note = note; renderAll(); persist();
  }
  function find(id) { for (var i = 0; i < anns.length; i++) if (anns[i].id === id) return anns[i]; return null; }

  // ── selection toolbar ────────────────────────────────────────────────
  // Coarse pointer (touch): the OS owns the selection callout, so float-over
  // positioning loses to it. We dock the toolbar to a bottom "tray" instead
  // and drive it from selectionchange rather than mouseup.
  var coarse = false;
  try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}

  var bar = el("div", "anno-bar anno-ui");
  bar.addEventListener("mousedown", function (e) { e.preventDefault(); }); // keep the selection
  COLORS.forEach(function (c) {
    var b = el("button", "anno-sw"); b.dataset.color = c.id; b.title = "Highlight " + c.label;
    b.addEventListener("click", function () { addFromSelection(c.id, false); });
    bar.appendChild(b);
  });
  var nb = el("button", "anno-bar-note"); nb.textContent = "✎ note";
  nb.addEventListener("click", function () { addFromSelection(COLORS[0].id, true); });
  bar.appendChild(nb);
  // Tray dismiss — touch only (Escape / click-away covers the desktop).
  var xb = el("button", "anno-bar-x"); xb.textContent = "✕"; xb.title = "Dismiss";
  xb.addEventListener("click", function () {
    pending = null;
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    hideBar();
  });
  bar.appendChild(xb);
  document.body.appendChild(bar);

  function hideBar() { bar.classList.remove("on"); }
  function showBar() {
    var sel = pending || captureRange();
    if (!sel) { hideBar(); return; }
    bar.classList.add("on");
    // Touch: pin to the bottom tray, clear of the native selection menu.
    if (coarse) { bar.classList.add("anno-bar--tray"); bar.style.top = ""; bar.style.left = ""; return; }
    // Desktop: float just above the live selection.
    var r = currentRange();
    if (!r) return;
    var rect = r.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    var bw = bar.offsetWidth, bh = bar.offsetHeight;
    var top = window.scrollY + rect.top - bh - 9;
    var left = window.scrollX + rect.left + rect.width / 2 - bw / 2;
    var max = window.scrollX + document.documentElement.clientWidth - bw - 8;
    left = Math.max(window.scrollX + 8, Math.min(left, max));
    if (top < window.scrollY + 4) top = window.scrollY + rect.bottom + 9;
    bar.style.top = top + "px"; bar.style.left = left + "px";
  }

  // ── per-highlight popover ────────────────────────────────────────────
  var pop = el("div", "anno-pop anno-ui");
  pop.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  document.body.appendChild(pop);
  var popId = null;
  function openPopover(id, anchor) {
    var a = find(id); if (!a || !anchor) return;
    popId = id;
    pop.innerHTML = "";
    var row = el("div", "anno-pop-row");
    COLORS.forEach(function (c) {
      var b = el("button", "anno-sw"); b.dataset.color = c.id;
      if (c.id === a.color) b.classList.add("sel");
      b.title = c.label;
      b.addEventListener("click", function () { recolor(id, c.id); openPopover(id, document.querySelector('mark.anno[data-id="' + id + '"]')); });
      row.appendChild(b);
    });
    var del = el("button", "anno-pop-del"); del.textContent = "Delete"; del.title = "Remove highlight";
    del.addEventListener("click", function () { removeAnn(id); });
    row.appendChild(del);
    pop.appendChild(row);
    var ta = el("textarea", "anno-pop-note");
    ta.placeholder = "Add a note…"; ta.value = a.note || "";
    ta.addEventListener("input", function () { setNote(id, ta.value); });
    ta.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    pop.appendChild(ta);
    pop.classList.add("on");
    var rect = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var top = window.scrollY + rect.bottom + 8;
    var left = window.scrollX + rect.left;
    var max = window.scrollX + document.documentElement.clientWidth - pw - 8;
    left = Math.max(window.scrollX + 8, Math.min(left, max));
    if (rect.bottom + ph + 16 > window.innerHeight) top = window.scrollY + rect.top - ph - 8;
    pop.style.top = top + "px"; pop.style.left = left + "px";
    ta.focus();
  }
  function closePopover() { pop.classList.remove("on"); popId = null; }

  // ── dock ─────────────────────────────────────────────────────────────
  var dock = el("div", "anno-dock anno-ui");
  var count = el("span", "anno-dock-count");
  var bToggle = el("button", "anno-dock-btn"); bToggle.textContent = "Hide"; bToggle.title = "Show / hide highlights";
  var bPrint = el("button", "anno-dock-btn"); bPrint.textContent = "Print"; bPrint.title = "Print with annotations";
  var bClear = el("button", "anno-dock-btn"); bClear.textContent = "Clear"; bClear.title = "Remove all annotations on this page";
  dock.appendChild(count); dock.appendChild(bToggle); dock.appendChild(bPrint); dock.appendChild(bClear);
  document.body.appendChild(dock);
  var hidden = false;
  bToggle.addEventListener("click", function () {
    hidden = !hidden;
    root.classList.toggle("anno-off", hidden);
    bToggle.textContent = hidden ? "Show" : "Hide";
  });
  bPrint.addEventListener("click", function () { window.print(); });
  bClear.addEventListener("click", function () {
    if (!anns.length) return;
    if (!confirm("Remove all " + anns.length + " annotation(s) on this page?")) return;
    anns = []; renderAll(); persist(); closePopover();
  });
  function updateDock() {
    var notes = anns.filter(function (a) { return a.note; }).length;
    if (!anns.length) {
      count.textContent = "select text to annotate";
    } else {
      count.textContent = anns.length + (anns.length === 1 ? " mark" : " marks") +
        (notes ? " · " + notes + " note" + (notes === 1 ? "" : "s") : "");
    }
    dock.classList.toggle("empty", anns.length === 0);
  }

  // ── print endnotes ───────────────────────────────────────────────────
  var printSec = null;
  function buildPrint() {
    removePrint();
    var noted = anns.filter(function (a) { return a.note; });
    if (!noted.length) return;
    printSec = el("section", "anno-endnotes");
    var h = el("h2"); h.textContent = "Reader's notes"; printSec.appendChild(h);
    var ol = el("ol");
    noted.forEach(function (a, i) {
      var li = el("li");
      var q = el("span", "anno-en-q"); q.textContent = "“" + a.quote + "” — ";
      var t = el("span", "anno-en-t"); t.textContent = a.note;
      li.appendChild(q); li.appendChild(t); ol.appendChild(li);
    });
    printSec.appendChild(ol);
    var article = root.closest("article") || root;
    article.appendChild(printSec);
  }
  function removePrint() { if (printSec) { printSec.remove(); printSec = null; } }
  window.addEventListener("beforeprint", buildPrint);
  window.addEventListener("afterprint", removePrint);

  // ── events ───────────────────────────────────────────────────────────
  document.addEventListener("mouseup", function () { setTimeout(showBar, 0); });
  document.addEventListener("keyup", function (e) { if (e.key !== "Escape") setTimeout(showBar, 0); });
  // Touch has no mouseup-with-selection; selectionchange is the reliable
  // signal. Capture the range while it's valid so a tap on the tray can use it
  // even after the selection collapses. We don't clear a captured selection on
  // collapse — the user is likely reaching for a swatch.
  var selTimer = null;
  document.addEventListener("selectionchange", function () {
    if (selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var cap = captureRange();
      if (cap) { pending = cap; if (coarse) showBar(); }
    }, 100);
  });
  document.addEventListener("mousedown", function (e) {
    if (!bar.contains(e.target)) { pending = null; hideBar(); }
    if (!pop.contains(e.target) && !(e.target.closest && e.target.closest("mark.anno, .anno-flag, .anno-mnote"))) closePopover();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { pending = null; hideBar(); closePopover(); } });
  window.addEventListener("resize", function () { positionNotes(); });
  window.addEventListener("scroll", function () { if (bar.classList.contains("on")) showBar(); }, { passive: true });

  // ── go ───────────────────────────────────────────────────────────────
  // Mermaid renders client-side and rewrites .prose text, which would shift
  // our character offsets. Wait until every diagram is processed (or a few
  // seconds pass) before the first restore so offsets are stable.
  function whenReady(cb) {
    var pres = root.querySelectorAll(".mermaid");
    if (!pres.length) return cb();
    var tries = 0;
    (function check() {
      var done = true;
      pres.forEach(function (p) {
        if (!p.querySelector("svg") && !p.hasAttribute("data-processed")) done = false;
      });
      if (done || tries++ > 60) cb();
      else setTimeout(check, 100);
    })();
  }
  whenReady(function () { renderAll(); if (anns.length) updateIndex(); /* bump "recently used" on visit */ });
  // Late layout shifts (font swap, image/SVG load) move the marks; realign.
  window.addEventListener("load", function () { setTimeout(positionNotes, 200); });
})();
