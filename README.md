# Western Sydney Hub

The central hub for the Beveridge Williams Western Sydney office: the BricsCAD
plugin suite, our drafting and survey standards, and onboarding material.
Published with GitHub Pages.

The tools were collected from across the office and packaged into one installable
suite; this site documents them. The command reference is written from the
shipping plugin source, so it describes the tools as they actually behave —
prompts, defaults, output layers and prerequisites.

Nothing here is exclusive to Western Sydney — other offices are welcome to
install the suite and use what's useful. Built and maintained by the Western
Sydney Drafting department.

## Editing

Plain static HTML. No build step, no dependencies, nothing to install.

- Every page is a complete `.html` file — open one and edit it.
- The header, footer and section navigation are injected by
  `assets/js/site.js`. **To add or move a page in the navigation, edit the
  `SECTIONS` object at the top of that file** — one edit updates every page.
- Styling is one file: `assets/css/site.css`, organised into commented blocks
  with design tokens at the top.

### Previewing locally

Open any `.html` file directly in a browser, or for a closer match to the live
site serve the folder:

```
python -m http.server 8080
```

then visit <http://localhost:8080/>.

### The generators in `scripts/`

Most pages were originally produced by the scripts in `scripts/`, which stamp the
shared `<head>` and chrome around body content and work out the correct relative
path depth. They are an **authoring convenience, not a build step** — the HTML
they emit is committed and can be edited directly.

**The command library is the exception: keep using its generators.**

`/commands/` is a shared, suite-wide reference covering all four ribbon tabs
(WSY Drafting, BW Engineering, WSY WAE, WSY Tools), organised by the panels the
ribbon actually ships. The taxonomy is read from the `.cui` files in the plugin
repo, not invented here, so the docs match what people see in BricsCAD.

- `scripts/command_data.json` — editable master for the Engineering, WAE and
  Tools entries. These were written against the plugin source; correct them
  here, not in the HTML.
- `scripts/gen_library_other.py` — renders those entries into pages.
- `scripts/gen_command_library.py` — scans every page under `/commands/` and
  rebuilds **both** the alphabetical index and `assets/js/commands.js` (the data
  behind the home-page search). One scan feeds both, so the index, the search
  and the pages cannot drift apart.

After adding, renaming or refiling a command:

```
python scripts/gen_library_other.py && python scripts/gen_command_library.py
```

`assets/js/commands.js` is generated but **committed** — the site has no build
step, GitHub Pages serves the files as they are.

`gen_commands.py` and `gen_index.py` are **superseded and must not be run**:
they own the old drafting-only pages under `drafting/commands/`, which are now
redirect stubs. They are kept only as the provenance of the drafting entry text.

## Structure

```
index.html            Home
getting-started/      Download and install the suite
commands/             Shared command library — all four ribbon tabs
drafting/             WSY Drafting ribbon and drafting standards
survey/               WAE tools
engineering/          BW Engineering ribbon
tools/                NSW Lot Loader, Point Cloud Digitizer
quality/              Drawing QA checklist
onboarding/           BricsCAD, spatial data resources, glossary
about/                How the Hub came together, credits, contributing
assets/css/site.css   All styling
assets/js/site.js     Navigation data + page behaviour
assets/js/commands.js Generated command data for the home search
assets/img/           Screenshots, tutorial GIFs, logos
scripts/              Page generators; command library generators are re-runnable
```

## Notes

- **Brand font.** The wordmark uses Myriad Pro via Adobe Fonts. Kits are
  domain-locked: the kit must list every domain the site is served from, or the
  wordmark silently falls back to Inter. Add the GitHub Pages domain (and any
  custom domain) in the Adobe Fonts kit settings.
- **Layout.** The page uses normal document scroll with `position: sticky`
  sidebars. Please don't reintroduce a viewport-locked container with
  independently scrolling panes — it breaks anchor links, back-button scroll
  restoration, mobile URL-bar behaviour and smooth scrolling.
- **Dark is the default theme**, deliberately — not "follow the OS". `:root`
  carries the dark scale and only an explicit `[data-theme="light"]` switches;
  there is no `prefers-color-scheme` rule, because a light OS preference
  flipping the site would defeat the point. The header toggle opts into light
  and persists per browser.

## Publishing

Pushing to `main` publishes automatically via GitHub Pages.
