import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_page  # noqa: E402

PLAYLIST = "PLY89dMQ-HooSCCGWvuDYpgNYrdJwJ9emA"
# The video the page opens on. Embedding /embed/<id>?list=<playlist> loads this
# one first with the rest of the playlist queued behind it — /embed/videoseries
# would just play whatever happens to sit at position 1.
FEATURED = "La2nI5xHnR4"

body = f'''    <h1>Video Guides</h1>
    <p class="lede">
      Video documentation from the Western Sydney office. Some things are quicker
      to watch than to read — a drag preview, a dialog, the order you pick points
      in — and some subjects suit a walkthrough better than a page.
    </p>

    <!-- youtube-nocookie.com, not youtube.com: the privacy-enhanced host does
         not set tracking cookies until someone actually presses play. The site
         is internal, so it should not be quietly handing YouTube a record of
         who opened the docs. loading="lazy" also keeps the player off the wire
         until it is scrolled to. -->
    <div class="video-embed">
      <iframe src="https://www.youtube-nocookie.com/embed/{FEATURED}?list={PLAYLIST}"
              title="Western Sydney Hub video guides"
              loading="lazy" allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"></iframe>
    </div>
    <p class="video-actions">
      <a class="btn btn-quiet"
         href="https://www.youtube.com/playlist?list={PLAYLIST}"
         target="_blank" rel="noopener">Open the playlist on YouTube</a>
    </p>

    <h2 id="if-it-wont-play">If it won&rsquo;t play</h2>
    <p>
      The player above loads from YouTube. If your machine blocks it, or nothing
      appears, use the link above to open the playlist directly — and if that is
      blocked too, it is a network restriction rather than a problem with the
      video.
    </p>

    <h2 id="reading-instead">Prefer to read?</h2>
    <p>
      Where a video covers one of the suite's tools, the same ground is written
      up too. The
      <a href="../commands/">command reference</a> covers every command in the
      suite, and <a href="../getting-started/">Getting Started</a> walks through
      the installer.
    </p>

    <div class="note">
      <strong>Got a video worth adding?</strong> Send it to
      <a href="mailto:aiden.antonino@bevwill.com.au">aiden.antonino@bevwill.com.au</a>
      and it can go in the playlist.
    </div>
    <nav class="page-nav">
      <a href="../"><div class="dir">Previous</div><div class="ttl">Home</div></a>
      <a class="next" href="../commands/"><div class="dir">Next</div><div class="ttl">Command Reference</div></a>
    </nav>
'''

build_page.write("videos/index.html", "videos", "Video Guides",
                 "Video walkthroughs of the BW BricsCAD Tools suite.", body)
print("wrote videos/index.html")
