# -*- coding: utf-8 -*-
"""Engineering, quality and onboarding pages."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write as W, page_nav, cmd_block as CB

# =============================================================== ENGINEERING
W("engineering/text/index.html", "engineering", "Text & Leaders",
  "BW standard annotation text and matching multileaders.",
  """    <h1>Text &amp; Leaders</h1>
    <p class="lede">Annotation at the BW standard heights, with leaders that match.</p>

    <h2 id="text">Text</h2>
    <p>Four commands, one per standard height. Select text first to reformat it, or run with
    nothing selected to place new text — you'll be prompted for a point and the editor opens there,
    looping until Esc.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Height</th><th>Layer</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">BW25</code></td><td>2.5 mm</td><td>T25</td></tr>
        <tr><td><code class="cmd">BW35</code></td><td>3.5 mm</td><td>T35</td></tr>
        <tr><td><code class="cmd">BW50</code></td><td>5 mm</td><td>T50</td></tr>
        <tr><td><code class="cmd">BW70</code></td><td>7 mm</td><td>T70</td></tr>
      </tbody>
    </table></div>
    <p>All use the <strong>BW_AN</strong> text style and are created annotative, so the plotted size
    follows the annotation scale.</p>

    <h2 id="multileaders">Multileaders</h2>
    <p><code class="cmd">BWML25</code>, <code class="cmd">BWML35</code>,
    <code class="cmd">BWML50</code> and <code class="cmd">BWML70</code> set the matching leader
    style and layer, then hand over to the normal multileader command.</p>

    <div class="note"><strong>Note</strong> — layers are created on demand, so you don't need a
    particular template for these to work.</div>
""" + page_nav(prev=("../", "Engineering"), nxt=("../dimensions/", "Dimensions")))

W("engineering/dimensions/index.html", "engineering", "Dimensions",
  "The BW dimension commands.",
  """    <h1>Dimensions</h1>
    <p class="lede">Wrappers around the standard dimension commands that set the BW dimension
    style and layer first.</p>

    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Draws</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">BWDIMLIN</code></td><td>Horizontal or vertical dimension</td></tr>
        <tr><td><code class="cmd">BWDIMALI</code></td><td>Aligned to the two points</td></tr>
        <tr><td><code class="cmd">BWDIMANG</code></td><td>Angular</td></tr>
        <tr><td><code class="cmd">BWDIMARC</code></td><td>Arc length</td></tr>
        <tr><td><code class="cmd">BWDIMRAD</code></td><td>Radius</td></tr>
        <tr><td><code class="cmd">BWDIMDIA</code></td><td>Diameter</td></tr>
      </tbody>
    </table></div>

    <h2 id="what-they-set">What they set</h2>
    <p>All six place on the <strong>DIMS</strong> layer using the <strong>BWAN_DIM25</strong>
    style — 2.5 mm text in BW_AN, closed filled arrows, two decimal places, text above the
    dimension line, and annotative. After that, the normal dimension prompts apply.</p>
""" + page_nav(prev=("../text/", "Text & Leaders"), nxt=("../standards/", "Styles & Scales")))

W("engineering/standards/index.html", "engineering", "Styles & Scales",
  "Importing the BW style set and managing annotation scales.",
  """    <h1>Styles &amp; Scales</h1>
    <p class="lede">Setting a drawing up with the BW styles and the standard scale list.</p>

    <h2 id="commands">Commands</h2>
