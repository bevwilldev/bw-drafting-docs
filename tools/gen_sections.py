# -*- coding: utf-8 -*-
"""Generates the section index pages."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write, page_nav

# ---------------------------------------------------------------- Drafting
write("drafting/index.html", "drafting", "Drafting",
      "The WSY Drafting ribbon, drafting standards and the full BricsCAD command reference.",
      """    <h1>Drafting</h1>
    <p class="lede">
      Everything for deposited plans, detail plans and sales plans — the WSY Drafting
      ribbon, the standards we draw to, and a reference for every command in the toolset.
    </p>

    <h2>In this section</h2>
    <div class="index-list">
      <a href="interface/"><span class="t">Custom CAD Interface</span><span class="d">What the ribbon is for, how to install it, and what each panel does.</span></a>
      <a href="standards/"><span class="t">Drafting Standards</span><span class="d">Line weights, text styles, layers, plotting and annotative entities.</span></a>
      <a href="commands/"><span class="t">Command Reference</span><span class="d">Every command in the suite — prompts, output layers and gotchas.</span></a>
    </div>

    <h2>New to the toolset?</h2>
    <p>
      Start with the <a href="interface/">introduction to the interface</a>, then
      <a href="interface/installation/">install it</a>. Once the ribbon is loaded,
      <a href="interface/using/">Using the Ribbon</a> walks through each panel.
    </p>
    <p>
      If you're looking for a specific command, go straight to the
      <a href="commands/">command reference</a>.
    </p>

    <h2>Worth knowing</h2>
    <div class="note">
      <strong>Note</strong> — a substantial part of the toolset has no ribbon button
      and is typed at the command line. The boundary dimensioning and curve table
      workflow (<code class="cmd">AUTODIM</code> → <code class="cmd">DIMLAB</code> →
      <code class="cmd">CURVETABLE</code>) is the biggest example. See
      <a href="commands/dimensions/">Dimensions &amp; Curve Tables</a>.
    </div>
""" + page_nav(nxt=("interface/", "Custom CAD Interface")))

# ---------------------------------------------------------------- Survey
write("survey/index.html", "survey", "Survey",
      "Works-As-Executed tools, the NSW Cadastral Lot Loader and the Point Cloud Digitizer.",
      """    <h1>Survey</h1>
    <p class="lede">
      Tools for survey work: Works-As-Executed plans, pulling NSW cadastre straight
      into a drawing, and digitising off point clouds.
    </p>

    <h2>In this section</h2>
    <div class="index-list">
      <a href="wae/"><span class="t">Works-As-Executed</span><span class="d">The WAE ribbon: sheet import, preset labels, grade calculation and annotations.</span></a>
      <a href="lot-loader/"><span class="t">NSW Lot Loader</span><span class="d">Fetch cadastral lot boundaries, labels and road names from NSW Spatial.</span></a>
      <a href="point-cloud/"><span class="t">Point Cloud Digitizer</span><span class="d">Trace features off a point cloud at a fixed step, then export to 12d.</span></a>
    </div>

    <h2>Getting started</h2>
    <p>
      Most WAE work starts by bringing the design sheets in — see
      <a href="wae/import-sheet/">Import Sheet</a> — and then annotating them with the
      <a href="wae/labels/">preset labels</a>.
    </p>
""" + page_nav(nxt=("wae/", "Works-As-Executed")))

# ---------------------------------------------------------------- Engineering
write("engineering/index.html", "engineering", "Engineering",
      "The BW Engineering ribbon: standard text, leaders, dimensions, scales and plotting.",
      """    <h1>Engineering</h1>
    <p class="lede">
      The BW Engineering toolset — standard annotation at the BW text heights,
      matching leaders and dimensions, the standard scale list, and plot shortcuts.
    </p>

    <h2>In this section</h2>
    <div class="index-list">
      <a href="text/"><span class="t">Text &amp; Leaders</span><span class="d">BW25–BW70 annotation text and the matching multileader styles.</span></a>
      <a href="dimensions/"><span class="t">Dimensions</span><span class="d">The BWAN_DIM dimension wrappers for linear, aligned, angular, arc and radial.</span></a>
      <a href="standards/"><span class="t">Styles &amp; Scales</span><span class="d">Importing the BW style set, and creating or resetting annotation scales.</span></a>
      <a href="plotting/"><span class="t">Plotting</span><span class="d">A1 and A3 PDF output, A3 printing, and opening the job folder or register.</span></a>
    </div>

    <div class="note">
      <strong>Note</strong> — scale creation is the shared
      <code class="cmd">CSCALE</code> command, the same tool the WSY Drafting ribbon
      uses. The older <code>BWCSCALE</code> has been retired.
    </div>
""" + page_nav(nxt=("text/", "Text & Leaders")))

# ---------------------------------------------------------------- Quality
write("quality/index.html", "quality", "Quality",
      "The drawing QA checklist and how drawings are signed off.",
      """    <h1>Quality</h1>
    <p class="lede">
      How a drawing gets checked and signed off, using the project drawing checklist.
    </p>

    <h2>In this section</h2>
    <div class="index-list">
      <a href="checklist/"><span class="t">Drawing Checklist</span><span class="d">The QA panel: revisions, automatic checks, and saving a completed pass.</span></a>
    </div>
""" + page_nav(nxt=("checklist/", "Drawing Checklist")))

# ---------------------------------------------------------------- Onboarding
write("onboarding/index.html", "onboarding", "Onboarding",
      "Getting started: BricsCAD, and the spatial data resources we use.",
      """    <h1>Onboarding</h1>
    <p class="lede">
      New to the drafting team? Start here. This section covers the software we
      draw in and the data sources we rely on day to day.
    </p>

    <h2>In this section</h2>
    <div class="index-list">
      <a href="bricscad/"><span class="t">BricsCAD</span><span class="d">What BricsCAD is, how it fits our workflow, and where to learn it.</span></a>
      <a href="resources/"><span class="t">Spatial Data Resources</span><span class="d">SIX Maps, Nearmap, MetroMap and ELVIS — what each is good for.</span></a>
      <a href="glossary/"><span class="t">Glossary</span><span class="d">Plan types, abbreviations and the terms you'll hear in the office.</span></a>
    </div>

    <h2>Where to go next</h2>
    <p>
      Once you're comfortable with BricsCAD, move on to
      <a href="../drafting/">Drafting</a> to install the WSY ribbon and learn the
      toolset, or <a href="../survey/">Survey</a> if you're working on WAE plans.
    </p>
""" + page_nav(nxt=("bricscad/", "Introduction to BricsCAD")))

print("Section indexes written.")
