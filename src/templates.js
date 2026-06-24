// HTML templates. Each function returns a string of HTML.
// The `base` layout wraps every page; the others fill in `main`.

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Pretty date: "June 15, 2026"
export const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

// Short date for lists: "2026 · 06"
export const yearOf = (d) => (d ? new Date(d).getUTCFullYear() : "");

// Absolute URL for a site-root-relative path, using site.url if set.
export const abs = (site, p = "") => {
  const root = (site.url || "").replace(/\/$/, "");
  const clean = String(p).replace(/^\//, "");
  return root ? `${root}/${clean}` : `/${clean}`;
};

export const slugifyTag = (t) =>
  String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function nav(site, base, active) {
  const item = (href, label, key) =>
    `<a href="${base}${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `
    <header class="site-head">
      <a class="brand" href="${base}">${esc(site.name)}<span class="brand-dot">.</span></a>
      <nav class="site-nav">
        ${item("", "Home", "home")}
        ${item("engineering/", "Engineering", "engineering")}
        ${item("essays/", "Essays", "essays")}
        ${item("about/", "About", "about")}
      </nav>
    </header>`;
}

function footer(site) {
  const links = (site.links || [])
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join("");
  const rss = `<a href="${esc(abs(site, "feed.xml"))}" title="Subscribe via RSS">RSS</a>`;
  return `
    <footer class="site-foot">
      <div class="foot-links">${links}${rss}</div>
      <p class="foot-meta">© ${site.year} ${esc(site.name)}. Made by hand with Markdown.</p>
    </footer>`;
}

export function base({
  site,
  title,
  description,
  main,
  base: b = "",
  active,
  extraHead = "",
  path = "",
  ogType = "website",
  jsonLd = null,
}) {
  const fullTitle = title ? `${esc(title)} — ${esc(site.name)}` : esc(site.name);
  const desc = esc(description || site.intro);
  const canonical = site.url ? abs(site, path) : "";
  const jsonLdTag = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";
  const mermaidTag = main.includes('class="mermaid"') ? MERMAID_SCRIPT : "";
  const katexTag = main.includes('class="katex') ? KATEX_CSS(b) : "";
  // Reader's annotation layer — only on article pages (posts).
  const annotateTag = ogType === "article" ? `<script src="${b}annotate.js" defer></script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}" />
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : ""}
  <meta property="og:title" content="${fullTitle}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="${ogType}" />
  ${canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : ""}
  <meta property="og:site_name" content="${esc(site.name)}" />
  <meta name="twitter:card" content="summary" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,400&family=Spline+Sans+Mono:wght@400;500&family=Tiro+Devanagari+Sanskrit:ital@0;1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${b}styles.css" />
  <link rel="icon" type="image/svg+xml" href="${b}favicon.svg" />
  <link rel="alternate" type="application/rss+xml" title="${esc(site.name)} — feed" href="${b}feed.xml" />
  ${katexTag}
  ${jsonLdTag}
  ${extraHead}
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  ${nav(site, b, active)}
  <main class="site-main">
    ${main}
  </main>
  ${footer(site)}
  ${mermaidTag}
  ${annotateTag}
  <script src="${b}marked-docs.js" defer></script>
</body>
</html>`;
}

// KaTeX stylesheet — math is rendered to HTML at build time, so only the
// CSS (fonts + layout) is needed. Loaded only on pages that contain math.
const KATEX_CSS = (b = "") => `<link rel="stylesheet" href="${b}katex/katex.min.css" />`;

// Mermaid loader — themed to the site palette, follows light/dark.
const MERMAID_SCRIPT = `<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const ink = dark ? "#ece4d4" : "#211e1a";
  const accent = dark ? "#e07a4e" : "#b4451f";
  const paper = dark ? "#1a1815" : "#f6f2e9";
  const panel = dark ? "#211e1a" : "#efe9db";
  const rule = dark ? "#38332c" : "#d8d0bf";
  // second plot color (slate) so before/after series are distinguishable
  const accent2 = dark ? "#8fb4c8" : "#3f6b86";
  mermaid.initialize({
    startOnLoad: true,
    securityLevel: "loose",
    fontFamily: "Spline Sans Mono, ui-monospace, monospace",
    theme: "base",
    themeVariables: {
      background: paper, primaryColor: panel, secondaryColor: panel, tertiaryColor: panel,
      primaryBorderColor: rule, lineColor: accent, primaryTextColor: ink, textColor: ink,
      titleColor: ink,
      xyChart: {
        backgroundColor: "transparent", titleColor: ink,
        xAxisLabelColor: ink, yAxisLabelColor: ink, xAxisTitleColor: ink, yAxisTitleColor: ink,
        xAxisLineColor: rule, yAxisLineColor: rule, plotColorPalette: accent + ", " + accent2
      }
    }
  });
