# -*- coding: utf-8 -*-
"""Dimensions, topography, utilities + survey/engineering/onboarding/quality."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write as W, page_nav, cmd_block as CB

D = "drafting/commands/"

# ------------------------------------------------------------ Dimensions
b = """    <h1>Dimensions &amp; Curve Tables</h1>
    <p class="lede">Automatic boundary dimensioning, numbered curve labels, and the curve schedule
    that reads from them.</p>

    <div class="note"><strong>None of these have a ribbon button</strong> — they're typed at the
    command line. This is the largest and most useful part of the toolset that's easy to miss.</div>

    <h2 id="the-workflow">The workflow</h2>
    <p>These commands are designed to run in sequence:</p>
    <ol>
      <li><code class="cmd">AUTODIM</code> dimensions every boundary segment and drops a numbered
        label on each curve.</li>
      <li><code class="cmd">DIMRENUM</code> tidies the numbering if you've edited things.</li>
      <li><code class="cmd">CURVETABLE</code> builds a schedule from those numbered labels.</li>
      <li><code class="cmd">CURVETABLEUPDATE</code> resyncs the table after further edits.</li>
    </ol>

    <h2 id="dimensioning">Dimensioning</h2>
"""
b += CB("AUTODIM", "Dimensions every segment of the selected lot boundaries in one hit — length inside, bearing outside, and a numbered label on each curve.",
        usage="""<p>Pre-select, or <code>Select polylines/arcs:</code>. Then
        <code>Enter precision &lt;3&gt;:</code> → <code>Include bearings? [Yes/No] &lt;Yes&gt;:</code>
        → <code>Starting curve number:</code> (defaults to this drawing's highest existing label plus one).</p>""",
        produces="Lengths on <strong>SUB DIMENSIONS</strong>, bearings on <strong>SUB BEARINGS</strong>, and a Dimension Label block on <strong>DIM LABEL</strong> for each arc carrying its chord, arc, radius and bearing as hidden attributes.",
        notes="""Several behaviours worth knowing. For a closed lot, dimensions go <em>inside</em> and
        bearings <em>outside</em>. A boundary shared between two lots is dimensioned once, not twice.
        Existing labels are never doubled up, so re-running after edits only fills the gaps. Collinear
        runs merge into one stretched bearing. Segments it can't dimension are counted and reported
        rather than hidden.""")
b += "\n" + CB("DIMLAB", "Places numbered dimension-label bubbles, or converts existing text into them.",
        usage="<p>Pre-select text to convert it. Otherwise <code>Specify starting number:</code> then place them one at a time; the number increments as you go.</p>",
        produces="Dimension Label blocks on <strong>DIM LABEL</strong>.",
        notes="Numbering continues from the highest number already in the drawing and skips any number already in use. The whole run is one undo step.")
b += "\n" + CB("DIMRENUM", "Renumbers dimension labels in sequence, closing gaps left by deleted ones.",
        usage="<p>Pre-select, or <code>Select dimension labels to renumber:</code> → <code>Starting number &lt;1&gt;:</code>.</p>",
        notes="Existing relative order is preserved — labels are sorted by their current number, so renumbering closes gaps without shuffling things around.")
b += """

    <h2 id="curve-tables">Curve tables</h2>
"""
b += CB("CURVETABLE", "Builds a schedule of curved dimensions from the numbered curve labels, or exports them to CSV.",
        usage="""<p><strong>In model space:</strong> pre-select, or <code>Select dimension label blocks
        or Enter for all:</code>. <strong>In a layout:</strong> it asks you to
        <code>Select viewport:</code> and includes only the labels visible in it.</p>
        <p>Then <code>N curves — specify table insertion point or [Export]:</code>. Export writes a CSV.</p>""",
        produces="A table titled <em>Schedule of Short &amp; Curved Dimensions</em> on the <strong>TEXT</strong> layer, with columns for number, bearing, chord, arc and radius, sorted numerically.",
        notes="""Viewport scoping is the subtle part: a label must both carry that viewport's annotation
        scale <em>and</em> fall inside its boundary — respecting a non-rectangular clip if there is one.
        If nothing qualifies, the message tells you exactly what was rejected and why.""")
b += "\n" + CB("CURVETABLEUPDATE", "Resyncs a placed curve table with the drawing — adds new curves, drops deleted ones, refreshes changed values.",
        usage="<p><code>Select curve table to update or Enter to refresh all:</code>.</p>",
        notes="Only works on tables created by CURVETABLE. The table keeps the size it was created at, so it won't jump around if you've changed annotation scale.")
