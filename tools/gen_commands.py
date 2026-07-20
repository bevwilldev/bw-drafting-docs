# -*- coding: utf-8 -*-
"""
Generates the drafting command reference pages.

Content is taken from the shipping plugin source (prompt strings, defaults,
layers, styles and gotchas were read out of the [CommandMethod] implementations),
so these pages describe the tools as they actually behave.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write, page_nav, cmd_block

C = "commands/"

# ------------------------------------------------------------------ index
write("drafting/commands/index.html", "drafting", "Command Reference",
      "Every command in the BW BricsCAD Tools drafting suite, by ribbon panel and alphabetically.",
      """    <h1>Command Reference</h1>
    <p class="lede">
      Every command in the WSY Drafting toolset — what it does, what it asks you,
      what it draws and where, and anything worth knowing before you run it.
    </p>

    <h2>By ribbon panel</h2>
    <div class="index-list">
      <a href="cadastre/"><span class="t">Cadastre</span><span class="d">Boundaries, lot numbers, areas, bearings, easements and roads.</span></a>
      <a href="survey/"><span class="t">Survey</span><span class="d">Pegs, reference marks, SSMs, ties and traverse lines.</span></a>
      <a href="text/"><span class="t">Text &amp; Labels</span><span class="d">Text styles, leaders, brackets, masks and curve-aligned labels.</span></a>
      <a href="annotation/"><span class="t">Annotation &amp; Scales</span><span class="d">Creating annotation scales and cycling through them.</span></a>
      <a href="sheeting/"><span class="t">Sheeting</span><span class="d">North points, sheet sets and per-lot sales layouts.</span></a>
      <a href="dimensions/"><span class="t">Dimensions &amp; Curve Tables</span><span class="d">Automatic boundary dimensioning and curve schedules.</span></a>
      <a href="topography/"><span class="t">Topography &amp; Earthworks</span><span class="d">Batters, contour labels, levels and fill plans.</span></a>
      <a href="utilities/"><span class="t">Utilities</span><span class="d">Offsets, copying to vertices, pipes, LandXML and text tools.</span></a>
    </div>

    <h2>How to read these pages</h2>
    <p>
      Commands are shown as you'd type them, like <code class="cmd">AUTODIM</code>.
      Where a command accepts a <strong>pre-selection</strong>, you can select
      objects <em>before</em> running it and it will use that selection instead of
      prompting.
    </p>
    <p>
      Prompts are quoted as they appear on the command line, with the default shown
      in angle brackets — pressing <kbd>Enter</kbd> accepts it.
    </p>

    <h2>Commands without a ribbon button</h2>
    <div class="note">
      <strong>Note</strong> — a large part of the toolset is command-line only,
      including the whole boundary dimensioning workflow. If you only use the
      ribbon you're likely missing tools; the panel pages below list them alongside
      the buttoned commands.
    </div>

    <h2>Alphabetical index</h2>
    <p>Jump straight to a command:</p>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Command</th><th>Does</th><th>Where</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">ADDNORTH</code></td><td>North point matched to a viewport's twist</td><td><a href="sheeting/">Sheeting</a></td></tr>
        <tr><td><code class="cmd">ALAB</code></td><td>Label lots with their area</td><td><a href="dimensions/">Dimensions</a></td></tr>
        <tr><td><code class="cmd">ALIGNA</code></td><td>Stack text under anchor text</td><td><a href="cadastre/">Cadastre</a></td></tr>
        <tr><td><code class="cmd">ANNONEXT</code> / <code class="cmd">ANNOPREV</code></td><td>Step through annotation scales</td><td><a href="annotation/">Annotation</a></td></tr>
        <tr><td><code class="cmd">ANNOTOG</code></td><td>Show/hide annotative objects at all scales</td><td><a href="annotation/">Annotation</a></td></tr>
        <tr><td><code class="cmd">ATC</code></td><td>Align text along a curve</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">AUTODIM</code></td><td>Dimension every boundary segment</td><td><a href="dimensions/">Dimensions</a></td></tr>
        <tr><td><code class="cmd">BATTER</code></td><td>Batter ticks between top and toe lines</td><td><a href="topography/">Topography</a></td></tr>
        <tr><td><code class="cmd">CLABEL</code></td><td>Drag words onto curves in turn</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">CONTLAB</code></td><td>Label contours with their elevation</td><td><a href="topography/">Topography</a></td></tr>
        <tr><td><code class="cmd">CSCALE</code></td><td>Create annotation scales</td><td><a href="annotation/">Annotation</a></td></tr>
        <tr><td><code class="cmd">CURVETABLE</code></td><td>Build a curve schedule</td><td><a href="dimensions/">Dimensions</a></td></tr>
        <tr><td><code class="cmd">DIMLAB</code> / <code class="cmd">DIMRENUM</code></td><td>Numbered curve label bubbles</td><td><a href="dimensions/">Dimensions</a></td></tr>
        <tr><td><code class="cmd">FILL1</code>–<code class="cmd">FILL11</code></td><td>Earthworks depth-band hatching</td><td><a href="topography/">Topography</a></td></tr>
        <tr><td><code class="cmd">INCBLOCK</code></td><td>Per-lot annotative blocks</td><td><a href="sheeting/">Sheeting</a></td></tr>
        <tr><td><code class="cmd">LANDXML</code></td><td>Import an ePlan / LandXML file</td><td><a href="utilities/">Utilities</a></td></tr>
        <tr><td><code class="cmd">LEVTOTXT</code></td><td>Write surface levels into text</td><td><a href="utilities/">Utilities</a></td></tr>
        <tr><td><code class="cmd">MOFFSET</code></td><td>Offset a whole selection at once</td><td><a href="utilities/">Utilities</a></td></tr>
        <tr><td><code class="cmd">MTC</code></td><td>Centre labels inside their lots</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">PEG</code></td><td>Peg symbols, or one per vertex</td><td><a href="survey/">Survey</a></td></tr>
        <tr><td><code class="cmd">PIPEL</code></td><td>Associative pipe assemblies</td><td><a href="utilities/">Utilities</a></td></tr>
        <tr><td><code class="cmd">SETLAYOUT</code></td><td>Per-lot sales layouts</td><td><a href="sheeting/">Sheeting</a></td></tr>
        <tr><td><code class="cmd">SSLOAD</code></td><td>Open or create the sheet set</td><td><a href="sheeting/">Sheeting</a></td></tr>
        <tr><td><code class="cmd">TADD</code></td><td>Add a prefix or suffix to text</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">TBG</code></td><td>Toggle background masks</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">TBRK</code></td><td>Toggle brackets around text</td><td><a href="text/">Text</a></td></tr>
        <tr><td><code class="cmd">TRUNC</code> / <code class="cmd">RROUND</code></td><td>Truncate or round numbers in text</td><td><a href="utilities/">Utilities</a></td></tr>
        <tr><td><code class="cmd">UPDATE</code></td><td>Title-block attributes from a CSV</td><td><a href="utilities/">Utilities</a></td></tr>
      </tbody>
    </table>
    </div>
