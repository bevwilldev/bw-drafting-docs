# -*- coding: utf-8 -*-
"""Survey (WAE, lot loader, point cloud), engineering, quality, onboarding."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write as W, page_nav, cmd_block as CB

# =============================================================== SURVEY / WAE
W("survey/wae/index.html", "survey", "Works-As-Executed",
  "The WAE ribbon: what it's for and what's on it.",
  """    <h1>Works-As-Executed</h1>
    <p class="lede">WAE plans record what was actually built against what was designed. The WAE
    ribbon covers bringing the design sheets in, marking them up, and the standard annotations.</p>
    <figure><img src="../../assets/img/wae-ribbon.gif" alt="The WAE Tools ribbon"></figure>

    <h2 id="the-workflow">The workflow</h2>
    <ol>
      <li><a href="import-sheet/">Import the sheets</a> — each raster becomes its own layout,
        scaled to paper and ready to plot.</li>
      <li>Mark up in red over the design using the <a href="labels/">preset labels</a> and
        <a href="text/">WAE text</a>.</li>
      <li><a href="calculate-grade/">Calculate grades</a> where levels need checking.</li>
      <li><a href="add-comment/">Add the certification note</a> to the front sheet.</li>
    </ol>

    <h2 id="annotation-environment">Annotation environment</h2>
    <p>Most WAE commands set the environment for you before doing anything: the
    <strong>ANNOTATIONS</strong> layer and the <strong>WAE LABEL</strong> text style, which has a
    fixed height because WAE sheets are worked at paper scale rather than annotative.</p>
""" + page_nav(prev=("../", "Survey"), nxt=("import-sheet/", "Import Sheet")))

W("survey/wae/import-sheet/index.html", "survey", "Import Sheet",
  "Bringing raster design sheets in as scaled layouts.",
  """    <h1>Import Sheet</h1>
    <p class="lede">Turns a folder of scanned or exported design sheets into one layout each,
    with the image stretched to the paper and the page set up ready to plot.</p>

    <h2 id="using-it">Using it</h2>
    <ol>
      <li>Run <code class="cmd">IMPORTSHEET</code>.</li>
      <li><code>Specify sheet size [A4/A3/A2/A1] &lt;A1&gt;:</code> — press Enter for A1.</li>
      <li>Pick the images in the file dialog. You can select many at once. It opens in the
        drawing's <em>Rasters</em> folder if there is one.</li>
      <li>If some sheets already have layouts you'll be asked once:
        <code>N of the selected sheet(s) already have layouts [Replace/Skip] &lt;Skip&gt;:</code>.</li>
    </ol>

    <h2 id="what-you-get">What you get</h2>
    <p>One layout per image, named after the file, with the image filling the sheet on the
    <strong>SHEET</strong> layer. Each layout is set up to plot as a PDF at the chosen size,
    rotated to landscape, centred, using the BW plot styles. The default viewport is removed so
    nothing from model space shows through, and each tab opens framed on its sheet.</p>

    <div class="note"><strong>Tip</strong> — the whole import is a single undo step. If it isn't
    what you wanted, one <kbd>U</kbd> removes every layout it made.</div>

    <h2 id="if-something-goes-wrong">If something goes wrong</h2>
    <ul>
      <li>Sheets import but aren't set up to plot — the BW plot device isn't installed. Re-run the
        suite installer with the WAE component ticked.</li>
      <li>A file is skipped — its name couldn't be used as a layout name, or a layout with that
        name already exists and you chose Skip. Both are reported per file.</li>
    </ul>