</script>`;

// ── Home ───────────────────────────────────────────────────────
export function home({ site, posts, base: b = "" }) {
  const recent = posts.slice(0, 4);

  const postRows = recent
    .map(
      (p) => `
      <li class="entry">
        <a class="entry-link" href="${b}${p.route}/${p.slug}/">
          <span class="entry-title">${esc(p.title)}</span>
          <span class="entry-rule"></span>
          <span class="entry-meta"><span class="entry-kind">${esc(p.sectionLabel || "")}</span><time class="entry-date">${fmtDate(p.date)}</time></span>
        </a>
        ${p.description ? `<p class="entry-desc">${esc(p.description)}</p>` : ""}
      </li>`
    )
    .join("");

  const projectCards = (site.projects || [])
    .map(
      (proj) => `
      <li class="project">
        <a class="project-link" href="${esc(proj.href)}">
          <div class="project-top">
            <h3 class="project-title">${esc(proj.title)}</h3>
            <span class="project-year">${esc(proj.year)}</span>
          </div>
          <p class="project-blurb">${esc(proj.blurb)}</p>
          <ul class="tags">${(proj.tags || [])
            .map((t) => `<li>${esc(t)}</li>`)
            .join("")}</ul>
        </a>
      </li>`
    )
    .join("");

  const main = `
    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">${esc(site.role)}</p>
        <h1 class="hero-name">${esc(site.name).replace(/ /, "<br>")}</h1>
        <p class="hero-intro">${site.intro}</p>
        ${
          site.epigraph
            ? `<blockquote class="hero-shloka">
          <p class="shloka-deva" lang="sa">${esc(site.epigraph.sanskrit)}</p>
          ${site.epigraph.translit ? `<p class="shloka-translit">${esc(site.epigraph.translit)}</p>` : ""}
          ${site.epigraph.gloss ? `<p class="shloka-gloss">${esc(site.epigraph.gloss)}</p>` : ""}
          ${
            site.epigraph.citation
              ? `<cite>${
                  site.epigraph.href
                    ? `<a href="${esc(site.epigraph.href)}">${esc(site.epigraph.citation)} <span aria-hidden="true">↗</span></a>`
                    : esc(site.epigraph.citation)
                }</cite>`
              : ""
          }
        </blockquote>`
            : ""
        }
        <div class="hero-links">
          ${(site.links || [])
            .map((l) => `<a href="${esc(l.href)}">${esc(l.label)} <span aria-hidden="true">↗</span></a>`)
            .join("")}
        </div>
      </div>
      <figure class="hero-media">
        <img src="${b}hero.png" width="832" height="1208" decoding="async"
             alt="The Farnese Atlas — a Roman marble of Atlas bearing the celestial sphere" />
        <figcaption>Farnese Atlas</figcaption>
      </figure>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>Selected Work</h2>
        <span class="block-num">01</span>
      </div>
      <ul class="projects">${projectCards}</ul>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>Recent Writing</h2>
        <span class="block-num">02</span>
      </div>
      <ul class="entries">${postRows || `<li class="empty">No posts yet. The first one is on its way.</li>`}</ul>
      <div class="more-row">
        <a class="more" href="${b}engineering/">Engineering <span aria-hidden="true">→</span></a>
        <a class="more" href="${b}essays/">Essays <span aria-hidden="true">→</span></a>
        <a class="more" href="${b}tags/">Tags <span aria-hidden="true">→</span></a>
      </div>
    </section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    description: site.role,
    ...(site.url ? { url: site.url } : {}),
    sameAs: (site.links || [])
      .map((l) => l.href)
      .filter((h) => /^https?:/.test(h)),
  };

  return base({ site, main, base: b, active: "home", path: "", jsonLd });
}

