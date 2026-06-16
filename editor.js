// Composer — a WYSIWYG authoring tool for the site.
// You write rich text in the site's own typography; this emits Markdown.
// It is NOT part of the built site (lives at the project root).

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");

// Prefer real tags (<b>, <i>) over inline styles, so conversion is clean.
try { document.execCommand("styleWithCSS", false, false); } catch {}

// default date = today (YYYY-MM-DD, local)
(() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("f-date").value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

// ── Toolbar ────────────────────────────────────────────────────
$("toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  e.preventDefault();
  canvas.focus();

  if (btn.dataset.cmd) {
    document.execCommand(btn.dataset.cmd, false, null);
  } else if (btn.dataset.block) {
    document.execCommand("formatBlock", false, btn.dataset.block);
  } else {
    ({
      link: insertLink,
      code: () => wrapInline("code"),
      codeblock: () => document.execCommand("formatBlock", false, "PRE"),
      hr: () => document.execCommand("insertHorizontalRule", false, null),
      image: insertImage,
      table: insertTable,
    })[btn.dataset.action]?.();
  }
  sync();
});

// keyboard: Ctrl/Cmd+K for link (bold/italic already work natively)
canvas.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    insertLink();
    sync();
  }
});

function insertLink() {
  const url = prompt("Link URL:", "https://");
  if (url) document.execCommand("createLink", false, url);
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function insertImage() {
  const url = prompt("Image URL or path:", "");
  if (!url) return;
  const alt = prompt("Alt text (description):", "") || "";
  document.execCommand("insertHTML", false, `<p><img src="${escAttr(url)}" alt="${escAttr(alt)}"></p>`);
}

function insertTable() {
  const cols = parseInt(prompt("Number of columns:", "3"), 10);
  const rows = parseInt(prompt("Number of rows (including header):", "3"), 10);
  if (!cols || !rows || cols < 1 || rows < 1) return;
  let html = "<table><thead><tr>";
  for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
  html += "</tr></thead><tbody>";
  for (let r = 1; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) html += "<td>—</td>";
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  document.execCommand("insertHTML", false, html);
}

// wrap the current selection in an inline tag (used for <code>)
function wrapInline(tag) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const el = document.createElement(tag);
  try {
    el.appendChild(range.extractContents());
    range.insertNode(el);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(el);
    sel.addRange(r);
  } catch {}
}

// ── HTML → Markdown ────────────────────────────────────────────
function inlineMd(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += n.textContent;
    } else if (n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      const inner = inlineMd(n);
      if (tag === "strong" || tag === "b") out += inner.trim() ? `**${inner}**` : "";
      else if (tag === "em" || tag === "i") out += inner.trim() ? `*${inner}*` : "";
      else if (tag === "code") out += "`" + n.textContent + "`";
      else if (tag === "a") out += `[${inner}](${n.getAttribute("href") || ""})`;
      else if (tag === "img")
        out += `![${n.getAttribute("alt") || ""}](${n.getAttribute("src") || ""})`;
      else if (tag === "br") out += "\n";
      else out += inner;
    }
  });
  return out;
}