""" + CB("BWSTYLEIMPORT", "Creates the full BW style set without disturbing what's currently active.",
        ribbon="Standards → Import Styles",
        usage="<p>No prompts.</p>",
        produces="The BW_AN text style family and the BWAN_DIM25 / BWAN_DIM35 dimension styles. Your active text and dimension styles are restored afterwards.")
+ "\n" + CB("CSCALE", "Creates annotation scales, working out the ratio for you.",
        ribbon="Standards → Add New Scale",
        usage="<p>Opens a dialog — enter the drawing units and a name. Sequence tokens like <code>{1-5}</code> create a run of scales at once.</p>",
        notes="This is the same tool as on the WSY Drafting ribbon. The older BWCSCALE has been retired — use CSCALE.")
+ "\n" + CB("BWSCALES", "Rebuilds the drawing's annotation scale list to the engineering standard set.",
        ribbon="Standards → Reset Scale List",
        usage="<p>No prompts and no confirmation — it runs immediately and reports how many scales were removed and added.</p>",
        produces="The standard engineering scale list, from 1:10000 down to 1:10 plus the named layout scales.",
        notes="!This <strong>wipes the existing scale list</strong> before rebuilding it. Scales still in use by annotative objects survive, but anything else you'd added is removed. It's deliberately a manual command — it never runs on its own.")
+ page_nav(prev=("../dimensions/", "Dimensions"), nxt=("../plotting/", "Plotting")))

W("engineering/plotting/index.html", "engineering", "Plotting",
  "PDF and print shortcuts, and opening the job folder.",
  """    <h1>Plotting</h1>
    <p class="lede">One-click plotting for the standard sheet sizes, plus shortcuts to the job
    folder and drawing register.</p>

    <div class="note"><strong>Paper space only</strong> — the plot commands work on the current
    layout. In model space they'll tell you so and stop.</div>

    <h2 id="plot-commands">Plot commands</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Command</th><th>Output</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">BWPDFA1</code></td><td>A1 PDF at 1:1</td></tr>
        <tr><td><code class="cmd">BWPDFA3</code></td><td>A3 PDF at 1:2</td></tr>
        <tr><td><code class="cmd">BWPRINTA3</code></td><td>A3 print to the survey room printer</td></tr>
      </tbody>
    </table></div>
    <p>PDFs are written to your Documents folder, named after the drawing and layout, and opened
    when finished.</p>

    <div class="note"><strong>Note</strong> — these need the BW plot configurations, which install
    with the engineering and WAE components. If the device is missing the command says so and stops
    rather than half-plotting.</div>

    <h2 id="folder-shortcuts">Folder shortcuts</h2>
    <ul>
      <li><code class="cmd">DIROPEN</code> — opens the current drawing's folder in Explorer.</li>
      <li><code class="cmd">EXCELREG</code> — opens the job's drawing register spreadsheet.</li>
    </ul>
    <p>Both need the drawing to have been saved.</p>

    <h2 id="shared-toolbox">Shared toolbox</h2>
    <p>The Toolbox panel also carries <code class="cmd">UPDATE</code> (title-block attributes from a
    CSV), <code class="cmd">ATC</code>, <code class="cmd">OB2WO</code>,
    <code class="cmd">SMT</code> and <code class="cmd">TADD</code> — the same commands documented
    under <a href="../../drafting/commands/">the drafting command reference</a>.</p>
""" + page_nav(prev=("../standards/", "Styles & Scales"), nxt=("../../quality/", "Quality")))

# =============================================================== QUALITY
W("quality/checklist/index.html", "quality", "Drawing Checklist",
  "The QA checklist panel: revisions, automatic checks and sign-off.",
  """    <h1>Drawing Checklist</h1>
    <p class="lede">A QA panel over the office checklist spreadsheet. It tracks one pass per
    drawing revision, and can check and fix a few drawing settings directly.</p>

    <h2 id="opening-it">Opening it</h2>
    <p>Run <code class="cmd">OPENCHECKLIST</code>, or use the <strong>Checklist</strong> button on
    the WSY Drafting ribbon's QA panel. The drawing must be saved — the checklist lives with the
    project, and its location is worked out from the drawing's folder.</p>
    <p>If the project doesn't have a checklist yet, one is created from the office master template.</p>

    <h2 id="filling-it-in">Filling it in</h2>
    <ul>
      <li>Job details at the top fill themselves in from the drawing name where they can.</li>
      <li>Tick <strong>Done</strong> or <strong>N/A</strong> for each task — they're mutually
        exclusive, and completed tasks grey out.</li>
      <li><kbd>Space</kbd> toggles the focused task.</li>
      <li>Right-click for bulk actions: complete a section, complete everything remaining, or clear
        all.</li>
      <li>Category rows have their own tick boxes that set every task beneath them.</li>
    </ul>

    <h2 id="revisions">Revisions</h2>
    <p>Each drawing revision gets its own QA pass. Use the <strong>Revision</strong> dropdown to
    switch between them, and <strong>+ Add revision</strong> to start a new one.</p>
    <div class="note"><strong>Note</strong> — a new revision only exists in memory until you press
    <strong>Save</strong>. If you switch revisions with unticked changes you'll be asked whether to
    keep them.</div>

    <h2 id="automatic-checks">Automatic checks</h2>
    <p>A few items check the drawing themselves and offer to fix it:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>Checks</th><th>Fix</th></tr></thead>
      <tbody>
        <tr><td>UCS orientation</td><td>The UCS is World and the view isn't twisted</td>
          <td><strong>Set to World</strong> — resets the UCS, straightens the view and zooms to the
          drawing</td></tr>
        <tr><td>Drawing units</td><td>Units are metres</td><td><strong>Set metres</strong></td></tr>
        <tr><td>North point</td><td>Every layout has a north point</td>
          <td><strong>Go to layout</strong> — jumps to the first sheet missing one</td></tr>
      </tbody>
    </table></div>
    <p>The first two are authoritative: their ticks follow the drawing, so they can't be ticked by
    hand and then drift out of true. The north point check is advisory — some sheets genuinely
    don't need one — so you can still tick it yourself. Checks re-run whenever the window regains
    focus, so fixing something in the drawing updates the panel straight away.</p>

    <h2 id="saving">Saving</h2>
    <p><strong>Save checklist</strong> writes back to the spreadsheet and records who checked it and
    when. The panel stays open. If the file is open in Excel you'll be asked to close it and retry.</p>

    <div class="note"><strong>Closing a drawing</strong> — if the project has a checklist, you'll be
    asked whether to complete it before the drawing closes.</div>
