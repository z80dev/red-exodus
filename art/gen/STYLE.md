# RED EXODUS — Illustration Style Guide

Painted RED EXODUS art for Crew cards, Salvage, Crises, Directives, Ark Modules, fictional commanders, era backdrops, and key art. Generated through the Bankr LLM Gateway (GPT Image 2.5 Flare) from the live content registry and job files in this folder, then post-processed into `public/art/<kind>/<id>.webp` and listed in `src/ui/art/artManifest.ts`.

## Art direction — “The Last Dawn”

Painterly-but-graphic science fiction: human survival after Earth's collapse, where hardship is real and hope is stubborn. Think premium illustrated science-fiction concept art, shaped for an expressive strategy game rather than a documentary. Every picture should feel like one memorable image from humanity's second beginning.

| Pillar | Rule |
|---|---|
| Brushwork | Hand-painted digital gouache/oil with visible, confident strokes. Atmospheric, soft-edged distance; crisp designed edges on the focal subject. Painterly, not photographic, not 3D-render glossy, not anime or vector-flat. |
| Shape | Bold, simplified forms and a single unmistakable focal silhouette. Strong value grouping; the subject remains legible at phone size. Scale can be epic, but avoid detail soup. |
| Light | Strong chiaroscuro and a bright, clean rim light separating people, habitats, and machines from the rust-dark ground. Use sun glare, dust glow, habitat windows, and restrained luminous cyan as hope-signals. Avoid generic gold fantasy glow. |
| Palette | Mars first: regolith rust `#b5552b`, clay `#c8693a`, deep red `#9b4424`, butterscotch dust `#d9a066`, basalt `#3b2f2a` / `#57463d`, polar ice `#eef3f6`, brine teal `#3f8f8a`, ochre sky `#d7a07a` shifting toward terraformed blue `#8fb6d6`, habitat white `#e7e3dc`, hull grey `#8d9097`, solar-panel navy `#1d2a44`, hazard orange `#f28c28`, cryo cyan `#5fd4e8`, and lichen `#8a9a3b` / `#c77b2c`. Progressively introduce blue sky, wider brine lakes, and living greens as Mars is terraformed. National insignia colors may accent a spacesuit's shoulder panels, trim, or equipment; they are accents on practical kit, never literal flags. |
| Mood | Post-apocalyptic hope: the cost of survival is visible, but people build, care, joke, and keep going. Darkly funny details are welcome when they read visually; never turn suffering into gore or hopeless spectacle. |
| People | Commanders and Crew are fictional people. Portray individual adults with believable faces, varied ages, features, and physiques; no real public figures or celebrity likenesses. Crew art is person-first, with job props and practical pressure-rated Mars suits. National insignia colors appear only as restrained suit/equipment accents, not flags; no ceremonial fantasy regalia. |
| Taboo | No text, letters, numbers, labels, insignia that forms a flag, literal flags, logos, watermarks, signatures, borders, frames, UI, or gore. No recognizable real individuals. Never put writing on a suit, habitat, screen, or equipment. |

### Per-kind framing

