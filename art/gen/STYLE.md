# AEONS — Illustration Style Guide

The painted layer: leader portraits, Doctrine / Edict / Crisis / Omen / Reform card art, era title
backdrops and key art (main menu, victory, defeat). Everything is generated through Nous Portal
(`scripts/nous_image.py`) from the job files in this folder, then post-processed into
`public/art/<kind>/<id>.webp` and listed in `src/ui/art/artManifest.ts`.

## Art direction — "Gilded Chronicle"

**Hades × Civilization VI × Slay the Spire card art.** Painterly stylized fantasy-historical: the
world of a history book re-told as legend. Every image should read like a painted plate from an
illuminated chronicle that has been lit by a stage spotlight.

| Pillar | Rule |
|---|---|
| Brushwork | Hand-painted digital oil/gouache. Visible, confident brush strokes; soft painterly edges in the background, crisp graphic edges on the focal silhouette. Not photographic, not 3D render, not anime cel, not vector flat. |
| Shape | Bold, simplified, slightly exaggerated shapes. One chunky, readable focal silhouette that still reads at 96 px (Doctrine bar) — the card test: squint and the subject is obvious. |
| Light | Strong chiaroscuro. One warm key light + a **rich rim light** (gold or the card's accent colour) outlining the subject against a dark ground. Luminous glow / god rays / embers are allowed; flat daylight is not. |
| Palette | **Limited, hue-driven**: each card has a dominant hue (from its content `art.hue`) plus deep ink-navy shadows (#0d1424-ish) and gold-leaf highlights (#e0b84a). Three colour families max per image. |
| Edges | **Dark ink vignette, applied in post.** `scripts/art_post.py` darkens the outer edge of every image toward ink navy (#0b0f1a) with one consistent smoothstep falloff (cards strongest, backdrops lightest) so the art melts into the gold-framed cards and dark-glass UI. Prompts ask for a full-bleed painting instead: when asked for a vignette, Seedream paints inconsistent torn-paper / oval frames. |
| Mood | Mythic and optimistic for boons (Doctrines, Reforms, Edicts); ominous and cold for Crises; mysterious and celestial for Omens. |
| Taboo | **No text, letters, runes, numbers, logos, borders, frames, UI, watermarks or signatures.** No real people, no real flags, no modern brand marks, no gore. Civilisations are fictional. |

### Per-kind framing

| Kind | Aspect → shipped size | Framing |
|---|---|---|
| `leaders` | portrait → 640×800 | Head-and-shoulders to half-length hero portrait, three-quarter view, eyes to viewer, face in the upper-middle third. Costume in the leader's two civ colours; their emblem (crest motif) glows faintly in the dark background. Dramatic rim light from behind one shoulder. |
| `doctrines` | square → 512×512 | Emblematic tableau: a single iconic subject (object, figure or small scene) centred, embodying the doctrine's idea. Like a joker card: witty, clear, instantly legible. |
| `edicts` | square → 512×512 | A decisive action frozen at its peak — a decree being enacted (harvest bursting, troops rising, a star falling). Tarot energy: symbolic, centred, vertical symmetry welcome. |
| `crises` | square → 512×512 | Ominous, epic scale: the disaster looming over a small silhouetted city or figures. Cold palette + one sickly/fiery accent. Storm, smoke, darkness pressing in from the edges. |
| `omens` | square → 512×512 | Simpler vignette: a celestial portent or sacred object floating on a dark starfield ground, soft haze, strongly centred, lots of negative space. |
| `reforms` | square → 512×512 | Simpler vignette: an institution or civic symbol (hall, seal, scales, archive) presented as a monument on a dark ground, gold rim light. |
| `eras` | landscape 1600×900 + portrait 900×1600 | Panoramic establishing shot of a fictional civilisation at that era: city on the horizon, big sky, strong era lighting (Ancient golden dawn → Classical warm noon → Medieval misty morning → Renaissance amber afternoon → Industrial smoky sunset → Modern crisp blue daylight). Keep the centre-top calm for the era title. |
| `key` | landscape 1600×900 + portrait 900×1600 | `menu`: the grand vista of all ages at once; `victory`: triumphant golden apotheosis; `defeat`: fallen empire in ashes and twilight. Calm area for the logo/title. |

### Hue → palette vocabulary

Content defines `art.hue` (0–360) per card. `scripts/art_jobs.ts` turns it into words:
0–15 crimson & ember · 15–40 burnt orange & copper · 40–60 amber & gold · 60–85 olive & chartreuse
· 85–150 emerald & jade · 150–185 teal & verdigris · 185–215 azure & cerulean · 215–250 sapphire &
royal blue · 250–285 violet & amethyst · 285–320 magenta & plum · 320–345 rose & wine · 345–360
crimson & ember.

## Prompt recipe

Every prompt = `SUBJECT` + `FRAMING(kind)` + `PALETTE(hue)` + `STYLE` + `NEGATIVE`, assembled by
`scripts/art_jobs.ts` from `art/gen/subjects/<kind>.json` (hand-written, one scene per content id).

```
STYLE    = painterly stylized fantasy-historical illustration, hand-painted digital oil with
           visible confident brushstrokes, bold simplified chunky shapes, one clear readable focal
           silhouette, dramatic chiaroscuro, strong warm rim light, luminous glow, limited rich palette
           with deep ink-navy shadows and gold-leaf highlights, full-bleed painting that fills the
           entire canvas edge to edge, premium AAA card-game art in the spirit of Hades, Civilization VI
           and Slay the Spire
NEGATIVE = no text, no letters, no writing, no numbers, no runes, no inscriptions, no border, no frame,
           no torn paper edges, no vignette mask, no UI, no watermark, no signature
```

Subjects describe **what is in the picture**, never the mechanic ("a farmer kneeling in a river
delta, green shoots glowing" — not "+1 food on river tiles").

## Model choice

Chosen after the style exploration (8 test images across GPT Image 2.5 Sunburst, Nano Banana Pro, Krea 2
Medium and Seedream 5 Pro — see `art/previews/gen_styletest.png`):

- **Cards, eras, key art** — `bytedance/seedream/v5/pro/text-to-image`. Follows the recipe most
  faithfully: bold graphic silhouettes that read at 96 px, built-in ink vignette, gold-leaf flecks, and
  native 1536² / 2048×1152 / 1152×2048 output that maps onto the shipped sizes without upscaling.
  (Nano Banana Pro added a white passe-partout border; Krea read as flat children's-book; GPT Image was
  lush but busy at card size and only 1024×768 for backdrops.)
- **Leaders** — `openai/gpt-image-2.5/sunburst/text-to-image` (768×1024): the most convincing,
  characterful faces and costume detail; its 3:4 frame crops cleanly to 4:5.

## Pipeline

```
bun scripts/art_jobs.ts [kind…]                       # subjects + content → art/gen/<kind>.json
python3 scripts/nous_image.py --batch art/gen/<kind>.json --jobs 4   # → art/gen/out/<kind>/*.png
~/.hermes/hermes-agent/venv/bin/python scripts/art_post.py [kind…]   # crop/resize/vignette → WebP + contact sheets
bun scripts/art_manifest.ts                           # public/art/** → src/ui/art/artManifest.ts
```

- Raw PNGs live in `art/gen/out/` (gitignored). The batch runner skips outputs that already exist, so
  regenerating an outlier = delete its PNG and rerun the batch.
- Contact sheets: `art/previews/gen_<kind>.png`. Review every sheet; regenerate anything with text
  artefacts, broken anatomy, off-palette colour or photographic look.
- Budget: `public/art` ≤ 25 MB total (WebP q80; cards ≈ 40–70 KB, portraits ≈ 80 KB, backdrops ≈ 200 KB).