""" + page_nav(prev=("../", "Quality"), nxt=("../../onboarding/", "Onboarding")))

# =============================================================== ONBOARDING
W("onboarding/bricscad/index.html", "onboarding", "Introduction to BricsCAD",
  "What BricsCAD is and how it fits our workflow.",
  """    <h1>Introduction to BricsCAD</h1>
    <p class="lede">BricsCAD is the CAD package we draft in. If you've used AutoCAD you'll find it
    immediately familiar — same commands, same file format, same way of working.</p>

    <h2 id="where-it-fits">Where it fits</h2>
    <p>Survey data comes in from the field, is processed, and reaches us as points, strings and
    surfaces. We draft the plan from that data in BricsCAD, annotate it to our standards, and issue
    it as a PDF. The plugin suite exists to make that middle step fast and consistent.</p>

    <h2 id="coming-from-autocad">Coming from AutoCAD</h2>
    <p>BricsCAD uses the same DWG format, so files move between the two without conversion. Command
    names, aliases and the general interface are close enough that most habits carry over directly.
    The differences you're most likely to notice are in the settings dialogs and some of the more
    specialised toolsets.</p>

    <h2 id="other-software-in-the-business">Other software in the business</h2>
    <p>Not everyone works in BricsCAD. Survey processing and design work often happen in other
    packages, and drawings come to us as exports from those. It's worth knowing what a file has
    been through before you start editing it.</p>

    <h2 id="next">Next</h2>
    <p>See <a href="learning/">Learning Resources</a> for structured courses, then move on to
    <a href="../../drafting/">Drafting</a> to set up the WSY ribbon.</p>
""" + page_nav(prev=("../", "Onboarding"), nxt=("learning/", "Learning Resources")))

W("onboarding/bricscad/learning/index.html", "onboarding", "Learning Resources",
  "Courses and material for learning BricsCAD.",
  """    <h1>Learning Resources</h1>
    <p class="lede">Bricsys publish a free structured course set — the best starting point if
    you're new to the software.</p>

    <h2 id="bricsys-lessons">Bricsys Lessons</h2>
    <p>The official course platform is at
    <a href="https://lessons.bricsys.com" target="_blank" rel="noopener">lessons.bricsys.com</a>.
    Work through the essentials course first — it covers the interface, drawing and modifying,
    layers and properties, and plotting.</p>

    <h2 id="what-to-focus-on">What to focus on</h2>
    <p>For our work, the topics that matter most are:</p>
    <ul>
      <li><strong>Layers and properties</strong> — everything we do is layer-driven.</li>
      <li><strong>Annotative scaling</strong> — this is the concept most worth understanding
        properly, because nearly all our annotation depends on it.</li>
      <li><strong>Paper space and viewports</strong> — how model space becomes a plotted sheet.</li>
      <li><strong>Plotting and page setups</strong>.</li>
    </ul>

    <h2 id="then">Then</h2>
    <p>Once you're comfortable, the <a href="../../../drafting/commands/">command reference</a> covers
    our own toolset — that's where the office-specific work happens.</p>
""" + page_nav(prev=("../", "Introduction to BricsCAD"), nxt=("../../resources/", "Spatial Data Resources")))

W("onboarding/resources/index.html", "onboarding", "Spatial Data Resources",
  "The public spatial data services we use.",
  """    <h1>Spatial Data Resources</h1>
    <p class="lede">Public data sources we rely on for background imagery, cadastre and terrain.</p>

    <h2 id="six-maps">SIX Maps</h2>
    <p>NSW Government's spatial viewer — cadastre, imagery, topographic mapping and property
    information. The quickest way to check a lot and plan, or see what's around a site.</p>
    <p><a href="https://maps.six.nsw.gov.au" target="_blank" rel="noopener">maps.six.nsw.gov.au</a></p>

    <h2 id="nearmap">Nearmap</h2>
    <p>High-resolution aerial imagery, updated frequently, with historical captures. Useful for
    seeing site conditions at a particular date.</p>
    <p><a href="https://apps.nearmap.com" target="_blank" rel="noopener">apps.nearmap.com</a></p>

    <h2 id="metromap">MetroMap</h2>
    <p>Another high-resolution aerial imagery provider covering the same ground as Nearmap, with
    its own capture schedule.</p>
    <p><a href="https://web.metromap.com.au" target="_blank" rel="noopener">web.metromap.com.au</a></p>

    <h2 id="elvis-elevation-and-depth">ELVIS — Elevation and Depth</h2>
    <p>Geoscience Australia's elevation portal. Source for LiDAR-derived terrain data and contours
    where we don't have survey coverage.</p>
    <p><a href="https://elevation.fsdf.org.au" target="_blank" rel="noopener">elevation.fsdf.org.au</a></p>

    <div class="note"><strong>Note</strong> — imagery and elevation from these services are a guide,
    not survey. Anything dimensioned on a plan comes from surveyed data.</div>
