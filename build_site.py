#!/usr/bin/env python3
"""Build minecraft-overtaken site: book markdown -> styled single-page HTML."""
import markdown
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "book" / "part1.md"
OUT = ROOT / "index.html"

md_text = SRC.read_text(encoding="utf-8")

# --- collect mission headings for the nav sidebar ---
nav_items = []
for line in md_text.splitlines():
    m = re.match(r"^## MISSION (\d+) — (.+)$", line)
    if m:
        nav_items.append((int(m.group(1)), m.group(2)))
tier_of = {}
for num in nav_items:
    n = num[0]
    tier_of[n] = "Tier I · Easy" if n <= 5 else ("Tier II · Normal" if n <= 10 else "Tier III · Hard")

body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "sane_lists", "smarty"],
    output_format="html5",
)

# --- build nav ---
nav_links = []
nav_links.append('<a href="#how-to-use-this-book">How to Use This Book</a>')
nav_links.append('<a href="#reading-the-coordinates">Reading the Coordinates</a>')
for num, title in nav_items:
    anchor = f"mission-{num}".lower()
    nav_links.append(
        f'<a href="#{anchor}"><span class="tier">{tier_of[num]}</span>'
        f'<span class="mtitle"><b>Mission {num}</b> — {title}</span></a>'
    )
nav_links.append('<a href="#epilogue-the-overtaking">Epilogue</a>')
nav_links.append('<a href="#appendix-a-reading-coordinates">Appendix A — Coordinates</a>')
nav_links.append('<a href="#appendix-b-master-coordinate-table">Appendix B — Master Table</a>')
nav_links.append('<a href="#appendix-c-the-supplies-ledger">Appendix C — Supplies</a>')
nav_links.append('<a href="#appendix-d-glossary">Appendix D — Glossary</a>')
nav_html = "\n".join(nav_links)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Minecraft Overtaken — A Missionary's Guide to Reclaiming the Blocky World</title>
<meta name="description" content="Fifteen missions. Three tiers of difficulty. One world to take back. A missionary-style Minecraft guide with exact coordinates for every task.">
<style>
:root {{
  --bg: #0d1117; --panel: #161b22; --panel2: #1c2330; --ink: #e6edf3;
  --muted: #8b949e; --green: #3fb950; --grass: #56d364; --gold: #e3b341;
  --line: #30363d; --red: #f85149;
}}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
body {{
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.65;
}}
a {{ color: #58a6ff; text-decoration: none; }}
a:hover {{ text-decoration: underline; }}
.wrap {{ display: flex; min-height: 100vh; }}
nav {{
  width: 300px; min-width: 300px; background: var(--panel); border-right: 1px solid var(--line);
  padding: 22px 14px; position: sticky; top: 0; height: 100vh; overflow-y: auto;
}}
nav h1 {{ font-size: 15px; margin: 0 0 4px; color: var(--gold); letter-spacing: .5px; }}
nav .sub {{ font-size: 11px; color: var(--muted); margin: 0 0 14px; }}
nav a {{
  display: block; padding: 7px 10px; border-radius: 8px; color: var(--ink);
  font-size: 13px; margin-bottom: 2px; border-left: 3px solid transparent;
}}
nav a:hover {{ background: var(--panel2); text-decoration: none; border-left-color: var(--green); }}
nav .tier {{ display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }}
nav .mtitle {{ display: block; }}
main {{ flex: 1; max-width: 900px; margin: 0 auto; padding: 40px 32px 80px; }}
main h1 {{
  font-size: 34px; line-height: 1.15; margin: 0 0 6px; color: var(--grass);
}}
main h2 {{
  margin-top: 64px; padding-bottom: 10px; border-bottom: 2px solid var(--line);
  font-size: 26px; color: var(--gold);
}}
main h3 {{ margin-top: 34px; font-size: 19px; color: var(--grass); }}
main h4 {{ margin-top: 26px; font-size: 16px; }}
main p, main li {{ font-size: 15.5px; }}
main blockquote {{
  margin: 22px 0; padding: 16px 22px; background: var(--panel);
  border-left: 4px solid var(--gold); border-radius: 0 10px 10px 0;
}}
main blockquote p {{ font-style: italic; color: #c9d1d9; }}
main table {{
  border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 14px;
  background: var(--panel); border-radius: 10px; overflow: hidden;
}}
main th {{
  text-align: left; background: var(--panel2); color: var(--gold);
  padding: 9px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .8px;
}}
main td {{ padding: 8px 12px; border-top: 1px solid var(--line); }}
main tr:nth-child(even) td {{ background: rgba(255,255,255,.02); }}
main code {{
  background: var(--panel2); border: 1px solid var(--line); border-radius: 5px;
  padding: 1px 6px; font-size: 13px; font-family: "SF Mono", Consolas, monospace; color: #79c0ff;
}}
main ul {{ padding-left: 22px; }}
main li {{ margin: 5px 0; }}
main li::marker {{ color: var(--green); }}
hr {{ border: none; border-top: 1px solid var(--line); margin: 44px 0; }}
strong {{ color: #fff; }}
.missions {{ margin: 26px 0; }}
@media (max-width: 900px) {{
  .wrap {{ flex-direction: column; }}
  nav {{ width: 100%; min-width: 0; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--line); }}
  main {{ padding: 24px 18px 60px; }}
  main h1 {{ font-size: 26px; }}
}}
</style>
</head>
<body>
<div class="wrap">
<nav>
  <h1>MINECRAFT OVERTAKEN</h1>
  <p class="sub">A Missionary's Guide to Reclaiming the Blocky World</p>
  {nav_html}
</nav>
<main>
{body}
<footer style="margin-top:70px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;">
  Minecraft Overtaken — written in the mission field, block by block.<br>
  <a href="https://github.com/Walusimbi-Leon1/minecraft-overtaken/releases/download/v1.0/minecraft-overtaken-v1.0.pdf">Download the PDF</a> (v1.0, 49 pages) for offline reading &middot; source markdown in <code>book/part1.md</code>
</footer>
</main>
</div>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes), {len(nav_items)} missions in nav")