b += "\n" + CB("CURVETABLEAUTO", "Turns live curve-table refreshing on or off.",
        usage="<p>A toggle — no prompts. The setting is remembered between sessions.</p>",
        notes="Off by default. When on, linked tables refresh shortly after you stop editing. The refresh doesn't add undo steps.")
b += "\n" + CB("DIMDATA", "The inverse of CURVETABLE — reads a hand-drawn or imported curve schedule and writes its values back into the matching numbered labels.",
        usage="<p>Pre-select, or <code>Select the curve schedule text (window the whole table):</code>.</p>",
        notes="Built for surveyor DXF exports. It reconstructs the table from the text positions, using a header row if one is present, otherwise assuming the standard No / Bearing / Chord / Arc / Radius order.")
b += "\n" + CB("ALAB", "Labels each selected lot with its area.",
        usage="<p>Pre-select, or <code>Select polylines to label:</code>.</p>",
        produces="Area labels on <strong>SUB AREA</strong>, placed inside each lot. Areas read in m² below a hectare and ha above.")
b += "\n" + page_nav(prev=("../sheeting/", "Sheeting"), nxt=("../topography/", "Topography & Earthworks"))
W(D + "dimensions/index.html", "drafting", "Dimensions & Curve Tables",
  "Automatic boundary dimensioning, numbered curve labels and curve schedules.", b)

# ------------------------------------------------------------ Topography
b = """    <h1>Topography &amp; Earthworks</h1>
    <p class="lede">Batters, contour labels, surface levels and fill-plan hatching.</p>

    <h2 id="commands">Commands</h2>
"""
b += CB("BATTER", "Fills the space between a top and toe line with batter ticks, each stretched to span the gap.",
        ribbon="Topography → Batter",
        usage="""<p><code>Select top batter curve:</code> → <code>Select toe (bottom) batter curve:</code>
        → then drag: the distance from the top line divided by the local gap sets the tick spacing,
        and the whole run previews live. Click to confirm, Esc to cancel.</p>""",
        produces="Batter blocks on the <strong>BATTER</strong> layer, each rotated toward the toe and scaled to span the local gap.",
        notes="Spacing is adaptive — ticks crowd where the batter narrows. Works on 3D top and toe strings, though the output lands flat.")
b += "\n" + CB("CONTLAB", "Labels a contour with its elevation, sitting the text on the line with a mask through it.",
        ribbon="Topography → Contour Label",
        usage="<p>Loops: <code>Select contour &lt;exit&gt;:</code> then drag the label along it. Enter or Esc exits.</p>",
        produces="Masked annotative text on your current layer and style, moved above the contour so the mask reads.",
        notes="The elevation comes from the contour's start point. Offset and rotation are forced to zero during the drag so the label sits on the line, then your ATC preferences are restored.")
b += "\n" + CB("LEVTOTXT", "Writes surface levels into existing text by picking points.",
        usage="<p>Picks an elevation source first, then loops: <code>Select text:</code> → <code>Select point for level:</code>.</p>",
        produces="Overwrites the picked text with the elevation to one decimal place.",
        notes="Uses the drawing's TIN surface if there is one, otherwise builds a mesh from 3D faces. Because it samples a surface, your pick only needs to be right in plan — you don't have to snap to 3D geometry. No ribbon button.")
b += """

    <h2 id="fill-plans">Fill plans</h2>
    <p><code class="cmd">FILL1</code> through <code class="cmd">FILL11</code> hatch earthworks depth
    bands. Each sets its layer then runs a solid hatch behind the boundary, repeating until you press
    Esc — so you can hatch many lots in one band without re-running.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Depth band</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">FILL1</code></td><td>0.0 – 0.5</td></tr>
        <tr><td><code class="cmd">FILL2</code></td><td>0.5 – 1.0</td></tr>
        <tr><td><code class="cmd">FILL3</code></td><td>1.0 – 1.5</td></tr>
        <tr><td><code class="cmd">FILL4</code></td><td>1.5 – 2.0</td></tr>
        <tr><td><code class="cmd">FILL5</code></td><td>2.0 – 2.5</td></tr>
        <tr><td><code class="cmd">FILL6</code></td><td>2.5 – 3.0</td></tr>
        <tr><td><code class="cmd">FILL7</code></td><td>Over 3</td></tr>
        <tr><td><code class="cmd">FILL8</code> – <code class="cmd">FILL11</code></td><td>4, 5, 6 and 7</td></tr>
      </tbody>
    </table></div>
    <div class="note"><strong>Note</strong> — none of the fill commands has a ribbon button.</div>
""" + page_nav(prev=("../dimensions/", "Dimensions & Curve Tables"), nxt=("../utilities/", "Utilities"))
W(D + "topography/index.html", "drafting", "Topography & Earthworks",
  "Batters, contour labels, surface levels and fill-plan hatching.", b)

