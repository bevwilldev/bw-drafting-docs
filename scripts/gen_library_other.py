"""Render the Engineering / WAE / Tools command pages from command_data.json.

command_data.json is the editable master for these entries (they were written
against the plugin source). Edit it, re-run this, then run
gen_command_library.py to refresh the index and the search data.
"""
import json
import pathlib
import re
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_page  # noqa: E402

data = json.loads((HERE / "command_data.json").read_text(encoding="utf-8"))

# OPENCHECKLIST sits on the WSY Drafting ribbon's QA panel, not on any of these
# three tabs — it is refiled there rather than left under Tools.
for e in data:
    if e["cmd"] == "OPENCHECKLIST":
        e["tab"], e["panel"] = "drafting", "QA"
    elif e["panel"] == "(no ribbon button)":
        e["panel"] = "No ribbon button"

PAGES = [
    ("engineering", "Standards", "standards", "Standards",
     "Importing the BW style set and managing annotation scales."),
    ("engineering", "Annotation", "annotation", "Annotation",
     "BW standard text heights, matching multileaders and the dimension wrappers."),
    ("engineering", "Plotting", "plotting", "Plotting",
     "A1 and A3 PDF output, and A3 printing."),
    ("engineering", "Open", "open", "Open",
     "Titleblock update, the drawing register and the job folder."),
    ("engineering", "Toolbox", "toolbox", "Toolbox",
     "Shared tools that ride with every plugin in the suite."),
    ("wae", "Sheeting", "sheeting", "Sheeting",
     "Bringing the design sheet into the Works-As-Executed drawing."),
    ("wae", "Annotations", "annotations", "Annotations",
     "WAE text, grades, comments and the certification tick."),
    ("tools", "Tools", "tools", "Tools",
     "The NSW Lot Loader and Point Cloud Digitizer."),
    ("tools", "No ribbon button", "command-line", "Commands without a ribbon button",
     "Office-tool commands typed at the command line."),
    ("drafting", "QA", "qa", "QA", "The drawing checklist panel."),
]

by = defaultdict(list)
for e in data:
    by[(e["tab"], e["panel"])].append(e)


def entry(e):
    out = [f'    <h2 id="{e["anchor"]}"><code class="cmd">{e["cmd"]}</code></h2>',
           "    " + e["body"].strip()]
    if e.get("howto"):
        out += ["    <h4>How to use it</h4>", "    " + e["howto"].strip()]
    if e.get("produces"):
        out += ["    <h4>What it produces</h4>", "    " + e["produces"].strip()]
    if e.get("notes"):
        note = e["notes"].strip()
        note = re.sub(r"^<p>(.*)</p>$", r"\1", note, flags=re.S)
        out.append(f'    <div class="note"><strong>Note</strong> — {note}</div>')
    out.append("")
    return "\n".join(out)


NAV = ('    <nav class="page-nav">\n'
       '      <a href="../../"><div class="dir">Previous</div>'
       '<div class="ttl">Command Reference</div></a>\n    </nav>\n')

for tab, panel, slug, title, lede in PAGES:
    items = sorted(by.get((tab, panel), []), key=lambda e: e["cmd"])
    if not items:
        print(f"  SKIP {tab}/{slug} (no entries)")
        continue
    body = [f"    <h1>{title}</h1>", f'    <p class="lede">{lede}</p>', ""]

    if tab == "drafting" and panel == "QA":
        body.append(
            '    <p>The QA panel holds a single button. The checklist itself — '
            'revisions, the automatic checks and saving a completed pass — is '
            'documented under <a href="../../../quality/checklist/">Quality '
            '&rsaquo; Drawing Checklist</a>.</p>\n')

    body += [entry(e) for e in items]
    body.append(NAV)
    path = f"commands/{tab}/{slug}/index.html"
    build_page.write(path, "commands", title, lede, "\n".join(body))
    print(f"  {path:44} {len(items):2} commands")