""" + page_nav(prev=("../", "Works-As-Executed"), nxt=("../labels/", "Preset Labels")))

W("survey/wae/labels/index.html", "survey", "Preset Labels",
  "The standard WAE label set on the ribbon.",
  """    <h1>Preset Labels</h1>
    <p class="lede">The ribbon carries the standard WAE labels as buttons, so the common
    annotations are one click rather than typed each time.</p>
    <figure><img src="../../../assets/img/wae-labels.gif" alt="Placing preset WAE labels"></figure>

    <h2 id="placing-a-label">Placing a label</h2>
    <p>Click the label you want, then: <code>Specify point to place text:</code> →
    <code>Specify rotation:</code> (a second point — pick the same point for horizontal). It keeps
    looping so you can place the same label repeatedly; Esc finishes.</p>

    <h2 id="pipe-sizes">Pipe sizes</h2>
    <p>Ø150, Ø225, Ø300, Ø375, Ø450, Ø525, Ø600, Ø750, Ø900, Ø1050, Ø1200 and Ø1300.</p>

    <h2 id="pit-sizes">Pit sizes</h2>
    <p>450&times;450, 450&times;600, 600&times;600, 600&times;900 and 900&times;900.</p>

    <h2 id="lintel-sizes">Lintel sizes</h2>
    <p>0.9 m, 1.2 m, 1.8 m, 2.4 m, 3.0 m and 3.6 m.</p>

    <h2 id="status-labels">Status labels</h2>
    <p>Provided, Not Provided, Constructed, Not Constructed, Removed, Installed, Not Installed,
    Under Construction, Limit of Construction and Observed.</p>

    <h2 id="tick-symbol">Tick symbol</h2>
    <p><code class="cmd">WAETICK</code> inserts the WAE tick repeatedly until you press Esc.</p>
""" + page_nav(prev=("../import-sheet/", "Import Sheet"), nxt=("../text/", "Horizontal & Vertical Text")))

W("survey/wae/text/index.html", "survey", "Horizontal & Vertical Text",
  "Placing WAE text at fixed rotations.",
  """    <h1>Horizontal &amp; Vertical Text</h1>
    <p class="lede">Quick WAE text at a fixed rotation, for annotating rotated sheets without
    fighting the UCS.</p>

    <h2 id="commands">Commands</h2>
    <ul>
      <li><code class="cmd">HTXT</code> — text at 0°, reading horizontally.</li>
      <li><code class="cmd">VTXT</code> — text at 270°, reading up the sheet.</li>
    </ul>

    <h2 id="using-them">Using them</h2>
    <p>Run the command, then <code>Text insertion point:</code>. The text editor opens at that
    point — type the content and finish as normal. Because the WAE label style has a fixed height
    you're not asked for one.</p>

    <div class="note"><strong>Note</strong> — both temporarily set the drawing's angle base to
    zero so the rotation is absolute, then restore it. If you interrupt the command, the setting is
    still restored.</div>
""" + page_nav(prev=("../labels/", "Preset Labels"), nxt=("../calculate-grade/", "Calculate Grade")))

W("survey/wae/calculate-grade/index.html", "survey", "Calculate Grade",
  "Working out and placing a grade percentage.",
  """    <h1>Calculate Grade</h1>
    <p class="lede">Computes the grade between two levels over a chainage and places it as a
    labelled percentage.</p>

    <h2 id="using-it">Using it</h2>
    <p>Run <code class="cmd">CALCGRADE</code>. For each grade:</p>
    <ol>
      <li><code>Select first level or press Enter to input manually:</code> — pick a level text and
        the number is read out of it, or press Enter to type a value.</li>
      <li>The same for the second level.</li>
      <li><code>Choose chainage method [Direct/Calculate]:</code> — <strong>Direct</strong> to type
        the chainage, or <strong>Calculate</strong> to enter two lengths and use the difference.</li>
      <li><code>Specify point to place &lt;grade&gt; grade text:</code> — the computed value is
        already shown in the prompt.</li>
    </ol>
    <p>It loops so you can do several in a row; Esc finishes.</p>

    <h2 id="what-you-get">What you get</h2>
    <p>The grade as a percentage to one decimal place, placed as WAE label text — for example
    <code>1.5%</code>. The calculation is the level difference divided by the chainage.</p>

    <div class="note"><strong>Note</strong> — a chainage of zero is rejected and the command
    starts again rather than failing.</div>
""" + page_nav(prev=("../text/", "Horizontal & Vertical Text"), nxt=("../add-comment/", "Add Comment")))

W("survey/wae/add-comment/index.html", "survey", "Add Comment",
  "Placing the surveyor certification note.",
  """    <h1>Add Comment</h1>
    <p class="lede">Places the standard surveyor certification note on the front sheet.</p>
    <figure><img src="../../../assets/img/wae-comment.gif" alt="Placing the certification comment"></figure>

    <h2 id="using-it">Using it</h2>
    <p>Run <code class="cmd">ADDCOMMENT</code>, then:</p>
    <ol>
      <li><code>Select Surveyor [Ben/Angela/Peter]:</code> — expands to the surveyor's full
        registered name.</li>
      <li><code>Select Surface type [First/Second/fInal]:</code> — the AC layer the road
        centrelines were taken on.</li>
      <li><code>Specify point to place text:</code>.</li>
    </ol>

    <h2 id="what-you-get">What you get</h2>
    <p>The full certification paragraph as a fixed-width text block, covering the work-as-executed
    statement, interallotment drainage, the road centreline layer, the height datum and pit and
    pipe sizes — followed by a signature rule and a line for the date and any additional comments.</p>
