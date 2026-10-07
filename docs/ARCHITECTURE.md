# AEONS — Architecture & Team Contract

Read `docs/DESIGN.md` first. This file is the binding contract between parallel workstreams.

## Mars redesign contract (phase 2 — supersedes the fantasy-history theme)
- **Ids are frozen, looks and names change.** Every content id, model key, icon name and sfx name listed
  below stays; its display name, description, glyph, mesh and palette become Mars (docs/DESIGN.md §4).
  Player-facing vocabulary comes from `src/ui/terms.ts` (UI) — never hard-code "Legacy/Renown/Doctrine".
  Fixed Mars names/looks for every resource, installation, unit, building, megaproject, landmark and prop
  key: `docs/RESKIN.md` (binding).
- Nations replace leaders: `LEADERS` keys = `usa china russia india japan france brazil uae nigeria
  switzerland north_korea vatican`. `LeaderDef` gained `country`, `code`, `flagColors`, `cryo?`.
  `DoctrineDef.nation?` = crew nationality; `DoctrineDef.noSell?` = can't be sold.
- Crew registry: `DOCTRINES` lives in the dependency-free leaf `content/doctrineRegistry.ts`; every crew file
  (`crewCommon/crewUncommon/crewRare/crewMars/nationCrew`) ends with `registerCrew(LIST)` so registration is
  immune to import-cycle order. `content/doctrines.ts` is the shared hook-helper kit and re-exports `DOCTRINES`.
- New sim module `src/sim/mars.ts` (SimMechanics): storms (`stormAt`, `stormPowerAt`, `advanceStorms`,
  `spawnStorm`), Ark (`changeCryo`, `dropPrice`, `canOrbitalDrop`, `orbitalDrop`, `canThaw`,
  `thawColonists`), Breakthrough draft (`rollResearchOffer`, `researchRerollCost`, `rerollResearch`),
  `canDeclareWar`. Constants `START_CRYO ERA_CRYO THAW_POP DROP_RANGE RESEARCH_OFFER_SIZE`.
- State: `GameState.storms/nextStormId`, `Player.cryo/researchOffer/researchRerolls`, `StormCell`.
- Actions: `orbitalDrop {tile}`, `thawColonists {cityId}`, `rerollResearch`. `setResearch` (human) must
  pick from `researchOffer` when it is non-empty.
- Events: `stormSpawned stormMoved stormEnded stormDamage podLanded colonistsThawed cryoChanged researchOffered`.
- Hooks (`EffectHooks`): `storm`, `dropPrice`, `researchOffers`, `researchReroll`, `warDeclaration`,
  `interestCap`, `sellValue`. `CouncilState.rerollLocked` forbids Uplink rerolls for the visit.
- Storm shelter: `player.counters.stormShelter = state.turn` spares that player's units/colonies this round.
- `ChapterStats.extra` keys written by the sim: `stormHits stormKills drops thaws rerolls`.
- Pace: sim-side multipliers `TECH_PACE PRODUCTION_PACE GROWTH_PACE BORDER_PACE` (≈1/1.6); content costs stay
  as authored. Targets in `roguelite/constants.ts` tuned with `bun scripts/sim.ts --runs 24 --size small`
  (bot win rate ≈40%).
- Game start = Landfall: capitals pre-founded; start units `warrior` + `scout`. `settler` = Hab Crawler.
- Renderer draws storms from `state.storms` (eye = `path[step]`, forecast = next 2 path entries) and plays
  `podLanded` (orbital streak → impact) before `cityFounded`. New model key: `drop_pod`.
- New sfx names: `stormHowl stormHit podStreak podImpact thaw breakthrough cryo`.
- New icon names: `cryo drop thaw storm breakthrough` + one crest per nation id (`nation_<id>`).

