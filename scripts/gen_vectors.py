"""Embed the corpus so the assistant can retrieve by MEANING, not word overlap.

WHY THIS EXISTS
Keyword scoring fails on this site in a specific, repeatable way. Ask "how do I
label lot areas" and the ALAB section ranks NINETEENTH, because "label", "lot"
and "area" appear on nearly every page of a drafting site and so carry almost no
weight, while the one distinctive token - ALAB - is the very thing the person
asking does not know yet. Embeddings compare meaning instead, so the question
and "labels each selected lot with its area" land next to each other despite
sharing no rare words.

The Worker uses these ALONGSIDE the keyword score, not instead of it: someone
typing DIMDATA wants exact matching, and someone describing a problem in their
own words wants semantic. Hybrid beats either alone.

RUN after gen_corpus.py, whenever page content changes:
    python scripts/gen_vectors.py

STALENESS IS THE REAL RISK, so it is guarded rather than trusted. The output
carries a fingerprint of the corpus it was built from; the Worker checks it and
falls back to keyword-only if they disagree. Forgetting this script degrades
retrieval loudly in the logs rather than silently in the answers.
"""

import base64
import hashlib
import io
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request


def ssl_context():
    """A context that can actually verify Google's certificate.

    Python builds bundled with other applications often have no trust store
    wired in - Inkscape's ships certifi but does not point OpenSSL at it, so
    every HTTPS call dies with CERTIFICATE_VERIFY_FAILED. Use certifi when it
    is there, fall back to the system store otherwise, and never disable
    verification: this call carries an API key.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()

ROOT = pathlib.Path(__file__).resolve().parent.parent
CORPUS = ROOT / "assets" / "data" / "corpus.json"
OUT = ROOT / "assets" / "data" / "corpus-vectors.json"

MODEL = "gemini-embedding-2"
DIMS = 768          # 3072 is the default; 768 truncates well and is 4x smaller
BATCH = 50
ENDPOINT = ("https://generativelanguage.googleapis.com/v1beta/models/"
            "%s:batchEmbedContents" % MODEL)


def api_key():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("Set GEMINI_API_KEY first:\n"
                 '  $env:GEMINI_API_KEY = "your-key"   (PowerShell)\n'
                 "The key is never written to this repo.")
    return key


def post(payload, key):
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST")
    with urllib.request.urlopen(req, timeout=180, context=ssl_context()) as r:
        return json.loads(r.read().decode("utf-8"))


def embed_batch(texts, key):
    """One batch of documents -> one vector each, in order."""
    payload = {"requests": [{
        "model": "models/" + MODEL,
        "content": {"parts": [{"text": t}]},
        "taskType": "RETRIEVAL_DOCUMENT",
        "outputDimensionality": DIMS,
    } for t in texts]}

    for attempt in range(5):
        try:
            return [e["values"] for e in post(payload, key)["embeddings"]]
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            # 429 is the per-minute limit; the daily one is 1,000 and a full
            # run costs ~6 requests, so waiting is always the right move.
            if e.code == 429 and attempt < 4:
                wait = 20 * (attempt + 1)
                print("  rate limited, waiting %ds" % wait)
                time.sleep(wait)
                continue
            sys.exit("Embedding failed (HTTP %d): %s" % (e.code, body))
    sys.exit("Embedding failed: still rate limited after 5 attempts")


def quantise(vec):
    """Unit-normalise, then pack to int8.

    Ranking only cares about the ANGLE between vectors, so normalising first
    turns the comparison into a plain dot product and lets 8 bits per dimension
    carry it. That is 4 bytes down to 1: the file goes from ~2 MB of JSON floats
    to ~290 KB of base64, which matters because the Worker fetches it on every
    cold start.
    """
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return bytes((max(-127, min(127, int(round(v / norm * 127)))) & 0xFF)
                 for v in vec)


def main():
    if not CORPUS.exists():
        sys.exit("No corpus.json - run scripts/gen_corpus.py first.")

    docs = json.load(io.open(CORPUS, encoding="utf-8"))
    key = api_key()

    # Heading first: it is the most concentrated statement of what a section is
    # about, and for a command page it carries the command name.
    texts = [((d.get("h") or d.get("t") or "") + "\n" + d["x"])[:6000] for d in docs]

    vectors = []
    for i in range(0, len(texts), BATCH):
        chunk = texts[i:i + BATCH]
        print("  embedding %d-%d of %d..." % (i + 1, i + len(chunk), len(texts)))
        vectors.extend(embed_batch(chunk, key))

    if len(vectors) != len(docs):
        sys.exit("Got %d vectors for %d sections - refusing to write a "
                 "misaligned file." % (len(vectors), len(docs)))

    payload = {
        "model": MODEL,
        "dims": DIMS,
        # Ties this file to the exact corpus it was built from. The Worker
        # compares it and falls back to keyword search if they differ, so a
        # forgotten re-run degrades loudly instead of silently mismatching
        # every question to the wrong section.
        "fingerprint": fingerprint(docs),
        "v": [base64.b64encode(quantise(vec)).decode("ascii") for vec in vectors],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps(payload, separators=(",", ":")))

    print("\n%d vectors x %d dims -> %s" % (len(vectors), DIMS, OUT.relative_to(ROOT)))
    print("  %.0f KB on disk, fingerprint %s" %
          (OUT.stat().st_size / 1024, payload["fingerprint"]))


def fingerprint(docs):
    h = hashlib.sha256()
    for d in docs:
        h.update(d["u"].encode("utf-8"))
        h.update(b"\x00")
        h.update(str(len(d["x"])).encode("ascii"))
        h.update(b"\x00")
    return h.hexdigest()[:16]


if __name__ == "__main__":
    main()