""" + page_nav(prev=("../standards/wsy/", "WSY Drafting Standards"), nxt=("cadastre/", "Cadastre")))

# ------------------------------------------------------------------ Cadastre
body = """    <h1>Cadastre</h1>
    <p class="lede">
      Boundaries, lot numbers, areas, dimensions, bearings, easements and roads —
      the core deposited-plan drafting commands.
    </p>

    <h2>Boundaries</h2>
"""
body += cmd_block(
    "SUBBDY",
    "Puts lot boundary lines on the subject-boundary layer, or traces a new boundary.",
    ribbon="Cadastre → Subject Boundary",
    usage="<p>Select the lines first, then run the command — they're moved immediately with no prompts. "
          "With nothing selected it hands off to the native <code>-BOUNDARY</code> command so you can pick internal points.</p>",
    produces="Layer <strong>SUB BDY</strong> (cyan). Lines are replaced by two-vertex polylines; existing polylines are kept. "
             "Colour, linetype and lineweight are forced ByLayer.",
    notes="Only lines and polylines are touched — anything else in the selection is skipped. "
          "Because lines are recreated rather than modified, their object handles change.")
body += "\n" + cmd_block(
    "ADJBDY",
    "The same thing for adjoining lots.",
    ribbon="Cadastre → Adjoining Boundary",
    produces="Layer <strong>ADJ BDY</strong> (white).")
body += "\n" + cmd_block(
    "EASEA",
    "Draws or converts easement outlines on the dashed easement layer.",
    ribbon="Cadastre → Easement Area",
    usage="<p>Pre-select to convert, or run with nothing selected to trace with <code>-BOUNDARY</code>.</p>",
    produces="Layer <strong>EASEMENT</strong> (green, DASHED). Linetype scale is set to 0.25 so the dashes read at plan scale.",
    notes="Needs the DASHED linetype to be available in the drawing.")
body += "\n" + cmd_block(
    "EASEL",
    "Draws easement boundary lines by hand.",
    ribbon="Cadastre → Easement Lines",
    usage="<p>Runs the native <code>PLINE</code> command on the easement layer — draw as normal.</p>",
    produces="Layer <strong>EASEMENT</strong>, with the condensed linetype scale applied while drawing.")
body += "\n" + cmd_block(
    "EASEARROW",
    "Places an easement dimension arrow between two snapped points.",
    ribbon="Cadastre → Easement Arrow",
    usage="<p>Runs <code>DIMALIGNED</code> with intersection and insertion snaps forced on for the duration.</p>",
    produces="Layer <strong>EASEMENT LABEL</strong> using the <strong>EASEMENT LABEL</strong> dimension style.",
    notes="Your running object snaps are overridden while the command runs, then restored.")
body += "\n" + cmd_block(
    "EASEP",
    "Easement label leader — a spline leader with a dot arrowhead.",
    ribbon="Cadastre → Easement Marker",
    usage="<p>Runs the native <code>MLEADER</code> command.</p>",
    produces="Layer <strong>EASEMENT LABEL</strong>, text style THIN LABEL. The leader takes your current text style and height.")

body += """

    <h2>Lot text</h2>
    <p>
      These all work the same way. <strong>Select text first</strong> and it's restyled
      in place — single-line text is converted to MText. <strong>Run with nothing
      selected</strong> and it loops, prompting
      <code>Text insertion point [ESC to exit]:</code> and opening the text editor at
      each point until you press Esc.
    </p>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Command</th><th>Places</th><th>Text style</th><th>Layer</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">SUBLN</code></td><td>Subject lot number</td><td>LARGE LABEL</td><td>SUB DP</td></tr>
        <tr><td><code class="cmd">SUBA</code></td><td>Subject lot area</td><td>MEDIUM LABEL</td><td>SUB AREA</td></tr>
        <tr><td><code class="cmd">SUBD</code></td><td>Lot dimension text</td><td>SMALL LABEL</td><td>SUB DIMENSIONS</td></tr>
        <tr><td><code class="cmd">SUBB</code></td><td>Bearing and distance</td><td>SMALL LABEL</td><td>SUB BEARINGS</td></tr>
        <tr><td><code class="cmd">ADJLN</code></td><td>Adjoining lot number</td><td>ADJOINING LABEL</td><td>ADJ DP</td></tr>
        <tr><td><code class="cmd">ROADN</code></td><td>Road name</td><td>LARGE LABEL</td><td>ROAD NAME</td></tr>
        <tr><td><code class="cmd">ROADL</code></td><td>Road label</td><td>THIN LABEL</td><td>ROAD LABEL</td></tr>
        <tr><td><code class="cmd">EASET</code></td><td>Easement text</td><td>THIN LABEL</td><td>EASEMENT LABEL</td></tr>
      </tbody>
    </table>
    </div>
    <div class="note">
      <strong>Note</strong> — text height is the drawing's <code>TEXTSIZE</code> divided
      by the current annotation scale, and everything is created annotative. Set the
      right annotation scale before you place text.
    </div>

    <h2>Bearings</h2>