### Phase-2 ownership
| Workstream | Owns |
|---|---|
| SimMechanics | `sim/**` except `sim/ai/**` (engine, cities, economy, units, combat, mars, roguelite, tests, testkit) |
| AI | `sim/ai/**`, `scripts/sim.ts` |
| Nations | `content/leaders.ts`, `content/uniques.ts`, `content/nationCrew.ts` |
| Crew | `content/doctrines.ts`, `content/crewMars.ts` |
| RogueContent | `content/{edicts,scrolls,crises,omens,reforms,ascension,pillars}.ts`, `content/rogue.test.ts` |
| CivContent | `content/{terrain,resources,improvements,units,buildings,wonders,techs,promotions,naturalWonders}.ts`, `content/civ.test.ts` |
| Renderer | `render/**` |
| Blender-Units / -City / -Nature / -Wonders | `art/blender/{units,city,nature,wonders}_*.py`, their GLBs/manifests/previews |
| UI-HUD | `ui/hud/**`, `ui/kit/**`, `ui/theme.css`, `game/interaction.ts` |
| UI-Run | `ui/run/**` |
| UI-Meta+2D | `ui/menu/**`, `ui/art/**` (not artManifest), `ui/icons/**`, `public/icons/*`, `index.html` title |
| Audio | `audio/**` |
| Illustration | `art/gen/**`, `scripts/art_*.{ts,py}`, `public/art/**`, `ui/art/artManifest.ts` |
| Integrator | `docs/**`, `sim/types.ts`, `sim/defs.ts`, `ui/terms.ts`, `content/index.ts`, `App.tsx`, `game/*` (not interaction) |

## Stack
Vite 8 + React 19 + TypeScript 6 (strict-ish: `verbatimModuleSyntax` → use `import type`; `erasableSyntaxOnly` → **no enums, no namespaces, no parameter properties**; `noUnusedLocals/Parameters`).
Three.js (imperative, no r3f) · zustand · idb-keyval · vitest · bun as package manager (`bun add`).
Run: `bun run dev` (port 5173) · typecheck: `npx tsc -p tsconfig.app.json --noEmit` · tests: `bunx vitest run`.

## Layers (dependency direction ↓ only)
```
src/content/*      data + effect hooks (imports sim/defs, sim/types, and sim rule modules for helpers)
src/sim/*          pure deterministic simulation. NO DOM, NO three, NO React. Mutates GameState in place.
src/meta/*         persistent profile (localStorage)
src/game/*         store (zustand), bus (SimEvent pub/sub), save (IndexedDB), bridge (Renderer interface)
src/render/*       Three.js renderer; reads GameState read-only; animates SimEvent batches
src/audio/*        WebAudio music + sfx; subscribes to bus
src/ui/*           React DOM UI over the canvas
```
Content may import sim modules (e.g. `createUnit`, `changePop`) to implement effects. Sim modules import
content registries from `src/content` (barrel). Circular ESM imports are fine as long as nothing is used
at module-evaluation time (only inside functions).

## Shared contract files (read these fully before coding)
- `src/sim/types.ts` — GameState, Action, SimEvent, etc.
- `src/sim/defs.ts` — content def types + **EffectHooks** (the rule-bending system).
- `src/sim/effects.ts` — `collectEffects`, `runHook`, `broadcastEvent` (effect ordering).
- Stub modules with fixed signatures: `sim/{hex,mapgen,pathfinding,visibility,units,combat,cities,economy,engine}.ts`, `sim/ai/index.ts`, `sim/roguelite/index.ts`, `meta/profile.ts`, `game/bridge.ts`, `audio/index.ts`, `ui/icons/*`.
- **Additive edits only** to shared files (add optional fields / union members / new exports). Never rename or remove. Re-read right before editing (others edit concurrently). If you need a breaking change, message the owner.
- Owners replace stub bodies; signatures are frozen unless extended additively.

## Ownership
| Workstream | Owns (create/edit freely) |
|---|---|
| **SimCore** | `sim/engine.ts`, `sim/cities.ts`, `sim/economy.ts`, `sim/selectors.ts`, `sim/*.test.ts` for those |
| **MapGen** | `sim/hex.ts`, `sim/mapgen.ts`, `sim/pathfinding.ts`, `sim/visibility.ts` |
| **CombatAI** | `sim/units.ts`, `sim/combat.ts`, `sim/ai/**`, `scripts/sim.ts` (headless runs) |
| **Roguelite** | `sim/roguelite/**`, `meta/**`, `content/pillars.ts` |
| **ContentCiv** | `content/{terrain,resources,improvements,units,buildings,wonders,techs,promotions,naturalWonders}.ts` |
| **ContentRogue** | `content/{doctrines,edicts,scrolls,crises,omens,leaders,reforms,ascension}.ts` |
| **Renderer** | `render/**` (incl. `GameCanvas.tsx`) |
| **Blender×4** | `art/blender/**` (scripts), `public/models/*.glb`, `art/previews/*` |
| **Art (2D)** | `ui/icons/**`, `ui/art/**` (card art, crests, logo), `public/icons/*` (PWA) |
| **UI-HUD** | `ui/hud/**`, `ui/kit/**`, `game/interaction.ts` (tap → select/move/attack logic) |
| **UI-Rogue** | `ui/run/**` (chapter start, crisis reveal, Chronicle ceremony, Council, doctrine bar, edicts, victory/defeat) |
| **UI-Meta** | `ui/menu/**` (main menu, new run, codex, settings, run summary, tutorial) |
| **Audio** | `audio/**` |
| **Integrator (lead)** | `App.tsx`, `main.tsx`, `game/*` (except interaction.ts), docs, shared contract files |

