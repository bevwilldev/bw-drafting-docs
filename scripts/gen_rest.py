# -*- coding: utf-8 -*-
"""Generates the remaining content pages. Content is drawn from the shipping
plugin source, so it describes the tools as they actually behave."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_page import write, page_nav, cmd_block

W = write

# =========================================================== DRAFTING / INTERFACE
W("drafting/interface/index.html", "drafting", "Custom CAD Interface",
  "What the WSY Drafting ribbon is and why it exists.",
  """    <h1>Custom CAD Interface</h1>
    <p class="lede">A BricsCAD ribbon built around how we actually draft — so the standards are
    applied by the tool rather than remembered by the drafter.</p>

    <h2 id="why-it-exists">Why it exists</h2>
    <p>Drawing to a standard by hand means remembering a layer, a text style, a height and an
    annotation scale for every object you place. The ribbon collapses that into one button: run
    <code class="cmd">SUBLN</code> and the text lands on the right layer, in the right style, at the
    right height for the current scale.</p>
    <p>Three things follow from that:</p>
    <ul>
      <li><strong>Consistency</strong> — every drafter's output matches, so drawings are
        interchangeable between jobs and people.</li>
      <li><strong>Speed</strong> — the repetitive setup disappears.</li>
      <li><strong>Automation</strong> — larger jobs like boundary dimensioning, curve schedules
        and per-lot sales layouts are single commands rather than afternoons.</li>
    </ul>

    <h2 id="whats-included">What's included</h2>
    <p>The suite installs several independent plugins. You may have some or all depending on what
    was selected at install:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Plugin</th><th>Ribbon tab</th><th>For</th></tr></thead>
      <tbody>
        <tr><td>WSY Drafting</td><td>WSY Drafting</td><td>Deposited, detail and sales plans</td></tr>
        <tr><td>BW Engineering</td><td>BW Engineering</td><td>Engineering plans</td></tr>
        <tr><td>BW WAE</td><td>WAE Tools</td><td>Works-As-Executed plans</td></tr>
        <tr><td>NSW Lot Loader</td><td>WSY Tools</td><td>Cadastre from NSW Spatial</td></tr>
        <tr><td>Point Cloud Digitizer</td><td>WSY Tools</td><td>Digitising off point clouds</td></tr>
        <tr><td>Drawing Checklist</td><td>WSY Drafting → QA</td><td>Drawing sign-off</td></tr>
      </tbody>
    </table></div>

    <h2 id="getting-it">Getting it</h2>
    <p>The suite is installed from the BW BricsCAD Tools installer. See
    <a href="installation/">Installation</a>.</p>
""" + page_nav(prev=("../", "Drafting"), nxt=("installation/", "Installation")))

# The installation page is NOT generated here any more: the live install guide is
# /getting-started/, hand-maintained, and this block had drifted badly out of date
# (it still described the pre-2.0 wizard and recommended a delivery mode that is no
# longer the recommended one). Removed rather than updated so it cannot mislead.

W("drafting/interface/using/index.html", "drafting", "Using the Ribbon",
  "A tour of the WSY Drafting ribbon panels.",
  """    <h1>Using the Ribbon</h1>
    <p class="lede">The WSY Drafting tab is grouped by the kind of work you're doing. Here's what
    each panel is for.</p>

    <div class="note"><strong>Tip</strong> — hover any button for a one-line description of what it
    does and the command name behind it. Every command can also be typed directly.</div>

    <h2 id="support">Support</h2>
    <p>Help, and a link to this documentation.</p>

    <h2 id="cadastre">Cadastre</h2>
    <figure><img src="../../../assets/img/subject-lots-panel.png" alt="Subject lots panel"></figure>
    <p>Boundaries, lot numbers, areas, dimensions and bearings for the subject lots, plus the
    adjoining-lot equivalents, easements and roads. See
    <a href="../../commands/cadastre/">Cadastre commands</a>.</p>
    <figure><img src="../../../assets/img/ease-panel.png" alt="Easement panel"></figure>
    <figure><img src="../../../assets/img/road-panel.png" alt="Road panel"></figure>

    <h2 id="survey">Survey</h2>
    <figure><img src="../../../assets/img/surv-panel.png" alt="Survey panel"></figure>
    <p>Pegs, reference marks, SSMs, ties and traverse lines. See
    <a href="../../commands/survey/">Survey commands</a>.</p>
    <figure><img src="../../../assets/img/ref-panel.png" alt="Reference panel"></figure>

    <h2 id="occupations">Occupations</h2>
    <figure><img src="../../../assets/img/occs-panel.png" alt="Occupations panel"></figure>
    <p>Fence lines, fence ticks and walls.</p>

    <h2 id="text">Text</h2>
    <figure><img src="../../../assets/img/text-panel.png" alt="Text panel"></figure>
    <p>Text styles, leaders, and the label tools — brackets, background masks and curve-aligned
    text. See <a href="../../commands/text/">Text commands</a>.</p>

    <h2 id="sheeting">Sheeting</h2>
    <figure><img src="../../../assets/img/sheet-panel.png" alt="Sheeting panel"></figure>
    <p>North points and sheet sets. See <a href="../../commands/sheeting/">Sheeting commands</a>.</p>

    <h2 id="annotation">Annotation</h2>
    <figure><img src="../../../assets/img/anno-panel.png" alt="Annotation panel"></figure>
    <p>Creating annotation scales and stepping through them. See
    <a href="../../commands/annotation/">Annotation commands</a>.</p>

    <h2 id="qa">QA</h2>
    <p>Opens the project drawing checklist. See <a href="../../../quality/checklist/">Drawing
    Checklist</a>.</p>
