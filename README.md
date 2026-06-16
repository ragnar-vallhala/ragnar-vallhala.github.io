# Portfolio & Blog

A tiny, dependency-light static site. You write Markdown; a small build script
turns it into a polished, editorial-styled website. No framework, no lock-in,
hosts anywhere.

## Quick start

```bash
npm install        # one time
npm run serve      # live preview at http://localhost:4321, rebuilds as you write
npm run build      # produce the final site in dist/
```

## Writing

Two writing sections, each its own folder under `content/`:

- **Engineering** → add a `.md` file to `content/engineering/` (systems, embedded, architecture).
- **Essays** → add a `.md` file to `content/essays/` (philosophy, politics, and sociology).
- **About page** → edit `content/about.md`.
- **Your name, links, projects** → edit `site.config.js`.

Both sections share the same post format and styling. The home page shows
the most recent pieces from both, each tagged with its section. To add or
rename a section, edit the `SECTIONS` array at the top of `build.js`.

Every post starts with frontmatter:

```markdown
---
title: My Post Title          # required
date: 2026-06-15              # sorts + groups posts by year
description: One-line summary  # used for previews / SEO
tags: [code, ideas]            # optional
draft: true                    # optional — hides the post from the build
---

Your writing here…
```

## Diagrams (Mermaid)

Any post can embed diagrams and charts with a fenced ` ```mermaid ` block:

````markdown
```mermaid
flowchart LR
  A[Idea] --> B[Post]
```
````

These render in the browser via Mermaid, themed to match the site
(light/dark aware). Flowcharts, sequence diagrams, and `xychart-beta`
bar/line charts all work. The Mermaid script loads **only** on pages
that actually contain a diagram, so other pages stay light. Regular
fenced code blocks are still syntax-highlighted as usual.

## Project layout

```
site.config.js     ← your name, role, links, featured projects
content/
  engineering/*.md ← technical posts (one file each)
  essays/*.md      ← philosophy / politics / sociology
  about.md         ← the about page
public/            ← static files copied as-is (images, favicon, CV.pdf…)
src/
  styles.css       ← the design — tweak colors/fonts here
  templates.js     ← page HTML
build.js           ← the build script
dist/              ← generated site (gitignored) — this is what you deploy
```

## Writing in the visual editor (Composer)

If you'd rather not hand-write Markdown, there's a WYSIWYG tool:

```bash
npm run edit      # opens at http://localhost:4322/editor.html
```

You type rich text in the site's actual fonts and styles — what you see
is how the post will look. Fill in the title, section, date, etc. at the
top. Then:

- **Save to content/** — writes the `.md` straight into
  `content/<section>/`, ready for the next `npm run build`.
- **Download .md** or **Copy Markdown** — if you'd rather place it yourself.

The Composer is a local authoring tool only. It is never part of the
built site, and `editor-server.js` should never be deployed.

## Customizing the look

Open `src/styles.css`. The palette lives in the `:root` block at the top
(`--accent` is the terracotta highlight). Dark mode is automatic, driven by the
reader's system setting.

## Deploying

`npm run build`, then publish the `dist/` folder. It's plain static files, so
any host works:

- **GitHub Pages** — push `dist/` to a `gh-pages` branch.
- **Netlify / Vercel / Cloudflare Pages** — set build command `npm run build`
  and publish directory `dist`.
- Drag `dist/` onto Netlify Drop, or copy it to any web server.
