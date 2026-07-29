"""Build the assistant's corpus: every page, split into citable sections.

The whole site is about 33k tokens of prose, which fits in a single model
prompt — so there is no vector database here, no embeddings and no retrieval
service. The corpus is one JSON file, regenerated at publish time like the
command index.

Chunking is by H2 SECTION rather than by page or by a fixed character count,
because each H2 already has an id: that gives every answer a deep link to the
exact heading it came from, instead of dumping the reader at the top of an
800-word page.

RUN after changing page content:
    python scripts/gen_corpus.py
"""

import html
import io
import json
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "corpus.json"

# Pages that carry no reference content, or would only add noise.
SKIP = {"videos/index.html"}

# Sections that are NAVIGATION, not content. The alphabetical index lists
# every command name and description on one page, so as a single section it
# matches literally every question and drowns the page that actually answers
# it. The real content lives on the command pages.
SKIP_ANCHORS = {"alphabetical-index", "by-ribbon-tab"}

TAG = re.compile(r"<[^>]+>")
SCRIPTY = re.compile(r"<(script|style|svg)\b.*?</\1>", re.S | re.I)
WS = re.compile(r"\s+")


def clean(fragment):
    """Visible text of an HTML fragment, whitespace collapsed."""
    t = SCRIPTY.sub(" ", fragment)
    t = TAG.sub(" ", t)
    return WS.sub(" ", html.unescape(t)).strip()


def url_of(path):
    """Site-root URL for a file, matching how the nav links to it."""
    rel = path.relative_to(ROOT).as_posix()
    rel = rel[: -len("index.html")] if rel.endswith("index.html") else rel
    return "/" + rel.rstrip("/") + ("/" if rel else "")


def sections(main_html):
    """(anchor, heading, text) per H2, plus anything before the first one."""
    parts = re.split(r'(?=<h2\b)', main_html)
    out = []
    for i, part in enumerate(parts):
        m = re.search(r'<h2[^>]*\bid="([^"]+)"[^>]*>(.*?)</h2>', part, re.S)
        if m:
            anchor, heading = m.group(1), clean(m.group(2))
            body = clean(part[m.end():])
        else:
            if i:                       # a fragment with no heading: skip
                continue
            anchor, heading = None, None
            body = clean(part)
        if body:
            out.append((anchor, heading, body))
    return out


def main():
    docs = []
    for path in sorted(ROOT.glob("**/*.html")):
        rel = path.relative_to(ROOT).as_posix()
        if rel in SKIP or "/_" in rel:
            continue

        src = io.open(path, encoding="utf-8").read()
        m = re.search(r"<main\b.*?</main>", src, re.S)
        if not m:
            continue                     # redirect stubs and the like

        title_m = re.search(r"<title>(.*?)</title>", src, re.S)
        title = clean(title_m.group(1)).split("—")[0].strip() if title_m else rel
        url = url_of(path)

        for anchor, heading, text in sections(m.group(0)):
            if len(text) < 40:           # a heading with no real content
                continue
            if anchor in SKIP_ANCHORS:
                continue
            docs.append({
                "u": url + ("#" + anchor if anchor else ""),
                "t": title,
                "h": heading or title,
                "x": text,
            })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps(docs, ensure_ascii=False, separators=(",", ":")))

    chars = sum(len(d["x"]) for d in docs)
    print("%d sections from %d pages -> %s" % (
        len(docs), len({d["t"] for d in docs}), OUT.relative_to(ROOT)))
    print("  %d chars (~%d tokens), %d KB on disk" % (
        chars, chars / 4, OUT.stat().st_size / 1024))

    # The assistant retrieves by MEANING, from vectors built off this file. They
    # are fingerprinted against it, so a corpus change without a re-run makes the
    # Worker refuse them and drop to keyword search — which is the mode where the
    # right section ranks 18th. Loud here so it is not discovered in an answer.
    print("\n  NEXT: python scripts/gen_vectors.py")
    print("  (the corpus just changed, so the embeddings are now stale)")


if __name__ == "__main__":
    main()
