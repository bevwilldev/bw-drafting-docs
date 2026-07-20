# -*- coding: utf-8 -*-
"""Remaining command panel pages + survey, engineering, onboarding, quality."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write as W, page_nav, cmd_block as CB

D = "drafting/commands/"

# ------------------------------------------------------------ Survey commands
b = """    <h1>Survey Commands</h1>
    <p class="lede">Pegs, reference marks, survey marks, ties and traverse lines.</p>

    <h2>Marks and symbols</h2>
"""
b += CB("PEG", "Drops peg symbols, either one at a time or on every vertex of chosen polylines.",
        ribbon="Survey → Peg",
        usage="""<p>Select polylines first and a peg is placed on every vertex. Otherwise:
        <code>Specify insertion point or [Place]:</code> — pick points one at a time, or type
        <strong>Place</strong> to select polylines instead. Endpoint snap is forced on.</p>""",
        produces="Peg blocks on layer <strong>PEG</strong>, annotative and attached to the current scale.",
        notes="Vertex mode skips any vertex that already has a block, so re-running is safe.")
b += "\n" + CB("REF", "Places reference marks, or swaps existing blocks for reference marks in place.",
        ribbon="Survey → Reference Mark",
        usage="""<p><code>Specify insertion point or [Replace]:</code>. <strong>Replace</strong>
        loops asking for blocks to swap; each is erased and a reference mark inserted at its
        position.</p>""",
        produces="Reference Mark blocks on <strong>SURV REFERENCE</strong>, annotative.",
        notes="Replace keeps only the position — rotation and attributes of the old block are discarded.")
b += "\n" + CB("SURVSSM", "Places SSM (state survey mark) symbols in a loop.",
        ribbon="Survey → SSM",
        usage="<p>Loops <code>Specify insertion point:</code> until you press Enter or Esc.</p>",
        produces="SSM blocks on <strong>SURV SSM MARK</strong>, annotative.")
b += "\n" + CB("SSMX / SSMY", "Place a single 'X' or 'Y' mark symbol.",
        ribbon="Survey → 'X' Symbol / 'Y' Symbol",
        usage="<p>One prompt: <code>Specify insertion point:</code>. Single shot — these don't repeat.</p>",
        produces="X or Y blocks on <strong>SURV SSM MARK</strong>.")
b += """

    <h2>Lines</h2>
"""
b += CB("TIEL", "Draws a tie line between two points, labelling the distance on one side and the bearing on the other.",
        ribbon="Survey → Ties",
        usage="<p><code>Specify base point for leader:</code> → <code>Specify second point for leader:</code>, with endpoint, intersection and perpendicular snaps forced on.</p>",
        produces="A dashed leader on <strong>SURV TIES</strong> plus two labels on <strong>SURV TIES TEXT</strong>. Distance is rounded to the nearest 0.005; the bearing reads to the nearest 5 seconds.")
b += "\n" + CB("TRAVL", "Draws a traverse line — a dashed annotative leader with no text.",
        ribbon="Survey → Traverse",
        usage="<p>Runs the native <code>MLEADER</code> command.</p>",
        produces="Layer <strong>SURV TRAVERSE</strong> with the condensed linetype scale.")
b += """

    <h2>Survey text</h2>
    <p>These follow the same pattern as the cadastre text commands — pre-select to restyle, or run
    with nothing selected to place new text in a loop.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Places</th><th>Layer</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">REFT</code></td><td>Reference mark text</td><td>SURV REFERENCE TEXT</td></tr>
        <tr><td><code class="cmd">TIET</code></td><td>Ties text</td><td>SURV TIES TEXT</td></tr>
        <tr><td><code class="cmd">SSMT</code></td><td>SSM / MGA text</td><td>SURV SSM TEXT</td></tr>
        <tr><td><code class="cmd">TRAVT</code></td><td>Traverse text</td><td>SURV TRAVERSE TEXT</td></tr>
        <tr><td><code class="cmd">OCCST</code></td><td>Occupations text</td><td>SURV OCCS TEXT</td></tr>
      </tbody>
    </table></div>

    <h2>Occupations</h2>