"""
body += cmd_block(
    "ALIGNA",
    "Stacks one text neatly under another at a fixed gap — typically an area under a lot number.",
    ribbon="Cadastre → Align Area",
    usage="<p>Prompts <code>Enter offset value &lt;2.0&gt;:</code> (the last value you used), then loops: "
          "<code>Select the anchor text:</code> → <code>Select text to align with anchor:</code>. "
          "The second text is moved below the first. Esc exits.</p>",
    produces="Moves existing text; creates nothing. The gap accounts for both text heights plus your offset, scaled by the annotation scale.",
    notes="Only text and mtext are accepted. The offset value is remembered for the rest of the session.")
body += "\n" + cmd_block(
    "STRETCHB",
    "Splits a bearing into three separate texts — degrees, minutes and seconds — so each can sit over its own boundary segment.",
    ribbon="Cadastre → Stretch Bearing",
    usage="""<p>Prompts <code>Enter input method [Manual/Select]:</code>.</p>
    <ul>
      <li><strong>Manual</strong> — asks for degrees, minutes and seconds in turn.</li>
      <li><strong>Select</strong> — pick an existing bearing text; it's parsed and <em>erased</em>.</li>
    </ul>
    <p>You then drag-align each piece onto a curve in turn: degrees, then minutes, then seconds.</p>""",
    produces="Three MText labels, style SMALL LABEL on layer <strong>SUB BEARINGS</strong>.",
    notes="The whole run is a single undo step — one <kbd>U</kbd> reverts all three labels and the erase.")
body += "\n" + cmd_block(
    "CSUBB",
    "The reverse of STRETCHB — merges three split bearing texts back into one label on a curve.",
    ribbon="Cadastre → Condense Bearing",
    usage="<p>Prompts for the degrees, minutes and seconds texts in turn. All three are erased and their "
          "contents joined, then you drag-align the combined label onto a curve.</p>",
    produces="One MText, style SMALL LABEL on <strong>SUB BEARINGS</strong>.",
    notes="!If you cancel the drag, the three source texts have already been erased — press <kbd>U</kbd> once to get them back.")
body += "\n" + cmd_block(
    "ROADLM",
    "Measures a road width between two points and writes <code>(X.XX WIDE)</code> at the midpoint.",
    ribbon="Cadastre → Road Label (Measured)",
    usage="<p><code>First point:</code> → <code>Second point:</code>, with perpendicular and nearest snaps forced on.</p>",
    produces="MText on layer <strong>ROAD LABEL</strong>, rotated perpendicular to the measured line and flipped if needed to stay readable.",
    notes="Single shot — it doesn't loop. The text runs across the road, not along it.")

body += "\n" + page_nav(prev=("../", "Command Reference"), nxt=("../survey/", "Survey"))
write("drafting/commands/cadastre/index.html", "drafting", "Cadastre Commands",
      "Boundary, lot text, bearing, easement and road commands in the WSY Drafting toolset.", body)

print("Command pages written: index, cadastre")