// ── Section listing (Engineering, Essays, …) ───────────────────
export function listing({ site, section, posts, base: b = "" }) {
  // group by year
  const groups = {};
  for (const p of posts) {
    const y = yearOf(p.date) || "Undated";
    (groups[y] ||= []).push(p);
  }
  const years = Object.keys(groups).sort((a, b2) => String(b2).localeCompare(String(a)));

  const sections = years
    .map(
      (y) => `
      <section class="year-group">
        <h2 class="year-label">${y}</h2>
        <ul class="entries">
          ${groups[y]
            .map(
              (p) => `
            <li class="entry">
              <a class="entry-link" href="${b}${section.route}/${p.slug}/">
                <span class="entry-title">${esc(p.title)}</span>
                <span class="entry-rule"></span>
                <time class="entry-date">${fmtDate(p.date)}</time>
              </a>
              ${p.description ? `<p class="entry-desc">${esc(p.description)}</p>` : ""}
              ${
                (p.tags || []).length
                  ? `<ul class="tags entry-tags">${p.tags
                      .map((t) => `<li><a href="${b}tags/${slugifyTag(t)}/">${esc(t)}</a></li>`)
                      .join("")}</ul>`
                  : ""
              }
            </li>`
            )
            .join("")}
        </ul>
      </section>`
    )
    .join("");

  const count = posts.length
    ? `${posts.length} ${posts.length === 1 ? "piece" : "pieces"} · ${section.sub}`
    : section.sub;

  // Three pinned highlights, styled like the home project cards. Curate with
  // `pinned: true` in a post's frontmatter; otherwise fall back to the latest.
  const clip = (s, n = 150) => {
    s = String(s || "");
    if (s.length <= n) return s;
    return s.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,;:.]+$/, "") + "…";
  };
  const pinned = posts.filter((p) => p.pinned);
  const pins = (pinned.length ? pinned : posts).slice(0, 3);
  const pinsBlock = pins.length
    ? `
    <section class="pinned-block">
      <div class="pinned-head"><span class="pinned-label">Pinned</span></div>
      <ul class="projects">${pins
        .map(
          (p) => `
        <li class="project">
          <a class="project-link" href="${b}${section.route}/${p.slug}/">
            <div class="project-top">
              <h3 class="project-title">${esc(p.title)}</h3>
              <span class="project-year">${fmtDate(p.date)}</span>
            </div>
            <p class="project-blurb">${esc(clip(p.description))}</p>
            <ul class="tags">${(p.tags || [])
              .slice(0, 4)
              .map((t) => `<li>${esc(t)}</li>`)
              .join("")}</ul>
          </a>
        </li>`
        )
        .join("")}</ul>
    </section>`
    : "";

  const main = `
    <header class="page-head">
      <h1>${esc(section.title)}</h1>
      <p class="page-sub">${esc(count)}</p>
    </header>
    ${pinsBlock}
    ${posts.length ? sections : `<p class="empty">Nothing here yet. Something is being written — check back soon.</p>`}`;

  return base({
    site, title: section.title, description: section.sub,
    main, base: b, active: section.key, path: `${section.route}/`,
  });
}

