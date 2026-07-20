# BW Western Sydney — Drafting Documentation

Documentation for the Beveridge Williams Western Sydney drafting and survey
toolset: the BricsCAD plugin suite, our drafting standards, and onboarding
material. Published with GitHub Pages.

The command reference is written from the shipping plugin source, so it
describes the tools as they actually behave — prompts, defaults, output layers
and prerequisites.

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

### The generators in `tools/`

The pages were originally produced by the scripts in `tools/`, which stamp the
shared `<head>` and chrome around body content and work out the correct
relative path depth for each page. They are an **authoring convenience, not a
build step** — the HTML they emit is committed and can be edited directly.
Re-running a generator overwrites the pages it owns, so don't run them after
hand-editing unless you've folded your changes back into the script.

## Structure

```
index.html            Home
drafting/             Ribbon, standards, and the full command reference
survey/               WAE tools, NSW Lot Loader, Point Cloud Digitizer
engineering/          BW Engineering ribbon
quality/              Drawing QA checklist
onboarding/           BricsCAD, spatial data resources, glossary
assets/css/site.css   All styling
assets/js/site.js     Navigation data + page behaviour
assets/img/           Screenshots, tutorial GIFs, logos
tools/                Page generators (optional)
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
- **Dark mode** follows the operating system, with a toggle in the header that
  persists per browser.

## Publishing

Pushing to `main` publishes automatically via GitHub Pages.