function blockMd(node, lines) {
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      const t = n.textContent.trim();
      if (t) lines.push(t, "");
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();

    if (tag === "h2") lines.push("## " + inlineMd(n).trim(), "");
    else if (tag === "h3") lines.push("### " + inlineMd(n).trim(), "");
    else if (tag === "h4") lines.push("#### " + inlineMd(n).trim(), "");
    else if (tag === "p" || tag === "div") {
      const t = inlineMd(n).replace(/\n+$/, "").trim();
      if (t) lines.push(t, "");
    } else if (tag === "blockquote") {
      inlineMd(n)
        .trim()
        .split("\n")
        .forEach((l) => lines.push("> " + l.trim()));
      lines.push("");
    } else if (tag === "ul") {
      n.querySelectorAll(":scope > li").forEach((li) =>
        lines.push("- " + inlineMd(li).trim())
      );
      lines.push("");
    } else if (tag === "ol") {
      let i = 1;
      n.querySelectorAll(":scope > li").forEach((li) =>
        lines.push(`${i++}. ` + inlineMd(li).trim())
      );
      lines.push("");
    } else if (tag === "pre") {
      lines.push("```", n.textContent.replace(/\n$/, ""), "```", "");
    } else if (tag === "hr") {
      lines.push("---", "");
    } else if (tag === "img") {
      lines.push(`![${n.getAttribute("alt") || ""}](${n.getAttribute("src") || ""})`, "");
    } else if (tag === "table") {
      tableMd(n).forEach((l) => lines.push(l));
    } else {
      blockMd(n, lines); // recurse through wrappers
    }
  });
}

// GFM table: first row is the header, then a --- separator, then the body.
function tableMd(table) {
  const rows = [...table.querySelectorAll("tr")];
  if (!rows.length) return [];
  const cells = (tr) =>
    [...tr.children].map((c) => inlineMd(c).trim().replace(/\|/g, "\\|") || " ");
  const head = cells(rows[0]);
  const out = ["| " + head.join(" | ") + " |", "| " + head.map(() => "---").join(" | ") + " |"];
  for (let i = 1; i < rows.length; i++) out.push("| " + cells(rows[i]).join(" | ") + " |");
  out.push("");
  return out;
}

function bodyMarkdown() {
  const lines = [];
  blockMd(canvas, lines);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Frontmatter + assembly ─────────────────────────────────────
function slugify(s) {
  return (s || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function frontmatter() {
  const title = $("f-title").value.trim();
  const date = $("f-date").value;
  const desc = $("f-desc").value.trim();
  const tags = $("f-tags").value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const draft = $("f-draft").checked;

  const fm = ["---"];
  fm.push(`title: ${title || "Untitled"}`);
  if (date) fm.push(`date: ${date}`);
  if (desc) fm.push(`description: ${desc}`);
  if (tags.length) fm.push(`tags: [${tags.join(", ")}]`);
  if (draft) fm.push(`draft: true`);
  fm.push("---");
  return fm.join("\n");
}

function fullMarkdown() {
  return frontmatter() + "\n\n" + bodyMarkdown() + "\n";
}

function targetPath() {
  return `${$("f-section").value}/${slugify($("f-title").value)}.md`;
}

// ── Live sync ──────────────────────────────────────────────────
function sync() {
  $("md-out").textContent = fullMarkdown();
  $("filename").textContent = targetPath();
}
canvas.addEventListener("input", sync);
["f-title", "f-date", "f-desc", "f-tags", "f-section", "f-draft"].forEach((id) =>
  $(id).addEventListener("input", sync)
);

// ── Toast ──────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ── Actions ────────────────────────────────────────────────────
$("btn-copy").addEventListener("click", async () => {
  const md = fullMarkdown();
  try {
    await navigator.clipboard.writeText(md);
    toast("Markdown copied");
  } catch {
    $("md-out").parentElement.open = true;
    toast("Copy failed — grab it from the panel below");
  }
});

$("btn-download").addEventListener("click", () => {
  const blob = new Blob([fullMarkdown()], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slugify($("f-title").value) + ".md";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Downloaded " + a.download);
});

$("btn-save").addEventListener("click", async () => {
  if (location.protocol === "file:") {
    toast("Run `npm run edit` to save into content/ (downloading instead)");
    $("btn-download").click();
    return;
  }
  try {
    const res = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: $("f-section").value,
        slug: slugify($("f-title").value),
        markdown: fullMarkdown(),
      }),
    });
    const data = await res.json();
    if (data.ok) toast("Saved → content/" + data.path);
    else toast("Save failed: " + (data.error || "unknown"));
  } catch (e) {
    toast("Save failed: " + e.message);
  }
});

sync();