## Simulation rules of the road
- Deterministic: all randomness via `src/sim/rng.ts` with `state.rng` (mapgen uses `deriveRng(seed,'map')`).
- State must stay structured-clone serializable (no Map/Set/class/function in GameState).
- Every observable change emits a `SimEvent` through the `emit` passed down. The engine's emit pipeline:
  push to result events → `trackEvent` (roguelite stats/omens) → `broadcastEvent` (onEvent hooks).
  Events emitted from inside onEvent hooks are queued (not recursive); pipeline caps at 2000 events/dispatch.
- Content lookups: `import { UNITS, BUILDINGS, ... } from '../content'`.
- Hot paths: compute `collectEffects(state,pid)` once per city refresh and pass `fx` down.
- Performance budget: `endTurn` with 3 AIs on a standard map < 150 ms on a laptop (AI < 30 ms each).

### Required content ids (sim code references these literally)
Units: `settler`, `scout`, `warrior`. Buildings: `palace` (auto in capital; free), `walls` (city defense).
Projects: `wealth`, `research`, `festival` (festival converts production → Renown live; see Roguelite).
Techs: exactly 36 (6 per era 0..5). Starting techs: none; era-0 roots have no prereqs. `sailing` (era 0/1) enables embarking on coast/lake; `cartography` (era 2) enables ocean.
Leader-unique units/buildings live in `content/uniques.ts` (ContentRogue owns; exports `UNIQUE_UNITS`, `UNIQUE_BUILDINGS`), spread into `UNITS`/`BUILDINGS` by ContentCiv (`...UNIQUE_UNITS` at the end of the record).
Wonder ids (18, 3 per era; model key = `w_<id>`):
era0 `pyramids` `stonehenge` `hanging_gardens` · era1 `colossus` `great_library` `oracle` ·
era2 `great_wall` `hagia_sophia` `angkor_wat` · era3 `taj_mahal` `leaning_tower` `himeji` ·
era4 `big_ben` `eiffel` `liberty` · era5 `opera_house` `cristo` `launch_pad`.
Unit ids (model key = `u_<id>`; embarked units render `u_boat`):
civilian `settler`; recon `scout`; era0 `warrior` `archer` `spearman` `horseman`; era1 `swordsman` `catapult` `chariot`;
era2 `man_at_arms` `crossbowman` `pikeman` `knight` `trebuchet`; era3 `musketman` `cannon` `lancer`;
era4 `rifleman` `field_gun` `cavalry` `artillery`; era5 `infantry` `machine_gun` `at_gun` `tank` `rocket_artillery`.
Upgrade lines: warrior→swordsman→man_at_arms→musketman→rifleman→infantry · archer→crossbowman→field_gun→machine_gun ·
spearman→pikeman→at_gun · horseman→knight→cavalry→tank (chariot→knight, lancer→cavalry) · catapult→trebuchet→cannon→artillery→rocket_artillery.
Leader unique units reuse the replaced unit's model (renderer tints accents with leader colors).
Natural wonders (6; model `nw_<id>`): `sky_arch` `ember_peak` `crystal_falls` `elder_tree` `titan_bones` `mirror_lake`.
Resources (model `res_<id>`): bonus `wheat` `rice` `cattle` `sheep` `deer` `fish` `stone` `bananas`;
luxury `gold` `gems` `silk` `spices` `wine` `incense` `furs` `pearls` `marble` `ivory` `dyes` `cotton` `sugar` `whales`;
strategic `horses` `iron` `niter` `coal` `oil`.
Improvements (model `imp_<id>`): `farm` `mine` `pasture` `plantation` `lumbermill` `quarry` `fishing_boats` `camp` `trading_post` `oil_well`.

## 3D asset contract (Blender → Renderer)
- One GLB per model: `public/models/<key>.glb`. Manifest: `src/render/assets/manifest.ts` (Renderer owns). Each Blender
  agent writes `public/models/manifest.<group>.json` (`[{key, file, tris, bbox:{min:[x,y,z],max:[x,y,z]}}]`); groups: nature, city, wonders, units.