""" + page_nav(prev=("../bricscad/learning/", "Learning Resources"), nxt=("../glossary/", "Glossary")))

W("onboarding/glossary/index.html", "onboarding", "Glossary",
  "Plan types, abbreviations and terms used in the office.",
  """    <h1>Glossary</h1>
    <p class="lede">Terms and abbreviations you'll come across in drawings and job names.</p>

    <h2 id="plan-types">Plan types</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Abbreviation</th><th>Means</th></tr></thead>
      <tbody>
        <tr><td>DP</td><td>Deposited Plan — the registered plan defining land parcels</td></tr>
        <tr><td>SP</td><td>Strata Plan — subdivision of a building into lots</td></tr>
        <tr><td>SAL</td><td>Sales Plan — marketing plan showing lots for sale</td></tr>
        <tr><td>DET</td><td>Detail Plan — existing site features and levels</td></tr>
        <tr><td>SET</td><td>Setout Plan — dimensions for setting work out on site</td></tr>
        <tr><td>ID</td><td>Identification Survey — structures relative to boundaries</td></tr>
        <tr><td>FILL</td><td>Fill Plan — earthworks depth bands</td></tr>
        <tr><td>WAE</td><td>Works-As-Executed — what was actually built</td></tr>
      </tbody>
    </table></div>

    <h2 id="survey-terms">Survey terms</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Term</th><th>Means</th></tr></thead>
      <tbody>
        <tr><td>SSM</td><td>State Survey Mark — a permanent government survey mark</td></tr>
        <tr><td>PM</td><td>Permanent Mark</td></tr>
        <tr><td>RM</td><td>Reference Mark — locates a boundary corner</td></tr>
        <tr><td>DH&amp;W</td><td>Drill Hole and Wing — a common reference mark type</td></tr>
        <tr><td>GIP</td><td>Galvanised Iron Pipe</td></tr>
        <tr><td>Occupation</td><td>What physically occupies the ground — fences, walls, buildings</td></tr>
        <tr><td>Easement</td><td>A right over part of a lot, e.g. for drainage or access</td></tr>
        <tr><td>Traverse</td><td>A connected series of survey measurements</td></tr>
      </tbody>
    </table></div>

    <h2 id="coordinates-and-datums">Coordinates and datums</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Term</th><th>Means</th></tr></thead>
      <tbody>
        <tr><td>MGA</td><td>Map Grid of Australia — the projected coordinate system we draw in</td></tr>
        <tr><td>MGA Zone 55 / 56</td><td>The zone covering the job. NSW spans both; Sydney is Zone 56</td></tr>
        <tr><td>GDA2020</td><td>The current Australian datum</td></tr>
        <tr><td>AHD</td><td>Australian Height Datum — what levels are related to</td></tr>
      </tbody>
    </table></div>

    <h2 id="cad-terms">CAD terms</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Term</th><th>Means</th></tr></thead>
      <tbody>
        <tr><td>Annotative</td><td>An object that displays at the right size for the current
          annotation scale, rather than a fixed drawing size</td></tr>
        <tr><td>Annotation scale</td><td>The plot scale a viewport represents, e.g. 1:200</td></tr>
        <tr><td>Model space</td><td>Where the drawing is created at real-world size</td></tr>
        <tr><td>Paper space / Layout</td><td>The sheet, showing model space through viewports</td></tr>
        <tr><td>Viewport</td><td>A window on a layout showing part of model space at a set scale</td></tr>
        <tr><td>CTB</td><td>Plot style table — maps colour to plotted line weight</td></tr>
        <tr><td>Xref</td><td>An external drawing referenced into this one</td></tr>
      </tbody>
    </table></div>
""" + page_nav(prev=("../resources/", "Spatial Data Resources")))

print("Engineering / quality / onboarding written.")
