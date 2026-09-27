#!/usr/bin/env python3
"""Generate an image through Nous Portal's managed FAL gateway (via the local Hermes install).

Same route as community-nft-launchpad/services/src/ai/nous-hermes-bridge.py (Hermes
_prepare_fal_request/_submit_fal_request with Portal OAuth under HERMES_HOME), minus the
launchpad's version pin and paid-attempt journaling. Credentials never leave Hermes.

  python3 scripts/nous_image.py --out art/gen/x.png --aspect portrait \
      --model openai/gpt-image-2.5/sunburst/text-to-image "prompt..."
  # style-consistent edits from reference images (edit-capable models only):
  python3 scripts/nous_image.py --out y.png --ref art/gen/x.png "same style, but ..."

Batch: --batch jobs.json  ([{"out":..., "prompt":..., "aspect":..., "model":..., "refs":[...]}]),
runs up to --jobs concurrently, skips outputs that already exist.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as cf
import contextlib
import io
import json
import logging
import os
import sys
import urllib.request
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
HERMES_ROOT = HERMES_HOME / "hermes-agent"
DEFAULT_MODEL = "openai/gpt-image-2.5/sunburst/text-to-image"


def ensure_hermes_python() -> None:
    py = (HERMES_ROOT / "venv" / "bin" / "python").resolve()
    if Path(sys.executable).resolve() != py:
        os.execv(str(py), [str(py), str(Path(__file__).resolve()), *sys.argv[1:]])


def to_data_uri(path: str) -> str:
    if path.startswith(("http://", "https://", "data:")):
        return path
    blob = Path(path).read_bytes()
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(blob).decode()}"


def generate(prompt: str, out: Path, aspect: str, model: str, refs: list[str]) -> str:
    from tools.image_generation_catalog import FAL_MODELS
    from tools.image_generation_tool import _prepare_fal_request, _submit_fal_request

    if model not in FAL_MODELS:
        raise SystemExit(f"model not in Hermes catalog: {model}")
    with contextlib.redirect_stdout(io.StringIO()):
        endpoint, arguments = _prepare_fal_request(
            model, FAL_MODELS[model], prompt, aspect, None,
            {"num_images": 1, "output_format": "png"}, [to_data_uri(r) for r in refs])
        result = _submit_fal_request(endpoint, arguments).get()
    images = result.get("images") if isinstance(result, dict) else None
    if not images:
        raise RuntimeError(f"no image returned for {out}")
    url = images[0]["url"]
    if url.startswith("data:"):
        blob = base64.b64decode(url.split(",", 1)[1])
    else:
        with urllib.request.urlopen(url, timeout=120) as resp:
            blob = resp.read()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(blob)
    return str(out)


def main() -> None:
    ensure_hermes_python()
    os.environ["HERMES_HOME"] = str(HERMES_HOME)
    sys.path.insert(0, str(HERMES_ROOT))
    logging.disable(logging.CRITICAL)
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?")
    ap.add_argument("--out")
    ap.add_argument("--aspect", default="square", choices=["square", "portrait", "landscape"])
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--ref", action="append", default=[])
    ap.add_argument("--batch")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()

    if a.batch:
        jobs = json.loads(Path(a.batch).read_text())
        todo = [j for j in jobs if not Path(j["out"]).exists()]
        print(f"{len(todo)}/{len(jobs)} to generate", flush=True)
        with cf.ThreadPoolExecutor(max_workers=a.jobs) as ex:
            futs = {ex.submit(generate, j["prompt"], Path(j["out"]), j.get("aspect", a.aspect),
                              j.get("model", a.model), j.get("refs", [])): j for j in todo}
            failed = 0
            for f in cf.as_completed(futs):
                try:
                    print("ok", f.result(), flush=True)
                except Exception as exc:  # report and continue the batch
                    failed += 1
                    print("FAIL", futs[f]["out"], type(exc).__name__, str(exc)[:300], flush=True)
        sys.exit(1 if failed else 0)

    if not a.prompt or not a.out:
        ap.error("prompt and --out required (or --batch)")
    print(generate(a.prompt, Path(a.out), a.aspect, a.model, a.ref))


if __name__ == "__main__":
    main()
