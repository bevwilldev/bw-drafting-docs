"""Write the /commands/ landing page: search, tab overview, alphabetical index.

Run this then gen_command_library.py, which fills in the alpha table.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_page  # noqa: E402

TABS = [
    ("WSY Drafting", "drafting", "Deposited, detail and sales plans.", [
        ("cadastre", "Cadastre"), ("survey", "Survey"),
        ("occupations", "Occupations"), ("topography", "Topography"),
        ("setout", "Setout &amp; Ident"), ("text", "Text"),
        ("sheeting", "Sheeting"), ("annotation", "Annotation"),
        ("qa", "QA"), ("command-line", "No ribbon button"),
    ]),
    ("BW Engineering", "engineering", "Engineering plans and standard annotation.", [
        ("standards", "Standards"), ("annotation", "Annotation"),
        ("plotting", "Plotting"), ("open", "Open"), ("toolbox", "Toolbox"),
    ]),
    ("WSY WAE", "wae", "Works-As-Executed plans.", [
        ("sheeting", "Sheeting"), ("annotations", "Annotations"),
    ]),
    ("WSY Tools", "tools", "In-office data utilities.", [
        ("tools", "Tools"), ("command-line", "No ribbon button"),
    ]),
]

body = ["""    <h1>Command Reference</h1>
    <p class="lede">
      Every command in the BW BricsCAD Tools suite — across all four ribbon tabs,
      not just drafting. What each one does, what it asks you, what it draws and
      anything worth knowing before you run it.
    </p>


    <!-- Search FIRST. Sitting below the ribbon-tab cards, it read as a filter
         for the category you had already chosen, and implied browsing was the
         only route in. It is the fastest way to a command, so it leads. -->
    <div class="cmd-search cmd-search-page" data-cmd-search hidden>
      <label class="sr-only" for="cmdSearch">Search commands</label>
      <div class="cmd-search-field">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round" aria-hidden="true">
          <circle cx="7.2" cy="7.2" r="4.4"/><path d="m10.6 10.6 3 3"/>
        </svg>
        <input id="cmdSearch" type="search" autocomplete="off" spellcheck="false"
               placeholder="Search all 126 commands &mdash; try &quot;curve&quot; or AUTODIM">
      </div>
      <div class="cmd-search-out" role="listbox" aria-label="Command results"></div>
    </div>
    <p class="cmd-search-hint">
      Or press <kbd>/</kbd> anywhere on the site. Prefer to browse? The ribbon
      tabs are below, and the full alphabetical list is at the bottom.
    </p>

    <h2 id="by-ribbon-tab">Browse by ribbon tab</h2>
    <p>
      Commands are grouped the way the ribbon groups them, so a panel here is the
      panel you see in BricsCAD. Each tab also has a page for the commands that
      have no button and are typed at the command line — a substantial part of
      the suite.
    </p>"""]

for label, slug, lede, panels in TABS:
    body.append(f'\n    <h3>{label}</h3>')
    body.append(f'    <p>{lede}</p>')
    body.append('    <div class="card-grid">')
    for pslug, plabel in panels:
        body.append(
            f'      <a href="{slug}/{pslug}/"><span class="t">{plabel}</span></a>')
    body.append("    </div>")

body.append("""
    <h2 id="alphabetical-index">Alphabetical index</h2>
    <p>
      Every command in the suite. Type to filter by name or by what it does —
      clicking a result takes you straight to that command.
    </p>
    <div class="cmd-filter">
      <input type="search" data-filters="cmdIndex" autocomplete="off"
             placeholder="Filter commands — try &quot;curve&quot; or AUTODIM">
      <p class="cmd-filter-count" data-filter-count aria-live="polite"></p>
    </div>
    <!-- ALPHA_START — generated, do not hand-edit -->
    <!-- ALPHA_END -->
    <nav class="page-nav">
      <a href="../"><div class="dir">Previous</div><div class="ttl">Home</div></a>
    </nav>
""")

build_page.write("commands/index.html", "commands", "Command Reference",
                 "Every command in the BW BricsCAD Tools suite, across all four "
                 "ribbon tabs.", "\n".join(body),
                 scripts=("commands.js",))
print("wrote commands/index.html")