"""
b += CB("OSFCE", "Draws an occupation fence line using the fence linetype.",
        ribbon="Occupations → Fence",
        produces="Layer <strong>SURV OCCS</strong> with the Fence linetype.",
        notes="Needs the Support linetype file. If the fence draws solid, the linetype didn't load — see Troubleshooting.")
b += "\n" + CB("BDYFCE", "Boundary fence tick line.", ribbon="Occupations → Fence Ticks",
        produces="Layer <strong>SURV OCCS</strong> with the Fence Tick linetype.")
b += "\n" + CB("DPWALL", "Inserts a wall symbol at a point and rotation.", ribbon="Occupations → Wall",
        usage="<p><code>Specify insertion point:</code> → <code>Specify rotation &lt;0&gt;:</code>.</p>",
        produces="Wall blocks on <strong>SURV OCCS</strong>, annotative.")
b += "\n" + page_nav(prev=("../cadastre/", "Cadastre"), nxt=("../text/", "Text & Labels"))
W(D + "survey/index.html", "drafting", "Survey Commands",
  "Pegs, reference marks, SSMs, ties, traverse lines and occupations.", b)

# ------------------------------------------------------------ Text commands
b = """    <h1>Text &amp; Labels</h1>
    <p class="lede">Text styles, leaders, and the tools for placing and tidying labels.</p>

    <h2>Text styles</h2>
    <p>Pre-select text to restyle it, or run with nothing selected to place new text in a loop.
    All four place on the <strong>TEXT</strong> layer.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Style</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">THINTXT</code></td><td>THIN LABEL</td></tr>
        <tr><td><code class="cmd">SMALLTXT</code></td><td>SMALL LABEL</td></tr>
        <tr><td><code class="cmd">MEDTXT</code></td><td>MEDIUM LABEL</td></tr>
        <tr><td><code class="cmd">LRGTXT</code></td><td>LARGE LABEL</td></tr>
      </tbody>
    </table></div>

    <h2>Leaders</h2>
"""
b += CB("STRAIGHTLEADER / CURVELEADER", "Label leaders — straight-segment or spline — whose text matches your current style.",
        ribbon="Text → Straight Leader / Curved Leader",
        usage="<p>Both run the native <code>MLEADER</code> command.</p>",
        produces="The leader takes your current text style and height, so it matches surrounding annotation.")
b += """

    <h2>Placing and aligning</h2>
"""
b += CB("ATC", "Aligns text along a curve with a live drag preview.",
        ribbon="Text → Align Text to Curve",
        usage="""<p><code>Select text to align [New/Settings] &lt;Exit&gt;:</code> — pick existing text,
        type <strong>New</strong> to type fresh text, or <strong>Settings</strong> to open the options
        dialog. Then pick the curve or multileader to align to, and drag into position.</p>
        <p>While dragging: <kbd>+</kbd>/<kbd>-</kbd> step the offset, <kbd>&lt;</kbd>/<kbd>&gt;</kbd>
        rotate, <kbd>Y</kbd> toggles readability, <kbd>B</kbd> toggles the background mask,
        <kbd>O</kbd> and <kbd>R</kbd> prompt for exact values.</p>""",
        produces="Aligns the picked text, or creates new text using the layer and style set in Settings.",
        notes="Settings has a <em>Multiple</em> mode that keeps placing copies down a line, and a <em>Copy</em> mode that leaves the original in place. Settings persist between sessions and are shared with CLABEL.")
b += "\n" + CB("CLABEL", "Type a phrase and drag each word onto a curve in turn.",
        ribbon="Text → Align Custom Label",
        usage="<p><code>Enter label words (space-separated):</code> then drag each word onto a curve. The word list wraps, so you can keep going along a fence line.</p>",
        produces="Text created with the shared ATC settings.")
b += "\n" + CB("MTC", "Drops each selected label into the middle of its lot.",
        ribbon="Text → Move to Center",
        usage="<p>Pre-select, or <code>Select closed polylines and text:</code>. Each label is moved to an interior point of the nearest unused closed polyline.</p>",
        produces="Moves existing mtext; creates nothing.",
        notes="Works on concave lots — the interior point is genuinely inside the polygon, not just the centroid.")
b += """

    <h2>Tidying text</h2>
"""
b += CB("TBRK", "Adds or removes brackets around selected text.", ribbon="Text → Toggle Brackets",
        usage="<p>Pre-select, or select text, mtext, leaders or dimensions. Each is toggled individually.</p>",
        notes="Dimensions keep their live measured value — the brackets are applied as a text override around the measurement, not baked in.")
b += "\n" + CB("TBG", "Turns background masks on or off behind selected text.", ribbon="Text → Toggle Background Mask",
        usage="<p>Pre-select to toggle immediately, or run and use the <strong>Settings</strong> keyword to set the mask scale and colour first.</p>",
        notes="Settings offers the drawing background, a chosen colour, or <em>Auto</em>, which samples the colour of whatever hatch sits beneath the text. Changing settings forces the mask on rather than toggling.")
b += "\n" + CB("TADD", "Adds a prefix or suffix to selected text.",
        usage="<p><code>Add text as [Prefix/Suffix] &lt;Suffix&gt;:</code> → <code>Text to add:</code>. Pre-select, or you'll be asked to select afterwards.</p>",
        notes="Dimensions keep their live measurement, as with TBRK.")
b += "\n" + page_nav(prev=("../survey/", "Survey"), nxt=("../annotation/", "Annotation & Scales"))
W(D + "text/index.html", "drafting", "Text & Label Commands",
  "Text styles, leaders, curve-aligned labels, brackets and background masks.", b)

# ------------------------------------------------------------ Annotation
b = """    <h1>Annotation &amp; Scales</h1>
    <p class="lede">Creating the annotation scales a drawing needs, and moving between them.</p>

    <div class="note"><strong>Why this matters</strong> — nearly everything the toolset places is
    annotative, meaning it displays at the size appropriate to the current annotation scale. Set
    the scale before you place annotation.</div>

    <h2>Commands</h2>
