// Local server for the Composer editor.
//   node editor-server.js   →   http://localhost:4322/editor.html
//
// Serves the project root (so the editor can load src/styles.css) and
// exposes POST /save to write a post straight into content/<section>/.
// Local authoring only — never deploy this.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4322;
const SECTIONS = new Set(["engineering", "essays"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

const safeSlug = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");

const server = createServer((req, res) => {
  // ── save endpoint ──
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (obj, code = 200) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      try {
        const { section, slug, markdown } = JSON.parse(body);
        if (!SECTIONS.has(section)) return json({ ok: false, error: "bad section" }, 400);
        const name = safeSlug(slug);
        if (!name) return json({ ok: false, error: "empty title/slug" }, 400);
        if (typeof markdown !== "string" || !markdown.trim())
          return json({ ok: false, error: "empty body" }, 400);

        const dir = path.join(ROOT, "content", section);
        fs.mkdirSync(dir, { recursive: true });
        const rel = `${section}/${name}.md`;
        fs.writeFileSync(path.join(dir, `${name}.md`), markdown);
        console.log("› saved content/" + rel);
        json({ ok: true, path: rel });
      } catch (e) {
        json({ ok: false, error: e.message }, 400);
      }
    });
    return;
  }

  // ── static files (rooted at project, no traversal) ──
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/editor.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html" });
      return res.end("<h1>404</h1>");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`› Composer at http://localhost:${PORT}/editor.html`);
  console.log("  (Ctrl-C to stop. Saves go into content/. Don't deploy this server.)");
});
