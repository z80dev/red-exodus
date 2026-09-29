#!/usr/bin/env python3
"""Generate illustrations through the Bankr LLM Gateway (OpenAI-compatible /v1/images/generations).

Key: BANKR_LLM_GATEWAY_API_TOKEN (a `bk_...` key). Model default: gpt-image-2.5-flare.
Generation only — the gateway exposes no /images/edits, so reference images are not supported.

  python3 scripts/bankr_image.py --out art/gen/out/x.png --aspect portrait "prompt..."
  python3 scripts/bankr_image.py --batch art/gen/doctrines.json [art/gen/edicts.json ...] [--jobs 4]

Batch files: [{"out":..., "prompt":..., "aspect": "square|portrait|landscape", "model"?: ...}]. Existing
outputs are skipped. Rate limits / 5xx / network errors are retried with backoff; a 402 (credit balance)
aborts the whole batch so no queue of doomed requests piles up.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as cf
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ENDPOINT = "https://llm.bankr.bot/v1/images/generations"
DEFAULT_MODEL = "gpt-image-2.5-flare"
GATEWAY_MODELS = {"gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2"}
SIZES = {"square": "1024x1024", "portrait": "1024x1536", "landscape": "1536x1024"}
# $5 / 1M input tokens, $30 / 1M image-output tokens (docs.bankr.bot/llm-gateway/image-generation)
PRICE_IN, PRICE_OUT = 5e-6, 30e-6


class OutOfCredit(RuntimeError):
    pass


class Transient(RuntimeError):
    pass


_spent = 0.0
_lock = threading.Lock()


def api_key() -> str:
    key = os.environ.get("BANKR_LLM_GATEWAY_API_TOKEN") or os.environ.get("BANKR_API_KEY")
    if not key:
        sys.exit("Set BANKR_LLM_GATEWAY_API_TOKEN (a bk_... Bankr API key)")
    return key


def generate(prompt: str, out: Path, aspect: str = "square", model: str = DEFAULT_MODEL) -> str:
    global _spent
    body = json.dumps({"model": model, "prompt": prompt, "size": SIZES[aspect], "n": 1}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-API-Key": api_key(),
    })
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        if e.code == 402:
            raise OutOfCredit(f"HTTP 402: {detail}") from None
        if e.code == 429 or e.code >= 500:
            raise Transient(f"HTTP {e.code}: {detail}") from None
        raise RuntimeError(f"HTTP {e.code}: {detail}") from None
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        raise Transient(str(e)) from None
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    u = res.get("usage") or {}
    with _lock:
        _spent += u.get("input_tokens", 0) * PRICE_IN + u.get("output_tokens", 0) * PRICE_OUT
    return str(out)


def run_job(job: dict, tries: int, stop: threading.Event) -> str:
    model = job.get("model") if job.get("model") in GATEWAY_MODELS else DEFAULT_MODEL
    for attempt in range(1, tries + 1):
        if stop.is_set():
            raise OutOfCredit("aborted: credit exhausted earlier in batch")
        try:
            return generate(job["prompt"], Path(job["out"]), job.get("aspect", "square"), model)
        except OutOfCredit:
            stop.set()
            raise
        except Transient as exc:
            if attempt == tries:
                raise
            wait = 8 * 2 ** (attempt - 1) + random.uniform(0, 4)
            print(f"retry {job['out']} in {wait:.0f}s ({attempt}/{tries}): {str(exc)[:90]!r}", flush=True)
            time.sleep(wait)
    raise AssertionError("unreachable")


def batch(files: list[str], workers: int, tries: int) -> int:
    jobs = [j for f in files for j in json.loads(Path(f).read_text())]
    todo = [j for j in jobs if not Path(j["out"]).exists()]
    print(f"{len(todo)}/{len(jobs)} to generate", flush=True)
    stop = threading.Event()
    failed = 0
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(run_job, j, tries, stop): j for j in todo}
        for f in cf.as_completed(futs):
            try:
                print("ok", f.result(), flush=True)
            except Exception as exc:
                failed += 1
                print("FAIL", futs[f]["out"], type(exc).__name__, str(exc)[:300], flush=True)
    print(f"done: {len(todo) - failed} ok, {failed} failed, ~${_spent:.2f} spent", flush=True)
    return 1 if failed else 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prompt", nargs="?")
    ap.add_argument("--out")
    ap.add_argument("--aspect", choices=sorted(SIZES), default="square")
    ap.add_argument("--model", choices=sorted(GATEWAY_MODELS), default=DEFAULT_MODEL)
    ap.add_argument("--batch", nargs="+", metavar="JOBS_JSON")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--tries", type=int, default=5)
    a = ap.parse_args()
    if a.batch:
        sys.exit(batch(a.batch, a.jobs, a.tries))
    if not a.prompt or not a.out:
        ap.error("single mode needs --out and a prompt (or use --batch)")
    print(generate(a.prompt, Path(a.out), a.aspect, a.model))
    print(f"~${_spent:.3f}", file=sys.stderr)


if __name__ == "__main__":
    main()