"""
b += CB("CSCALE", "Creates annotation scales from a dialog, working out the ratio for you.",
        ribbon="Annotation → Create New Scale",
        usage="""<p>Opens a dialog. Enter the drawing units (the denominator — 200 for 1:200) and a
        name. The <strong>▾</strong> menu inserts sequence tokens so you can create a run of scales
        at once:</p>
        <ul>
          <li><code>{1-5}</code> — numbers, so <em>Sheet {1-5}</em> makes Sheet 1 … Sheet 5</li>
          <li><code>{01-10}</code> — zero-padded numbers</li>
          <li><code>{A-E}</code> — letters</li>
        </ul>
        <p>Queue scales with <strong>+</strong>; they're all created when you close the dialog.</p>""",
        produces="Named annotation scales using the office convention for metre drawings — 1:200 becomes paper 1, drawing 0.2.",
        notes="This is the same tool on the BW Engineering ribbon. Use it to build the named per-lot scales that SETLAYOUT and INCBLOCK rely on.")
b += "\n" + CB("ANNONEXT / ANNOPREV", "Step forward or back through the drawing's annotation scales.",
        ribbon="Annotation → Next Scale / Previous Scale",
        usage="<p>No prompts. The new scale is reported on the command line, and the list wraps at both ends.</p>",
        notes="Scales imported from xrefs are skipped, so cycling stays within the drawing's own list.")
b += "\n" + CB("ANNOTOG", "Shows or hides annotative objects at all scales, not just the current one.",
        usage="<p>No prompts — it's a toggle, and reports the new state.</p>",
        notes="Useful for checking what's attached to which scale. No ribbon button.")
b += "\n" + page_nav(prev=("../text/", "Text & Labels"), nxt=("../sheeting/", "Sheeting"))
W(D + "annotation/index.html", "drafting", "Annotation & Scale Commands",
  "Creating annotation scales and cycling through them.", b)

# ------------------------------------------------------------ Sheeting
b = """    <h1>Sheeting</h1>
    <p class="lede">North points, sheet sets, and building per-lot sales layouts.</p>

    <h2>Commands</h2>
"""
b += CB("ADDNORTH", "Drops a north point already rotated to match a viewport's twist.",
        ribbon="Sheeting → North Point",
        usage="<p><code>Select viewport:</code> — then the symbol follows your cursor; click to place. Esc cancels.</p>",
        produces="A North Point block on layer <strong>NORTH</strong>, annotative, rotated to the viewport's twist angle.",
        notes="You can pick the viewport's clip boundary instead of its edge — it resolves to the owning viewport either way.")
b += "\n" + CB("SSLOAD", "Opens this drawing's sheet set, or offers to build one if it doesn't exist.",
        ribbon="Sheeting → Sheet Set",
        usage="""<p>If a matching <code>.dst</code> sits beside the drawing it opens and saves. Otherwise:
        <code>No sheet set found for this drawing (name.dst). Create one? [Yes/No] &lt;Yes&gt;:</code>
        — on Yes it picks a template, adds every paper layout as a sheet, and opens the result.</p>""",
        produces="A sheet set named after the drawing, in the drawing's folder.",
        notes="Requires a saved drawing with at least one paper layout. The template is chosen from the drawing's filename suffix — DP/SP/CP/PP use the plan form template, SET/ID/FW/PEG the setout template, SAL/LOT the lot template, anything else the detail template.")
b += "\n" + CB("SETLAYOUT", "Builds a complete set of per-lot sales layouts — one sheet per lot, each centred and scaled to its own lot.",
        usage="<p><code>Select the viewport in your MAIN sales layout:</code> → <code>Enter plot scale denominator &lt;200&gt;:</code>. Everything else is automatic.</p>",
        produces="One annotation scale and one layout per lot, each viewport centred on its lot. Tabs are sorted into lot order.",
        notes="Lot numbers are read as text on the <strong>SUB DP</strong> layer — so a missing or mis-layered lot number simply won't get a sheet, which makes this a useful QA pass. Pair with INCBLOCK. No ribbon button.")
b += "\n" + CB("INCBLOCK", "Turns each lot into a numbered annotative block that's only visible at its own scale.",
        usage="<p><code>Enter starting block number:</code> then loop: <code>Select lot to block as \"N\":</code>. The annotation scale advances after each lot.</p>",
        produces="A block named after each number containing a copy of the lot, referenced on <strong>SUB BDY</strong>.",
        notes="The original lot is never consumed — a copy becomes the block content. This is the trick that makes each sales sheet show only its own lot. Create the named per-lot scales first with CSCALE. No ribbon button.")
b += "\n" + page_nav(prev=("../annotation/", "Annotation & Scales"), nxt=("../dimensions/", "Dimensions & Curve Tables"))
W(D + "sheeting/index.html", "drafting", "Sheeting Commands",
  "North points, sheet sets and per-lot sales layouts.", b)

print("Survey / text / annotation / sheeting command pages written.")