| Kind | Aspect → shipped size | Framing |
|---|---|---|
| `leaders` | portrait → 640×800 | Fictional commander, head-and-shoulders to half-length, three-quarter view, direct and distinctive gaze; face in upper-middle third. Mars suit with restrained national insignia colors, softly illuminated abstract mission crest (not a flag), dark atmospheric habitat or Mars background, strong rim light. |
| `doctrines` | square → 512×512 | One fictional Crew member (or a small named pair/group), character-forward joker-card energy, expressive face and instantly readable job-specific prop. Nationality reads through small practical suit accents from `LEADERS[nation].flagColors`; never a literal flag. |
| `edicts` | square → 512×512 | One concrete Salvage object, cache, device, or colonist using it. Tactile Mars materials and one clear, witty, readable action. |
| `crises` | square → 512×512 | Ominous Mars hazard looming over a vulnerable habitat and a small crew. Large scale, pressed-in storm/dust, one hazard accent; clear at card size. |
| `omens` | square → 512×512 | Directive in action: suited colonist(s) doing one objective on Mars, with a clear action and small wry survival detail. |
| `reforms` | square → 512×512 | A distinctive Ark Module: practical habitat/life-support infrastructure with a tiny crew member for scale; calm but memorable monument-like composition. |
| `eras` | landscape 1600×900 + portrait 900×1600 | Wide establishing view with a clear focal habitat/landmark and calm upper-middle title space. Sequential terraforming arc: Landfall, Foothold, Frontier, Industry, Terraform, New Earth. |
| `key` | landscape 1600×900 + portrait 900×1600 | `menu`: all six stages of Mars colonization in one sweeping vista; `victory`: thriving New Earth and a human-scale celebration; `defeat`: lost colony beneath a punishing Martian storm, with a small unmistakable signal of hope. Reserve calm upper-middle space for title. |

## Prompt recipe

Subjects turn live names, flavor, job titles, descriptions, and nationality colors into visible people, props, actions, or hazards; game text is thematic input only and must never appear in the image. Keep a full-bleed painting edge to edge; the image pipeline adds a consistent dark vignette afterward. Ask for readable composition and light, not text or graphic overlays.

```text
STYLE = painterly-but-graphic science-fiction concept illustration, hand-painted digital gouache and oil,
        confident visible brushwork, bold simplified forms, one strong readable focal silhouette,
        dramatic Mars sunlight and crisp rim-lit subjects, atmospheric rust dust and basalt shadows,
        restricted Mars palette with restrained cryo-cyan highlights, full-bleed premium strategy-game art
NEGATIVE = no text, letters, numbers, labels, flags, logos, border, frame, UI, watermark, signature,
           photorealism, glossy 3D render, anime, gore
```

### Era arc

1. **Landfall** — harsh, dim, dust-choked red horizon; the first landed Ark Hab and tiny fragile lights.
2. **Foothold** — inflatable habitats, solar arrays, first greenhouse glow and a working settlement.
3. **Frontier** — connected domes and rover tracks spreading across a vast basin; first lichen and brine.
4. **Industry** — foundries, mass drivers, power infrastructure, busy colonies under a smoky amber sky.
5. **Terraform** — atmospheric processors and widening brine lakes; rust sky breaks into blue, green takes hold.
6. **New Earth** — blue sky, broad lakes, green valleys, glass-domed city; still recognizably Mars, finally home.

## Model choice and pipeline

All kinds render on **`gpt-image-2.5-flare`** through the Bankr LLM Gateway (`scripts/bankr_image.py`, key in
`BANKR_LLM_GATEWAY_API_TOKEN`, ≈$0.006 per 1024² image). The gateway is generation-only, so no reference-image edits;
consistency comes from the shared prompt recipe. Landscape/portrait jobs render at 1536×1024 / 1024×1536 and
`art_post.py` crops them to 16:9 / 9:16. Commander portraits, eras and key art shipped earlier were made on Nous Portal
(Seedream / GPT Image 2.5 Sunburst); regenerate them here only if the set needs to match.

```sh
bun scripts/art_subjects.ts
bun scripts/art_jobs.ts doctrines edicts crises omens reforms
python3 scripts/bankr_image.py --batch art/gen/doctrines.json art/gen/edicts.json art/gen/crises.json art/gen/omens.json art/gen/reforms.json --jobs 6
~/.hermes/hermes-agent/venv/bin/python scripts/art_post.py doctrines edicts crises omens reforms
bun scripts/art_manifest.ts
```

The batch skips existing outputs, retries 429/5xx with backoff and aborts on 402 (credit exhausted). Review each kind's contact sheet for legibility, Mars context, text/flag artifacts, and anatomy; delete bad raws and rerun the batch to regenerate them.