- Blender is Z-up, -Y forward; the glTF exporter (export_yup) maps Blender -Y front → glTF +Z front. Model units face Blender -Y.
- Blender binary: `/Applications/Blender.app/Contents/MacOS/Blender -b --python <script>` (Blender 5.2).
- Units: Y-up, glTF default. Origin = ground center of footprint. **Front faces +Z**. Hex circumradius = 1.0
  (hex width 1.732). Sizes: unit figure height ≈ 0.32 (renderer scales per quality); trees 0.2–0.45; houses
  0.12–0.25; city center landmark ≤ 0.55; wonders fit within radius 0.85, height 0.4–0.95; mountains fill a hex
  (radius ~0.95, height 0.6–1.0).
- Materials: flat-shaded `MeshStandardMaterial` colors (no image textures), roughness 0.7–0.9. Team colors via
  materials named exactly `TEAM` (primary) and `TEAM_DARK` (secondary) — renderer swaps colors per owner.
  Vertex colors allowed. Apply all transforms; triangulated; no cameras/lights in export.
- Budgets (tris): unit ≤ 1500, tree ≤ 250, rock ≤ 150, house ≤ 400, landmark ≤ 1500, wonder ≤ 4000, mountain ≤ 1200.
- Style: chunky stylized low-poly (Polytopia × Townscaper × Civ VI diorama), bevelled silhouettes, readable at
  small size, slightly exaggerated proportions (big heads/weapons on units). Palette anchors: foliage #5b8c3a
  #3f6e2a #86b04a; trunk #6b4a2f; rock #8a8177 #6e665e; snow #f2f4f7; sand #e3cf9a; terracotta roof #b5523b;
  stone #c9bfae; timber #7a5534; gold trim #e0b84a; modern concrete #b8bcc2; glass #6fa8c9.
- City composition models (renderer assembles cities): `city_center_<era 0..5>`, `house_<era>_a`, `house_<era>_b`,
  `wall_seg_<0..2>`, `wall_tower_<0..2>` (0 palisade, 1 stone, 2 bastion; segment spans one hex edge, length 1.0,
  origin at edge midpoint, runs along X), landmarks `bld_<id>` for: temple library market barracks harbor granary
  workshop university amphitheater bank factory observatory castle aqueduct cathedral powerplant stadium lighthouse.
- Nature: `tree_pine` `tree_broadleaf` `tree_palm` `tree_jungle` `tree_snowpine` `bush` `reeds` `cactus` `rock_small`
  `rock_large` `mountain_a` `mountain_b` `mountain_c` `mountain_snow` `hill_rocks` `ice_floe` `reef_coral` `flowers`.
  Misc: `camp_barbarian` `ruin_ancient` `u_boat` `road_marker` (optional).

## Icons (2D) — `<Icon name="..."/>`, names are fixed
yields `food prod gold sci cul` · `happy unhappy influence renown splendor mandate` · pillars `arts discovery commerce
conquest prosperity glory` · unit classes `civilian recon melee antiCavalry ranged mounted siege naval armor` · stats
`strength ranged range moves hp vision xp` · actions `move attack fortify sleep found pillage upgrade skip disband explore
heal promote buy improve` · ui `settings pause close back next endturn reroll lock unlock info codex tech city star crown
skull seed trophy shield sword book scroll edict doctrine pack reform crisis omen map journal war peace plus minus check
arrowUp arrowDown chevronRight chevronLeft hourglass calendar` · content icons: every resource id, improvement id,
building id, wonder id, tech id fall back to a category glyph if missing (`building`, `wonder`, `tech`, `resource`,
`improvement`). RichText tokens: `{food} {prod} {gold} {sci} {cul} {happy} {influence} {renown} {splendor} {mandate}`
plus `{icon:name}`; `**bold**` supported.

## Card art motifs (procedural SVG, `ui/art`)
`art.motif` / `portrait.motif` / `portrait.crest` values MUST be one of:
sun moon star river wave mountain tree wheat coin scroll flask lyre laurel crown sword shield tower castle anchor ship
horse flame eye key hourglass skull compass gear bolt feather hand book temple pyramid mask chalice serpent owl lion eagle.
`art.hue` 0–360 tints the card background.

