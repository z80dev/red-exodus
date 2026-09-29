# RED EXODUS

Earth went dark. Twelve national Arks made it to Mars. A fast (~78-turn) roguelike colony game:
orbital drops instead of walking settlers, telegraphed dust storms, a Breakthrough research draft, and
Crew cards that bend the rules like Balatro jokers — every chapter your colony is scored in the
**Sol Report**: Viability = Output × Hope.

- Design: `docs/DESIGN.md` · id → Mars names/looks: `docs/RESKIN.md` · code contract: `docs/ARCHITECTURE.md`
- `bun install` · `bun run dev` (http://localhost:5173) · typecheck `npx tsc -p tsconfig.app.json --noEmit` ·
  tests `bunx vitest run` · headless balance `bun scripts/sim.ts --runs 20`
- Dev galleries: `?dev=RendererDemo`, `?dev=HudDemo`, `?dev=RunDemo`, `?dev=MenuDemo`, `?dev=Art2DGallery`,
  `?dev=ArtGenGallery`, `?dev=AudioDemo`, `?dev=MapGenPreview`