""" + page_nav(prev=("../installation/", "Installation"), nxt=("../troubleshooting/", "Troubleshooting")))

W("support/troubleshooting/index.html", "support", "Troubleshooting",
  "Fixing a missing ribbon tab or a command that won't run.",
  """    <h1>Troubleshooting</h1>
    <p class="lede">Most problems are a ribbon that didn't load or a component that wasn't
    installed. Work through these in order.</p>

    <h2 id="a-ribbon-tab-is-missing">A ribbon tab is missing</h2>
    <p>First, restart BricsCAD — the ribbons load at startup and a tab can be missed if BricsCAD
    was busy. If it's still missing, reset the customisation:</p>
    <ol>
      <li>Run <code class="cmd">CUSTOMIZE</code>.</li>
      <li>Open the <strong>Manage Your Customizations</strong> panel.</li>
      <li>Revert to defaults, then restart BricsCAD.</li>
    </ol>

    <h2 id="a-command-says-unknown-command">A command says "unknown command"</h2>
    <p>That component probably isn't installed. Commands are grouped by plugin, and each is
    optional at install time:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>If this fails</th><th>You need</th></tr></thead>
      <tbody>
        <tr><td><code class="cmd">OPENCHECKLIST</code></td><td>The Drawing Checklist component</td></tr>
        <tr><td><code class="cmd">NSWLOTS</code></td><td>The NSW Lot Loader component</td></tr>
        <tr><td><code class="cmd">PCDIG</code></td><td>The Point Cloud Digitizer component</td></tr>
        <tr><td><code>OUTLINE</code> / <code>VPO</code></td><td>The Community LISP tools component</td></tr>
        <tr><td>Engineering or WAE commands</td><td>The matching ribbon component</td></tr>
      </tbody>
    </table></div>
    <p>Re-run the installer and tick the missing component.</p>

    <h2 id="lines-look-wrong-fences-and-easements-draw-solid">Lines look wrong — fences and easements draw solid</h2>
    <p>The linetype file didn't resolve. You'll see a message on the command line saying so. Re-run
    the installer to restore the Support files.</p>

    <h2 id="plot-commands-dont-produce-a-pdf">Plot commands don't produce a PDF</h2>
    <p>The plot device isn't installed. The engineering and WAE plot commands need the BW plot
    configurations, which ship with those components — re-run the installer.</p>

    <h2 id="text-is-the-wrong-size">Text is the wrong size</h2>
    <p>Text height is the drawing's <code>TEXTSIZE</code> divided by the current annotation scale.
    If text comes out too large or small, check the annotation scale is set correctly before
    placing it.</p>

    <h2 id="still-stuck">Still stuck</h2>
    <p>Contact the CAD team lead with the drawing, the command you ran and the exact message from
    the command line.</p>