// ── Tag listing (/tags/<tag>/) ─────────────────────────────────
export function tagListing({ site, tag, posts, base: b = "" }) {
  const rows = posts
    .map(
      (p) => `
      <li class="entry">
        <a class="entry-link" href="${b}${p.route}/${p.slug}/">
          <span class="entry-title">${esc(p.title)}</span>
          <span class="entry-rule"></span>
          <span class="entry-meta"><span class="entry-kind">${esc(p.sectionLabel || "")}</span><time class="entry-date">${fmtDate(p.date)}</time></span>
        </a>
        ${p.description ? `<p class="entry-desc">${esc(p.description)}</p>` : ""}
      </li>`
    )
    .join("");

  const main = `
    <header class="page-head">
      <h1>#${esc(tag)}</h1>
      <p class="page-sub">${posts.length} ${posts.length === 1 ? "piece" : "pieces"} tagged ${esc(tag)}.</p>
    </header>
    <ul class="entries">${rows}</ul>
    <div class="more-row"><a class="more" href="${b}tags/">All tags <span aria-hidden="true">→</span></a></div>`;

  return base({ site, title: `#${tag}`, main, base: b, active: null, path: `tags/${slugifyTag(tag)}/` });
}

// ── Tags index (/tags/) ────────────────────────────────────────
export function tagsIndex({ site, tags, base: b = "" }) {
  // tags: [{ tag, count }]
  const cloud = tags
    .map(
      (t) =>
        `<a class="tag-chip" href="${b}tags/${slugifyTag(t.tag)}/">${esc(t.tag)} <span>${t.count}</span></a>`
    )
    .join("");
  const main = `
    <header class="page-head">
      <h1>Tags</h1>
      <p class="page-sub">${tags.length} ${tags.length === 1 ? "tag" : "tags"} across all writing.</p>
    </header>
    <div class="tag-cloud">${cloud || `<p class="empty">No tags yet.</p>`}</div>`;
  return base({ site, title: "Tags", main, base: b, active: null, path: "tags/" });
}

// Rewrite root-absolute asset refs (e.g. /blogs/x.png) to the page's
// relative base, so the site works under any path (project Pages subdir).
const rebase = (html, b) =>
  b ? html.replace(/\b(src|href)="\/(?!\/)/g, `$1="${b}`) : html;

// ── Single post ────────────────────────────────────────────────
export function post({ site, post: p, html, base: b = "" }) {
  html = rebase(html, b);
  const tags = (p.tags || [])
    .map((t) => `<li><a href="${b}tags/${slugifyTag(t)}/">${esc(t)}</a></li>`)
    .join("");

  const sectionTitle = p.sectionTitle || "Writing";
  const main = `
    <article class="post">
      <header class="post-head">
        <a class="back" href="${b}${p.route}/"><span aria-hidden="true">←</span> ${esc(sectionTitle)}</a>
        <h1 class="post-title">${esc(p.title)}</h1>
        <div class="post-meta">
          <time>${fmtDate(p.date)}</time>
          ${p.readingTime ? `<span class="dot">·</span><span>${p.readingTime} min read</span>` : ""}
        </div>
        ${tags ? `<ul class="tags">${tags}</ul>` : ""}
      </header>
      <div class="prose">${html}</div>
      <footer class="post-foot">
        <a class="back" href="${b}${p.route}/"><span aria-hidden="true">←</span> All ${esc(sectionTitle.toLowerCase())}</a>
      </footer>
    </article>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    ...(p.description ? { description: p.description } : {}),
    ...(p.date ? { datePublished: new Date(p.date).toISOString().slice(0, 10) } : {}),
    author: { "@type": "Person", name: site.name },
    ...(site.url ? { url: abs(site, `${p.route}/${p.slug}/`) } : {}),
  };
  return base({
    site, title: p.title, description: p.description, main, base: b,
    active: p.sectionKey, path: `${p.route}/${p.slug}/`, ogType: "article", jsonLd,
  });
}

// ── Generic markdown page (e.g. About) ─────────────────────────
export function page({ site, title, html, base: b = "", active, path = "", image, imageAlt, caption }) {
  html = rebase(html, b);
  const fig = image
    ? `<figure class="portrait">
        <img src="${b}${esc(image)}" alt="${esc(imageAlt || title)}" />
        ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
      </figure>`
    : "";
  const main = `
    <article class="post">
      <header class="post-head">
        <h1 class="post-title">${esc(title)}</h1>
      </header>
      ${fig}
      <div class="prose">${html}</div>
    </article>`;
  return base({ site, title, main, base: b, active, path });
}