# ------------------------------------------------------------ Utilities
b = """    <h1>Utilities</h1>
    <p class="lede">Offsetting, copying to vertices, pipes, imports and text number tools. Mostly
    command-line only.</p>

    <h2 id="drawing-tools">Drawing tools</h2>
"""
b += CB("MOFFSET", "Offsets a whole selection at once, with a live preview, repeating until you stop.",
        usage="""<p><code>Specify offset distance or [Through/Erase]:</code> — <strong>Erase</strong>
        asks whether to delete the sources, <strong>Through</strong> takes the distance from the cursor.
        Then select objects and drag to choose the side.</p>""",
        notes="The curve nearest your cursor decides the side, and other closed shapes follow the same sense — so a batch of lots all shrink or all grow together rather than splitting. You can type an exact distance mid-drag.")
b += "\n" + CB("VCOPY", "Copies blocks or text to every vertex of the chosen polylines.",
        usage="<p>Pre-select the objects to copy, or you'll be asked. Then <code>Base point:</code> → <code>Select target polylines:</code>.</p>")
b += "\n" + CB("PIPEL", "Turns polylines into pipes — a styled centreline with two wall lines that follow it when you edit.",
        usage="<p>Pre-select, or <code>Select polylines to convert to pipes:</code> → <code>Enter pipe size:</code>.</p>",
        notes="The walls stay associated with the centreline: edit the centreline and they follow. They're deliberately locked so they can't be dragged off. The last size is remembered between sessions.")
b += """

    <h2 id="import">Import</h2>
"""
b += CB("LANDXML", "Imports an NSW ePlan / LandXML file — lot boundaries, lot numbers with areas, and monument labels.",
        usage="<p>Opens a file dialog, then <code>Import CgPoints as point entities? [Yes/No] &lt;No&gt;:</code>.</p>",
        produces="Boundaries on the subject or adjoining layers by parcel class, with labels on the matching text layers. Arcs are preserved.",
        notes="Two data-quality guards: a curve whose geometry is inconsistent degrades to a straight chord rather than a wild arc, and arcs sweeping over 180° are redrawn as the minor arc and reported so you can check them against the plan.")
b += """

    <h2 id="text-numbers">Text numbers</h2>
"""
b += CB("TRUNC", "Chops decimals off the number in selected text — cutting, not rounding.",
        usage="<p>Pre-select, then <code>Decimal places &lt;2&gt;:</code>.</p>",
        notes="Only the first number in the text is affected.")
b += "\n" + CB("RROUND", "Rounds the number in selected text — up, down or to nearest.",
        usage="<p><code>Rounding mode [Nearest/Up/Down]:</code> → <code>Decimal places &lt;2&gt;:</code>.</p>")
b += """

    <h2 id="title-blocks">Title blocks</h2>
"""
b += CB("UPDATE", "Fills in title-block attributes across all layouts from a central CSV register.",
        usage="<p>No prompts — it runs from files.</p>",
        notes="Needs a <code>_DWGLISTCSV.TXT</code> file beside the drawing whose first line names the CSV register. The CSV has the drawing name in the first column, layout name in the second, and attribute tags as the remaining headers.")
b += "\n" + CB("OB2WO", "Turns closed shapes into wipeouts.",
        usage="<p>Pre-select or select circles, ellipses and polylines, then <code>Do you want to keep the original entities? [Yes/No] &lt;Yes&gt;:</code>.</p>")
b += "\n" + CB("SMT / STRIPMTEXT", "Strips all inline formatting out of text, leaving the plain words.",
        usage="<p>Pre-select, or select mtext, leaders, dimensions or blocks with attributes.</p>",
        notes="Line breaks are kept — they're content, not formatting. Background masks aren't touched; use TBG for those.")
b += "\n" + CB("WSYUPDATE", "Checks for a newer release of the suite and launches the installer.",
        usage="<p>If an update exists: <code>Update to vX? BricsCAD will need to close to finish. [Yes/No] &lt;Yes&gt;:</code>.</p>")
b += "\n" + page_nav(prev=("../topography/", "Topography & Earthworks"), nxt=("../../../survey/", "Survey"))
W(D + "utilities/index.html", "drafting", "Utility Commands",
  "Offsets, vertex copying, pipes, LandXML import and text tools.", b)

print("Dimensions / topography / utilities written.")
