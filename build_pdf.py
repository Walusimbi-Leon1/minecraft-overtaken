#!/usr/bin/env python3
"""Build a print-ready PDF of the book with WeasyPrint.

Generates dist/minecraft-overtaken.pdf from book/part1.md:
cover page, table of contents with page numbers, page breaks per
section, and a light print-friendly theme.
"""
import re
from pathlib import Path

import markdown
from weasyprint import HTML

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "book" / "part1.md"
OUT = ROOT / "dist" / "minecraft-overtaken.pdf"

text = SRC.read_text(encoding="utf-8")

# --- pull the cover block (title + epigraph) out of the body flow ---
cover_match = re.search(
    r"# MINECRAFT OVERTAKEN.*?(?=## HOW TO USE THIS BOOK)", text, re.S
)
cover_block = cover_match.group(0).strip()
text = text.replace(cover_match.group(0), "")

# --- convert body markdown (toc extension gives us anchors + a contents tree) ---
md = markdown.Markdown(
    extensions=["tables", "fenced_code", "sane_lists", "smarty", "toc"],
    extension_configs={"toc": {"toc_depth": "2-2"}},
    output_format="html5",
)
body = md.convert(text)
toc_html = md.toc

# --- render checklist items as real checkboxes ---
body = body.replace("<li>[ ]", '<li class="todo">☐ ')
body = body.replace("<li>[x]", '<li class="todo done">☑ ')

CSS = """
@page {
  size: A4;
  margin: 2.1cm 1.9cm 2.4cm 1.9cm;
  @bottom-center {
    content: "Minecraft Overtaken — A Missionary's Guide to Reclaiming the Blocky World";
    font-family: "DejaVu Sans", sans-serif;
    font-size: 7.5pt;
    color: #6b7280;
  }
  @bottom-right {
    content: counter(page);
    font-family: "DejaVu Sans", sans-serif;
    font-size: 8.5pt;
    color: #374151;
  }
}
@page cover {
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}

* { box-sizing: border-box; }
body {
  font-family: "DejaVu Sans", "Noto Sans", sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1f2937;
}
h1, h2, h3, h4 { font-family: "DejaVu Sans", sans-serif; }
h1 { font-size: 26pt; color: #14532d; margin: 0 0 8pt 0; }
h2 {
  font-size: 17pt; color: #14532d; margin: 0 0 10pt 0;
  padding-bottom: 6pt; border-bottom: 1.5pt solid #a16207;
  break-before: page;
}
h3 { font-size: 12.5pt; color: #166534; margin: 16pt 0 6pt 0; break-after: avoid; }
h4 { font-size: 11pt; color: #1f2937; margin: 12pt 0 4pt 0; break-after: avoid; }
p { margin: 0 0 8pt 0; }
strong { color: #111827; }
a { color: inherit; text-decoration: none; }
hr { border: none; border-top: 0.8pt solid #d1d5db; margin: 18pt 0; }
blockquote {
  margin: 12pt 0; padding: 10pt 14pt;
  border-left: 3.5pt solid #a16207; background: #faf6ec;
  break-inside: avoid;
}
blockquote p { font-style: italic; color: #44403c; margin: 0; }
ul { margin: 4pt 0 10pt 0; padding-left: 16pt; }
li { margin: 3pt 0; }
li.todo { list-style: none; margin-left: -12pt; }
li.todo::before { content: ""; }
table {
  border-collapse: collapse; width: 100%; margin: 10pt 0 14pt 0;
  font-size: 9.5pt;
}
th {
  text-align: left; background: #e5efe6; color: #14532d;
  padding: 5pt 8pt; border: 0.6pt solid #9ca3af;
  font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4pt;
}
td { padding: 4.5pt 8pt; border: 0.6pt solid #c9cfd6; vertical-align: top; }
tr { break-inside: avoid; }
code {
  font-family: "DejaVu Sans Mono", monospace; font-size: 9pt;
  background: #f3f4f6; padding: 0.5pt 3pt; border-radius: 2pt;
}

/* cover */
.cover {
  page: cover; text-align: center;
  padding-top: 90pt;
}
.cover .kicker {
  font-size: 11pt; letter-spacing: 3pt; text-transform: uppercase;
  color: #a16207; margin-bottom: 14pt;
}
.cover h1 { font-size: 34pt; line-height: 1.1; margin-bottom: 6pt; }
.cover .subtitle { font-size: 14pt; color: #166534; margin-bottom: 30pt; }
.cover .epigraph {
  font-style: italic; font-size: 11.5pt; color: #44403c;
  max-width: 80%; margin: 0 auto 34pt auto; line-height: 1.7;
}
.cover .meta { font-size: 9.5pt; color: #6b7280; margin-top: 60pt; }
.cover { break-after: page; }

/* contents */
.contents { break-after: page; }
.contents h2 { break-before: auto; border-bottom: 1.5pt solid #a16207; }
.contents ul { list-style: none; padding: 0; margin-top: 14pt; }
.contents li { margin: 5.5pt 0; }
.contents a { display: block; }
.contents a::after {
  content: target-counter(attr(href), page);
  float: right; color: #6b7280;
}
.contents .lvl2 { font-weight: bold; color: #14532d; margin-top: 10pt; }
"""

COVER_HTML = f"""
<div class="cover">
  <div class="kicker">A Missionary's Guide to Reclaiming the Blocky World</div>
  <h1>MINECRAFT<br>OVERTAKEN</h1>
  <div class="subtitle">Fifteen missions &middot; Three tiers of difficulty &middot; One world to take back</div>
  <div class="epigraph">
    &ldquo;The Old Builders are gone. Their farms went wild, their lanterns died,
    and the night crept in where light once stood. The world has been overtaken —
    by shadow, by chaos, by the creatures that own the dark. But they left one
    thing behind: a map, a compass, and a commission. You are the missionary of
    the block. Your task is not merely to survive. Your task is to take the world
    back — one mission at a time.&rdquo;<br><br>
    — from the Book of the First Light
  </div>
  <div class="meta">Version 1.0 &middot; Survival mode &middot; Seed: OVERTAKEN<br>Missions 1–15 &middot; Easy &rarr; Normal &rarr; Hard</div>
</div>
"""

contents_html = f'<div class="contents"><h2>CONTENTS</h2>{toc_html}</div>'

html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Minecraft Overtaken — A Missionary's Guide</title>
<style>{CSS}</style>
</head>
<body>
{COVER_HTML}
{contents_html}
{body}
</body>
</html>
"""

OUT.parent.mkdir(parents=True, exist_ok=True)
HTML(string=html_doc).write_pdf(str(OUT))
print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