""" + page_nav(prev=("../calculate-grade/", "Calculate Grade"), nxt=("../modify-text/", "Modify & Flip Text")))

W("survey/wae/modify-text/index.html", "survey", "Modify & Flip Text",
  "Adding prefixes and suffixes, and flipping text.",
  """    <h1>Modify &amp; Flip Text</h1>
    <p class="lede">Two small tools for tidying annotation on a marked-up sheet.</p>
    <figure><img src="../../../assets/img/wae-modtxt.gif" alt="Modifying text with a prefix or suffix"></figure>

    <h2 id="modify-text">Modify Text</h2>
    <p>Adds a prefix or suffix to selected text. Run <code class="cmd">MODTEXT</code> — select the
    text first if you like — then <code>Choose [Prefix/Suffix]:</code> and
    <code>Enter text for Prefix/Suffix:</code>. Works on text, mtext and multileaders.</p>

    <h2 id="flip-text">Flip Text</h2>
    <p><code class="cmd">FLIPTEXT</code> rotates selected text 180° about its middle centre —
    useful when a marked-up sheet is rotated and annotation ends up upside down.</p>

    <div class="note"><strong>Note</strong> — flipping changes the text's justification to middle
    centre permanently, so flipping twice doesn't restore the original justification.</div>
""" + page_nav(prev=("../add-comment/", "Add Comment"), nxt=("../../lot-loader/", "NSW Lot Loader")))

# =============================================================== SURVEY / TOOLS
W("survey/lot-loader/index.html", "survey", "NSW Lot Loader",
  "Fetching NSW cadastral lot boundaries, labels and road names into a drawing.",
  """    <h1>NSW Cadastral Lot Loader</h1>
    <p class="lede">Pulls lot boundaries, labels and road names straight from NSW Spatial into
    model space — by lot and plan number, by a point, or by an extent.</p>

    <h2 id="opening-it">Opening it</h2>
    <p>Run <code class="cmd">NSWLOTS</code>, or use the button on the <strong>WSY Tools</strong>
    ribbon tab. The panel stays open while you work.</p>

    <h2 id="import-options">Import options</h2>
    <p>These apply to whichever search you use:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Option</th><th>Effect</th></tr></thead>
      <tbody>
        <tr><td>Subject Lot Labels</td><td>Labels the lots you asked for.</td></tr>
        <tr><td>Adjoining Lot Labels</td><td>Labels neighbouring lots. <em>Adjacent only</em> labels
          just those sharing a boundary; <em>All</em> also labels the surrounding buffer.</td></tr>
        <tr><td>Road Names</td><td>Places road name text along each centreline.</td></tr>
        <tr><td>Road Centrelines</td><td>Also draws the centreline geometry.</td></tr>
      </tbody>
    </table></div>

    <h2 id="three-ways-to-search">Three ways to search</h2>
    <h3>By Lot ID</h3>
    <p>Enter the plan number (required) and optionally the lot and section, choosing DP or SP. Add
    more rows with <strong>+</strong> for multiple lots. The <strong>Buffer</strong> is how far
    around each lot to fetch surrounding lots — set 0 for adjoining only.</p>
    <h3>By Point</h3>
    <p>Click <strong>Pick Point</strong>, pick in the drawing, and every lot within the buffer
    radius is fetched.</p>
    <h3>By Extent</h3>
    <p>Use the current view, or draw a rectangle.</p>

    <h2 id="what-you-get">What you get</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Layer</th><th>Contents</th></tr></thead>
      <tbody>
        <tr><td>SUB BDY</td><td>Subject lot boundaries</td></tr>
        <tr><td>SUB DP</td><td>Subject lot labels</td></tr>
        <tr><td>ADJ BDY</td><td>Adjoining and surrounding boundaries</td></tr>
        <tr><td>ADJ DP</td><td>Adjoining labels</td></tr>
        <tr><td>ROAD NAME</td><td>Road name text, rotated along the centreline</td></tr>
        <tr><td>ROAD CL</td><td>Road centrelines</td></tr>
      </tbody>
    </table></div>
    <p>Re-running never doubles up — lots already loaded are skipped. Your entries and settings are
    remembered for next time.</p>

    <h2 id="labelling-loaded-lots">Labelling loaded lots</h2>
    <p><code class="cmd">NSWLABELLOTS</code> labels lots that were loaded earlier — select the
    boundaries and it reads the plan details stored on them.</p>

    <div class="note warn"><strong>Watch out</strong> — the tool works out the MGA zone from the
    data it fetches. If it can't determine the zone it assumes Zone 56 and says so in the status
    bar. On a Zone 55 job that warning matters, so check the result lands where you expect.</div>

    <h2 id="if-it-fails">If it fails</h2>
    <p>The tool needs internet access to the NSW Spatial service. Transient errors are retried
    automatically; a persistent failure is reported in the status bar. Large extents can take a
    while — the Cancel button stops a fetch cleanly.</p>
