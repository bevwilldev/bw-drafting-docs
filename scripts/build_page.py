"""
Page generator for the Western Sydney Hub site.

This is an AUTHORING CONVENIENCE, not a build step: it stamps the shared
<head>, header/sidenav/footer mount points and script tags around page body
content, working out the correct relative depth for each page. The files it
writes are plain static HTML — edit them directly afterwards if you prefer.

Usage (from the repo root):
    python tools/build_page.py

Pages are declared in PAGES below as (path, section, title, description, body).
"""

import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — WSY Hub</title>
<meta name="description" content="{description}">
<link rel="icon" href="{up}assets/img/bw-logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<!-- Brand wordmark (Myriad Pro), served by the Adobe Fonts kit. Kits are
     domain-locked: add every serving domain to the kit or it falls back. -->
<link rel="stylesheet" href="https://use.typekit.net/mhc8sjd.css">
<link rel="stylesheet" href="{up}assets/css/site.css">
<script>
  (function () {{ try {{ var t = localStorage.getItem('theme'); if (t) document.documentElement.setAttribute('data-theme', t); }} catch (e) {{}} }})();
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header data-header></header>

<div class="layout">
  <aside data-sidenav="{section}"></aside>

  <main class="content" id="main">
{body}
  </main>

  <aside data-toc></aside>
</div>

<footer data-footer></footer>
{scripts}<script src="{up}assets/js/site.js"></script>
</body>
</html>
"""


def write(path, section, title, description, body, scripts=()):
    """path is repo-relative, e.g. 'drafting/index.html'.

    `scripts` names extra JS under assets/js/ to load BEFORE site.js — the
    command search needs its data file present when site.js boots.
    """
    depth = path.count("/")
    up = "../" * depth
    tags = "".join(
        '<script src="{0}assets/js/{1}"></script>\n'.format(up, s) for s in scripts
    )
    html = TEMPLATE.format(
        title=title, description=description, section=section, up=up,
        body=body.rstrip(), scripts=tags
    )
    full = os.path.join(ROOT, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with io.open(full, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    return path


def page_nav(prev=None, nxt=None):
    """Prev/next footer links. Each arg is (href, title) or None."""
    if not prev and not nxt:
        return ""
    out = ['    <nav class="page-nav">']
    if prev:
        out.append(
            '      <a href="{0}"><div class="dir">Previous</div>'
            '<div class="ttl">{1}</div></a>'.format(*prev)
        )
    if nxt:
        out.append(
            '      <a class="next" href="{0}"><div class="dir">Next</div>'
            '<div class="ttl">{1}</div></a>'.format(*nxt)
        )
    out.append("    </nav>")
    return "\n".join(out)


def slug(text):
    """Heading id, matching the fallback slugifier in assets/js/site.js.

    Names like "SSMX / SSMY" must not become id="ssmx / ssmy" — spaces are not
    valid in a fragment identifier, so the TOC link and any deep link silently
    fail to scroll.
    """
    text = re.sub(r"[^\w\s-]", "", text.lower().strip())
    return re.sub(r"\s+", "-", text)[:60]


def cmd_block(name, summary, usage=None, produces=None, notes=None, ribbon=None):
    """One command entry: heading, summary, then optional detail sections."""
    out = [
        '    <h3 id="{0}"><code class="cmd">{1}</code></h3>'.format(slug(name), name),
        "    <p>{0}</p>".format(summary),
    ]
    if ribbon:
        out.append(
            '    <p class="meta"><strong>Ribbon</strong> &middot; {0}</p>'.format(ribbon)
        )
    if usage:
        out.append("    <h4>How to use it</h4>")
        out.append("    " + usage)
    if produces:
        out.append("    <h4>What it produces</h4>")
        out.append("    <p>{0}</p>".format(produces))
    if notes:
        cls = "note warn" if notes[0] == "!" else "note"
        text = notes[1:] if notes[0] == "!" else notes
        label = "Watch out" if cls.endswith("warn") else "Note"
        out.append(
            '    <div class="{0}"><strong>{1}</strong> — {2}</div>'.format(cls, label, text)
        )
    return "\n".join(out)