""" + page_nav(prev=("../using/", "Using the Ribbon"), nxt=("../../standards/", "Drafting Standards")))

# =========================================================== DRAFTING / STANDARDS
W("drafting/standards/index.html", "drafting", "Drafting Standards",
  "The principles behind our drafting standards.",
  """    <h1>Drafting Standards</h1>
    <p class="lede">Why we draw the way we do — the conventions that make our drawings consistent,
    legible and plottable.</p>

    <h2 id="line-weights">Line weights</h2>
    <p>Line weight carries meaning: boundaries read heavier than annotation, and easements read
    lighter still. We drive weight from colour through the plot style table rather than setting it
    per object, so weight stays consistent no matter who drew the object.</p>

    <h2 id="text-styles">Text styles</h2>
    <p>A small set of named styles covers everything, each sized for a role — large for lot
    numbers, medium for areas, small for dimensions and bearings, thin for labels. Using the named
    styles rather than ad-hoc heights is what keeps a drawing coherent.</p>

    <h2 id="layers">Layers</h2>
    <p>Every object belongs on a layer that describes what it <em>is</em>, not what it looks like.
    The ribbon commands create and set the correct layer for you. Keep drawings tidy with
    <code>DWGHEALTH</code> and <code>PURGE</code> before issuing.</p>

    <h2 id="annotative-entities">Annotative entities</h2>
    <p>Nearly all our text and symbols are annotative: they're defined once and displayed at the
    correct size for whatever annotation scale a viewport uses. This is what lets one model space
    serve sheets at different scales.</p>
    <div class="note"><strong>Note</strong> — set the annotation scale <em>before</em> placing
    annotative objects. Objects only display at the scales attached to them.</div>

    <h2 id="plotting">Plotting</h2>
    <p>Plot styles map colour to line weight. Page setups are configured per sheet size, and the
    plot commands apply the correct device and style table for you.</p>

    <h2 id="rotated-views">Rotated views</h2>
    <p>Where a plan is rotated in a viewport, annotation should read horizontally on the sheet.
    Commands that place text account for the viewport twist and the current UCS.</p>
""" + page_nav(prev=("../interface/using/", "Using the Ribbon"), nxt=("wsy/", "WSY Drafting Standards")))

W("drafting/standards/wsy/index.html", "drafting", "WSY Drafting Standards",
  "The concrete WSY standard: colours, line weights, text styles and page setup.",
  """    <h1>WSY Drafting Standards</h1>
    <p class="lede">The specific standard used by the Western Sydney drafting team.</p>

    <h2 id="colour-and-line-weight">Colour and line weight</h2>
    <p>Line weight is driven by colour through the plot style table. Set objects ByLayer and let
    the layer's colour determine the plotted weight.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Colour</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td>1 — Red</td><td>Road names and emphasis</td></tr>
        <tr><td>2 — Yellow</td><td>Subject lot numbers, areas</td></tr>
        <tr><td>3 — Green</td><td>Easements</td></tr>
        <tr><td>4 — Cyan</td><td>Subject boundaries</td></tr>
        <tr><td>6 — Magenta</td><td>Labels, survey marks, occupations</td></tr>
        <tr><td>7 — White / Black</td><td>Adjoining boundaries and general linework</td></tr>
        <tr><td>8 — Grey</td><td>Dimensions and bearings</td></tr>
      </tbody>
    </table></div>

    <h2 id="text-styles">Text styles</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Style</th><th>Used for</th></tr></thead>
      <tbody>
        <tr><td>LARGE LABEL</td><td>Subject lot numbers, road names</td></tr>
        <tr><td>MEDIUM LABEL</td><td>Areas</td></tr>
        <tr><td>SMALL LABEL</td><td>Dimensions, bearings, ties, SSM and traverse text</td></tr>
        <tr><td>THIN LABEL</td><td>Road and easement labels, reference text</td></tr>
        <tr><td>ADJOINING LABEL</td><td>Adjoining lot numbers</td></tr>
      </tbody>
    </table></div>
    <p>Text height is always <code>TEXTSIZE ÷ annotation scale</code>, and text is created
    annotative.</p>

    <h2 id="layer-management">Layer management</h2>
    <p>Layers are created on demand by the commands — you shouldn't need to make them by hand.
    Before issuing a drawing, run <code>DWGHEALTH</code> and <code>PURGE</code> to clear unused
    definitions.</p>

    <h2 id="page-setup">Page setup</h2>
    <figure><img src="../../../assets/img/page-setup.png" alt="Page setup"></figure>
    <p>Sheets plot through the BW plot configurations with the BW plot style tables. The
    engineering and WAE plot commands apply these automatically.</p>
""" + page_nav(prev=("../", "Drafting Standards"), nxt=("../../commands/", "Command Reference")))

print("Drafting interface + standards written.")