## Illustrated art (Bankr LLM Gateway, GPT Image 2.5 Flare)
Generated raster art goes through the Bankr LLM Gateway (`https://llm.bankr.bot/v1/images/generations`, key in
`BANKR_LLM_GATEWAY_API_TOKEN`), model `gpt-image-2.5-flare`:
`python3 scripts/bankr_image.py --out <png> --aspect square|portrait|landscape "<prompt>"` or
`--batch art/gen/<kind>.json ... --jobs 6` (skips existing outputs, retries 429/5xx, aborts on 402). Generation only —
no reference-image edits. Prompts/job files live in `art/gen/*.json` (committed); raw PNGs in `art/gen/out/`
(gitignored); optimized WebP ships in `public/art/<kind>/<id>.webp` and is listed in `src/ui/art/artManifest.ts`
(ArtGen owns). Kinds: `leaders` `doctrines` `edicts` `crises` `omens` `reforms` `eras` `key` (menu/victory/defeat).
UI shows the illustration when the manifest has the id, otherwise the procedural SVG `CardArt`.
Everything else visual is code (SVG/CSS/shaders) or Blender.

## Renderer contract
`src/render/GameCanvas.tsx` mounts ONE full-screen canvas at App level (behind all screens), creates the Renderer
(`game/bridge.ts` interface), calls `setRenderer`, subscribes `bus.onBatch` → `renderer.play(events, state)`, and
calls `renderer.sync(state)` on version change. When `screen !== 'game'` it runs attract mode on a demo map
(`createGame({seed:'AEONS-MENU',...})`, never saved). Tap/long-press callbacks go to `game/interaction.ts`
(`onTileTap(idx)`, `onTileLongPress(idx)` exported by UI-HUD).
Renderer draws only what the human player can see: unexplored = cloud/parchment fog; explored-not-visible =
desaturated, no enemy units.

## Audio contract (`src/audio/index.ts`)
`audio.init()` (first gesture), `audio.sfx(name, {pitch?, volume?})`, `audio.setEra(n)`, `audio.setMood(m)`,
`audio.setVolumes({master,music,sfx})`. Audio subscribes to `bus` for sim events by itself. UI-called sfx names:
`click tap open close hover error buy sell reroll cardFlip cardDeal packOpen chronicleTick renownAdd splendorAdd
splendorMul scoreSlam targetPass targetFail triumph mandateLoss eraFanfare crisisReveal victory defeat endTurn
levelUp select move attack found build research`.

## UI conventions
- Tokens in `src/ui/theme.css` only. Primitives in `src/ui/kit`. Icons via `Icon`/`RichText`.
- Mobile-first: test at 390×844 portrait and 844×390 landscape and 1440×900 desktop. Touch targets ≥ 44px.
  Respect safe-area insets. No hover-only affordances.
- Read sim state with `useSim(s => ...)`; mutate only via `useGame.getState().dispatch(action)`.
- Every dispatch error shows a toast (UI-HUD provides `toast(text, tone)` in `ui/hud/toast.ts`).
- z-order: canvas 0 · HUD 10 · sheets 40 · modals 50 · run overlays (chronicle/council) 60 · toasts 80.

## Testing
vitest for sim determinism, mapgen validity, combat math, chronicle math, save roundtrip. Headless balance
runs via `bun scripts/sim.ts --runs 20` (CombatAI builds; Roguelite tunes targets from its output).

## Menu integration and gallery
- `src/ui/menu/{MainMenu,NewRun,Codex,Settings,Summary}.tsx` use the existing app screen store.
  `openNewRun(daily?)` from `ui/menu/shared.tsx` selects a normal or Daily setup; NewRun passes
  `lockedContent(profile)` and the tutorial preference into `newGame`. Daily seeds use the UTC
  `YYYY-MM-DD` date; a successful launch persists the attempt before the player returns to the menu.
- Summary uses `runEndUnlocks(state)` from `ui/run/RunEnd.tsx`, sharing its idempotent progression
  record with the victory/defeat UI. Settings persist through `meta/profile`, preserve audio/display
  preferences on progress reset, and return to the live game when one exists.
- Mount `<Tutorial />` from `ui/menu/tutorial/Tutorial.tsx` in GameScreen. It watches simulation
  transitions and `profile.tutorialProgress`; its veil never blocks map input. Spotlight targets use
  `data-tutorial="found-city|production|research|end-turn|legacy|combat-preview"` (one value per
  element), plus `crisis-reveal`, `chapter-start`, `chronicle`, and `council` on run overlays.
- `?dev=MenuDemo` opens the interactive menu gallery. Optional `&screen=newRun|codex|settings|summary`
  opens that screen; `&fixture=collection` seeds a sample profile **on the current origin**.
  `&live` additionally mounts the real renderer. The default gallery remains renderer-independent.
  Its tutorial controls dispatch real simulation actions, and its Summary uses a six-era fixture.

