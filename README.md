# RED EXODUS

Earth went dark. Fifty national Arks made it to Mars. A short (~54-turn, 30–40 min), mobile-first roguelike
colony game: land colonies from orbit, build around moving dust storms, pick research 1 of 3, and collect Crew
cards that bend the rules like Balatro jokers. Every chapter your colony is scored in the **Chapter Report**:
Score = Points × Multiplier. Plain B2 English throughout.

- Design: `docs/DESIGN.md` · id → Mars names/looks: `docs/RESKIN.md` · code contract: `docs/ARCHITECTURE.md`
- `bun install` · `bun run dev` (http://localhost:5173) · typecheck `npx tsc -p tsconfig.app.json --noEmit` ·
  tests `bunx vitest run` · headless balance `bun scripts/sim.ts --runs 20` (`--policy passive` for a new-player baseline)
- Dev galleries: `?dev=RendererDemo`, `?dev=HudDemo`, `?dev=RunDemo`, `?dev=MenuDemo`, `?dev=Art2DGallery`,
  `?dev=ArtGenGallery`, `?dev=AudioDemo`, `?dev=MapGenPreview`
