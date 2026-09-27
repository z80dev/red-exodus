#!/usr/bin/env python3
"""Rate-limit-tolerant batch runner over scripts/nous_image.py (same Nous Portal route, same job format).

  python3 scripts/art_batch.py art/gen/doctrines.json [art/gen/edicts.json ...] [--jobs 4] [--tries 6]

Skips outputs that already exist; on gateway RATE_LIMIT_EXCEEDED / 429 / transient network errors it waits
(`retryAfter` from the error when present, else exponential backoff) and retries the same job.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import logging
import os
import random
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nous_image  # noqa: E402

TRANSIENT = re.compile(r"RATE_LIMIT|429|Too Many|timed out|timeout|Temporarily|503|502|504|Connection", re.I)


def run(job: dict, tries: int) -> str:
    for attempt in range(1, tries + 1):
        try:
            return nous_image.generate(job["prompt"], Path(job["out"]), job.get("aspect", "square"),
                                       job.get("model", nous_image.DEFAULT_MODEL), job.get("refs", []))
        except Exception as exc:  # retry only transient gateway errors
            msg = str(exc)
            if attempt == tries or not TRANSIENT.search(msg):
                raise
            m = re.search(r'"retryAfter":\s*(\d+)', msg)
            wait = (int(m.group(1)) + 2 if m else 10 * 2 ** (attempt - 1)) + random.uniform(0, 6)
            print(f"retry {job['out']} in {wait:.0f}s ({attempt}/{tries}): {msg[:80]!r}", flush=True)
            time.sleep(wait)
    raise AssertionError("unreachable")


def main() -> None:
    py = (nous_image.HERMES_ROOT / "venv" / "bin" / "python").resolve()
    if Path(sys.executable).resolve() != py:  # nous_image.ensure_hermes_python would re-exec nous_image.py itself
        os.execv(str(py), [str(py), str(Path(__file__).resolve()), *sys.argv[1:]])
    os.environ["HERMES_HOME"] = str(nous_image.HERMES_HOME)
    sys.path.insert(0, str(nous_image.HERMES_ROOT))
    logging.disable(logging.CRITICAL)
    ap = argparse.ArgumentParser()
    ap.add_argument("batches", nargs="+")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--tries", type=int, default=6)
    a = ap.parse_args()

    jobs = [j for b in a.batches for j in json.loads(Path(b).read_text())]
    todo = [j for j in jobs if not Path(j["out"]).exists()]
    print(f"{len(todo)}/{len(jobs)} to generate", flush=True)
    failed = 0
    with cf.ThreadPoolExecutor(max_workers=a.jobs) as ex:
        futs = {ex.submit(run, j, a.tries): j for j in todo}
        for f in cf.as_completed(futs):
            try:
                print("ok", f.result(), flush=True)
            except Exception as exc:
                failed += 1
                print("FAIL", futs[f]["out"], type(exc).__name__, str(exc)[:300], flush=True)
    print(f"done: {len(todo) - failed} ok, {failed} failed", flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