""" + page_nav(prev=("../wae/modify-text/", "Modify & Flip Text"), nxt=("../point-cloud/", "Point Cloud Digitizer")))

W("survey/point-cloud/index.html", "survey", "Point Cloud Digitizer",
  "Tracing features off a point cloud at a fixed step, and exporting to 12d.",
  """    <h1>Point Cloud Digitizer</h1>
    <p class="lede">Traces features off a point cloud at a controlled step — you pick a direction
    and the next vertex lands exactly that distance along, snapped to the cloud, numbered and
    coded as you go.</p>

    <h2 id="opening-it">Opening it</h2>
    <p>Run <code class="cmd">PCDIG</code>, or use the button on the <strong>WSY Tools</strong>
    ribbon tab. Each drawing gets its own panel.</p>

    <h2 id="setting-up">Setting up</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Setting</th><th>What it does</th></tr></thead>
      <tbody>
        <tr><td>Segment distance</td><td>How far each new point lands from the last. Read live —
          change it mid-string and the next segment uses the new value.</td></tr>
        <tr><td>Enable point creation</td><td>Places a survey point at each vertex as well as the
          line. Uses Civil points where available.</td></tr>
        <tr><td>Start number</td><td>The first point number. Auto-fills past anything already used;
          the <strong>↻</strong> button finds the lowest free number.</td></tr>
        <tr><td>Point code</td><td>The feature code written onto the points and string.</td></tr>
        <tr><td>Layer</td><td>Set manually, or automatically from the code library.</td></tr>
      </tbody>
    </table></div>

    <h2 id="using-a-code-library">Using a code library</h2>
    <p>Browse to a Trimble <code>.fxl</code> feature library with the <strong>…</strong> button.
    Once loaded, the point code becomes a searchable picker, and the layer and colour come from the
    selected feature automatically. The <strong>✕</strong> button unloads it.</p>
    <div class="note"><strong>Note</strong> — the library isn't remembered between sessions; browse
    to it again when you reopen the drawing.</div>

    <h2 id="digitising">Digitising</h2>
    <ul>
      <li><strong>Add Line</strong> — pick a start point, then pick a direction for each following
        point. A guide circle shows the fixed distance. <strong>Undo</strong> steps back a point;
        Esc finishes the string.</li>
      <li><strong>Add Point</strong> — places standalone points without a line.</li>
      <li><strong>Extend</strong> — select an existing 3D polyline near the end you want to
        continue from.</li>
    </ul>
    <p>While digitising, 2D snaps are turned off and point-cloud snapping is turned on, then
    restored when you finish.</p>

    <h2 id="exporting-to-12d">Exporting to 12d</h2>
    <p><strong>Export to 12da…</strong> writes every digitised string and point to a 12d Model ASCII
    file. Points sitting on a string vertex aren't duplicated. Colours come from the code library
    where one is loaded.</p>
    <div class="note"><strong>Note</strong> — the export scans model space only, and can't run
    while a digitising run is active.</div>
""" + page_nav(prev=("../lot-loader/", "NSW Lot Loader"), nxt=("../../engineering/", "Engineering")))

print("Survey section written.")
