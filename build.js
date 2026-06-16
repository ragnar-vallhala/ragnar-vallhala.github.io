// ──────────────────────────────────────────────────────────────
//  BUILD  —  turns Markdown in /content into a static site in /dist
//
//    node build.js            build once
//    node build.js --watch    rebuild on file changes
//    node build.js --serve    also start a local preview server
// ──────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

import matter from "gray-matter";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import katex from "katex";

import site from "./site.config.js";
import * as T from "./src/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content");
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");

// Writing sections. Add another entry here to spin up a new section:
// a content/<dir> folder, a /<route>/ listing, and a nav link all follow.
const SECTIONS = [
  {
    key: "engineering",
    dir: "engineering",
    route: "engineering",
    title: "Engineering",
    label: "eng",
    sub: "Notes from building systems — embedded, RTOS, and computer architecture.",
  },
  {
    key: "essays",
    dir: "essays",
    route: "essays",
    title: "Essays",
    label: "essay",
    sub: "Reading and writing on philosophy, politics, and sociology.",
  },
];

const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const SERVE = args.includes("--serve");
const PORT = 4321;

// ── Markdown engine ────────────────────────────────────────────
const marked = new Marked();
marked.setOptions({ gfm: true, breaks: false });

// One code renderer handles both: ```mermaid → a <pre class="mermaid">
// for client-side rendering; everything else → highlight.js. (Done here
// rather than via marked-highlight so the two don't fight over renderer.code.)
marked.use({
  renderer: {
    code(codeOrToken, infostring) {
      let text, lang;
      if (codeOrToken && typeof codeOrToken === "object") {
        text = codeOrToken.text;
        lang = codeOrToken.lang;
      } else {
        text = codeOrToken;
        lang = infostring;
      }
      lang = (lang || "").trim().split(/\s+/)[0];
      if (lang === "mermaid") {
        const e = String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<pre class="mermaid">${e}</pre>\n`;
      }
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      const html = hljs.highlight(String(text), { language }).value;
      return `<pre><code class="hljs language-${language}">${html}</code></pre>\n`;
    },
  },
});

// Render $...$ (inline) and $$...$$ (display) math with KaTeX at build time.
// Math inside code (fenced or inline) is left untouched. Returns HTML.
function mdToHtml(content) {
  const code = [];
  // mask code first so a stray $ inside it is never treated as math
  let src = content
    .replace(/```[\s\S]*?```/g, (m) => `xxCODE${code.push(m) - 1}xx`)
    .replace(/`[^`\n]*`/g, (m) => `xxCODE${code.push(m) - 1}xx`);

  const math = [];
  const render = (tex, displayMode) =>
    `xxMATH${math.push(katex.renderToString(tex.trim(), { displayMode, throwOnError: false })) - 1}xx`;

  src = src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => render(tex, true))
    .replace(/(?<!\\)\$(?!\s)([^\n$]+?)(?<!\s)\$/g, (_, tex) => render(tex, false))
    .replace(/xxCODE(\d+)xx/g, (_, i) => code[+i]);

  let html = marked.parse(src);
  // unwrap display math that marked parked inside its own <p>
  html = html
    .replace(/<p>(xxMATH\d+xx)<\/p>/g, "$1")
    .replace(/xxMATH(\d+)xx/g, (_, i) => math[+i]);
  // wrap tables so wide ones scroll horizontally instead of cramming
  html = html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
  return html;
}

const log = (...m) => console.log("›", ...m);

// ── Helpers ────────────────────────────────────────────────────
function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function ensure(p) {
  fs.mkdirSync(p, { recursive: true });
}
function write(rel, html) {
  const out = path.join(DIST, rel);
  ensure(path.dirname(out));
  fs.writeFileSync(out, html);
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensure(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function slugify(name) {
  return name
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Vendor KaTeX's stylesheet + woff2 fonts into dist/katex/ so math pages
// work offline with no CDN. Only woff2 is copied (every modern browser).
function copyKatex() {
  const srcDir = path.join(ROOT, "node_modules", "katex", "dist");
  if (!fs.existsSync(srcDir)) return;
  const outDir = path.join(DIST, "katex");
  ensure(path.join(outDir, "fonts"));
  fs.copyFileSync(path.join(srcDir, "katex.min.css"), path.join(outDir, "katex.min.css"));
  const fontDir = path.join(srcDir, "fonts");
  for (const f of fs.readdirSync(fontDir)) {
    if (f.endsWith(".woff2"))
      fs.copyFileSync(path.join(fontDir, f), path.join(outDir, "fonts", f));
  }
}

// ── Load posts from a content section ──────────────────────────
function loadPosts(section) {
  const dir = path.join(CONTENT, section.dir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      if (data.draft) return null;
      const words = content.trim().split(/\s+/).length;
      return {
        slug: data.slug || slugify(file),
        title: data.title || slugify(file).replace(/-/g, " "),
        date: data.date || null,
        description: data.description || "",
        tags: data.tags || [],
        readingTime: Math.max(1, Math.round(words / 200)),
        html: mdToHtml(content),
        // section context, used for links + labels
        route: section.route,
        sectionTitle: section.title,
        sectionKey: section.key,
        sectionLabel: section.label,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

// ── Build everything ───────────────────────────────────────────
function build() {
  const start = Date.now();
  rmrf(DIST);
  ensure(DIST);

  // styles + static assets
  fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
  copyDir(PUBLIC, DIST);
  copyKatex();

  // load every section
  const bySection = SECTIONS.map((s) => ({ section: s, posts: loadPosts(s) }));
  const allPosts = bySection
    .flatMap((s) => s.posts)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // home — recent across all sections, each tagged with its section
  write("index.html", T.home({ site, posts: allPosts, base: "" }));

  // one listing + post pages per section
  let postCount = 0;
  for (const { section, posts } of bySection) {
    write(
      `${section.route}/index.html`,
      T.listing({ site, section, posts, base: "../" })
    );
    for (const p of posts) {
      write(
        `${section.route}/${p.slug}/index.html`,
        T.post({ site, post: p, html: p.html, base: "../../" })
      );
      postCount++;
    }
  }

  // about page (from content/about.md if present)
  const aboutPath = path.join(CONTENT, "about.md");
  if (fs.existsSync(aboutPath)) {
    const { data, content } = matter(fs.readFileSync(aboutPath, "utf8"));
    write(
      "about/index.html",
      T.page({
        site,
        title: data.title || "About",
        html: mdToHtml(content),
        base: "../",
        active: "about",
        path: "about/",
        image: data.image,
        imageAlt: data.imageAlt,
        caption: data.caption,
      })
    );
  }

  // tag pages — one per tag, plus a /tags/ index
  const tagMap = new Map(); // tag -> posts[]
  for (const p of allPosts)
    for (const t of p.tags || []) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t).push(p);
    }
  const tagList = [...tagMap.entries()]
    .map(([tag, posts]) => ({ tag, count: posts.length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  write("tags/index.html", T.tagsIndex({ site, tags: tagList, base: "../" }));
  for (const [tag, posts] of tagMap) {
    write(
      `tags/${T.slugifyTag(tag)}/index.html`,
      T.tagListing({ site, tag, posts, base: "../../" })
    );
  }

  // feed.xml, sitemap.xml, robots.txt
  writeFeed(allPosts);
  writeSitemap(allPosts, bySection, tagList);
  writeRobots();

  log(`built ${postCount} post${postCount === 1 ? "" : "s"}, ${tagList.length} tags → dist/ in ${Date.now() - start}ms`);
}

// ── RSS / sitemap / robots ─────────────────────────────────────
const xmlEsc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function writeFeed(posts) {
  const self = T.abs(site, "feed.xml");
  const items = posts
    .map((p) => {
      const url = T.abs(site, `${p.route}/${p.slug}/`);
      const pub = p.date ? new Date(p.date).toUTCString() : "";
      return `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${xmlEsc(url)}</link>
      <guid isPermaLink="true">${xmlEsc(url)}</guid>
      ${pub ? `<pubDate>${pub}</pubDate>` : ""}
      <category>${xmlEsc(p.sectionTitle)}</category>
      ${p.description ? `<description>${xmlEsc(p.description)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(site.name)}</title>
    <link>${xmlEsc(T.abs(site, ""))}</link>
    <description>${xmlEsc(site.intro)}</description>
    <language>en</language>
    <atom:link href="${xmlEsc(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  write("feed.xml", xml);
}

function writeSitemap(posts, bySection, tagList) {
  const urls = ["", "about/", "tags/"];
  for (const { section } of bySection) urls.push(`${section.route}/`);
  for (const p of posts) urls.push(`${p.route}/${p.slug}/`);
  for (const t of tagList) urls.push(`tags/${T.slugifyTag(t.tag)}/`);

  const body = urls
    .map((u) => `  <url><loc>${xmlEsc(T.abs(site, u))}</loc></url>`)
    .join("\n");
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
  );
}

function writeRobots() {
  const lines = ["User-agent: *", "Allow: /"];
  if (site.url) lines.push(`Sitemap: ${T.abs(site, "sitemap.xml")}`);
  write("robots.txt", lines.join("\n") + "\n");
}

build();

// ── Watch ──────────────────────────────────────────────────────
if (WATCH) {
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (e) {
        console.error("✗ build failed:", e.message);
      }
    }, 80);
  };
  for (const dir of [CONTENT, path.join(ROOT, "src"), PUBLIC]) {
    if (fs.existsSync(dir)) fs.watch(dir, { recursive: true }, rebuild);
  }
  fs.watchFile(path.join(ROOT, "site.config.js"), rebuild);
  log("watching for changes… (Ctrl-C to stop)");
}

// ── Serve ──────────────────────────────────────────────────────
if (SERVE) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };
  createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(DIST, urlPath);
    if (urlPath.endsWith("/")) file = path.join(file, "index.html");
    else if (!path.extname(file)) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404</h1>");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(PORT, () => log(`serving http://localhost:${PORT}`));
}
