# RED EXODUS — A Roguelike Colony Game on a Dying World's Last Hope

> "Earth went dark on a Tuesday. Fifty Arks made it out. This is what landed."

Mobile-first (390×844 portrait first), pause-anywhere, **~30–40 minute runs**. A fast, simple colony builder on
Mars wrapped in a Balatro engine-building loop. You are one of fifty national Arks that escaped Earth's
collapse, racing the dust, the cold and the other survivors to prove your colony can last.

Code name stays `aeons` (package, ids, save keys). Display title is **RED EXODUS**.

## 0. Easy to pick up (binding for every change)
- **One decision per screen.** Chapter Start = pick a Focus. Shop = buy cards. The map = build and expand.
- **No busywork.** Idle units never block End Turn; scouts explore on their own; promotions and unit upgrades are
  automatic; research asks you to pick 1 of 3 when it is empty.
- **Plain words.** All player-facing English is CEFR **B2**: short sentences, common words, no jargon.
  Game-rule words come from `src/ui/terms.ts`; Mars flavour lives in names and short flavour lines only.
- **No diplomacy.** Nations are always at peace; only Raiders are hostile.

## 1. Pillars

1. **Fast. Every turn something lands, finishes or breaks.** ~54 turns per run. Builds finish
   in 2–4 turns. The capital is already down on turn 1. Colonies arrive by **Land Colony** (a Pod from orbit).
2. **The Chapter Report is the dopamine machine.** Every chapter your colony is scored:
   **Score = Points × Multiplier** (Balatro chips × mult). Crew fire left-to-right, numbers fly.
3. **Crew are the jokers.** Named survivors from fifty nations. Each bends a rule or feeds the report.
   Order matters. Synergies make each run its own logic.
4. **Mars is the boss.** Telegraphed **dust storms** sweep the map every turn; every era ends in a Crisis.
5. **Your nation is your deck.** Fifty Arks, each with a rule-breaking bonus.

## 2. What makes it *not* Civilization

| Civ habit | RED EXODUS answer |
|---|---|
| Walk a settler 6 turns, found a city | **Land Colony**: spend a Pod, a colony lands anywhere explored within 8 tiles, *this turn*. |
| Static tech tree, pick anything | **Research draft**: when research is empty, pick 1 of 3 available techs, always including one from the newest era you can research (reroll for Credits). |
| Weather-less map | **Dust storms**: cells with a truthful 2-turn forecast drift across the map; tiles inside lose half their Food/Production, units caught in the open take damage. |
| Pop grows from food only | **Pods** are a finite pool: Land a new colony **or** Wake 2 colonists in an existing one. |
| Diplomacy, war, peace deals | None. Rivals compete for land and Wonders; Raiders are the only enemy. |
| 6,000-year eras | 6 Mars eras, 2 short chapters each ([4, 5] turns). |
| Culture, faith, great people | One scoring loop (Chapter Report) + Crew cards. Everything feeds it. |

## 3. Run structure

```
RUN (~54 turns)
 └ 6 ERAS: Landfall · Foothold · Frontier · Expansion · Terraform · New Earth   (+ Endless "Beyond")
    └ 2 CHAPTERS per era: 1 "Dawn" (4 turns) · 2 "Crisis" (5 turns)
       ├ Chapter start: one decision, pick the FOCUS pillar (starts on Science; Dawn also shows the era's Crisis, which arrives in chapter 2)
       ├ Play turns on the map
       ├ Chapter end: the CHAPTER REPORT scores the chapter → Score (Points × Multiplier) vs target;
       │  passing gives the Focus pillar +1 level automatically
       └ THE SHOP: spend Coins on 2 Crew, 1 Boost, 2 Packs (Crew Pack / Boost Pack); reroll, sell, drag to reorder
```
- **Lives**: missing a target costs a Life (2 in a Crisis chapter) and gives a **Second Chance**: +3 Coins on that
  report and the next chapter's target −25% (the comeback lever; Difficulty 7 removes it). 0 Lives → run lost.
  Losing the Capital → immediate collapse.
- Every new era the Ark sends **+1 Pod**.
- Victory: pass New Earth's Crisis chapter. Endless "Beyond" after.

## 4. Vocabulary (display names; internal ids unchanged)

| Internal | Display | Notes |
|---|---|---|
| Legacy (score) | **Score** | Points × Multiplier |
| Renown (`renown`) | **Points** | chips |
| Splendor (`splendor`) | **Multiplier** | mult |
| Chronicle | **Chapter Report** | |
| Pillars | Culture `arts` · Science `discovery` · Trade `commerce` · Military `conquest` · Growth `prosperity` · Wonders `glory` | |
| Focus pillar | **Focus** | ×2 Points; +1 level on a passed chapter |
| Mandate (lives) | **Lives** | |
| Influence (◈) | **Coins** | shop currency |
| Council | **Shop** | |
| Doctrines | **Crew** | jokers; 5 **Slots** |
| Edicts | **Boosts** | one-use cards |
| Packs | **Crew Pack** · **Boost Pack** | |
| Crises | **Crisis** | |
| Ascension | **Difficulty** 0–8 | |
| Dark Age | **Second Chance** | catch-up after a miss |
| Triumph | **Big Win** | score ≥ 2× target |
| Leaders / civs | **Nations** (an Ark + its commander) | |
| Cities / capital | **Colonies** / **Capital** | |
| Settler | **Hab Crawler** | the slow way to expand |
| Barbarians / camps / ruins | **Raiders** / **Raider Camps** / **Crash Sites** | |
| Yields | Food · **Production** · **Credits** · **Science** · **Culture** | `food prod gold sci cul` |
| Happiness | **Happiness** | |
| Techs | **Research** | |
| Wonders | **Wonders** | |
| Natural wonders | **Landmarks** | Olympus Mons, Valles Marineris, … |
| Improvements | **Improvements** | |
| Cryo pods / Orbital Drop / Thaw | **Pods** / **Land Colony** / **Wake Colonists** | |
| Turn (was Sol) | **Turn** | |
| Eras | Landfall · Foothold · Frontier · Expansion · Terraform · New Earth | |
| Chapters | Dawn · Crisis | |

`src/ui/terms.ts` is the single source for UI vocabulary strings.

### Map reskin (ids stay; names/looks change)
| id | Mars |
|---|---|
| ocean | **Dust Sea** — crossing needs hover tech (`cartography`) |
| coast | **Shallows** — crossable after `sailing` (dust skiffs) |
| lake | **Salt Lake** |
| grassland | **Clay Basin** — best farm ground |
| plains | **Plains** |
| desert | **Dunes** |
| tundra | **Frost Plains** |
| snow | **Ice Cap** |
| hills / mountain | **Hills** / **Mountains** |
| forest | **Rock Spires** (cover + Production) |
| jungle | **Lava Tubes** (shelter: defense, Food) |
| marsh | **Toxic Bog** |
| oasis | **Geyser** |
| floodplains | **Old Delta** |
| reef | **Mineral Shallows** |
| ice | **Dry Ice** |
| rivers | **Ice Channels** |

Resources, units, buildings, megaprojects, techs, promotions, landmarks get full Mars names and
descriptions (see content files). Unit lines keep their ids and roles: melee = armored infantry
(Militia → Exo-Trooper → Power Armor → Titan Frame), ranged = rifles/rails, mounted = rovers/buggies →
hovertanks, siege = mortars → mass drivers, naval = dust skiffs.

## 5. The Chapter Report (scoring)

Pillar Points → Focus ×2 → base Multiplier → colonies left-to-right → Crew left-to-right → editions → Crisis →
Score = floor(Points × Multiplier). Pass ≥ target; ≥2× = Big Win (+3 Coins), plus +1 Coin per further full
target (max +2). Passing raises the Focus pillar one level.

Every pillar scores every chapter (the Focus pillar twice). Each has one line that grows with the colony, so every
Focus keeps pace across the eras, plus count lines for the big moments (`PILLAR_RATES`, level 1):

| Pillar | Points |
|---|---|
| Culture | 1 per Culture made · 1 per Festival Production |
| Science | 0.6 per Science made · 15 per Research done |
| Trade | 0.7 per Credit earned |
| Military | 1.5 per Production spent on combat units · 0.06 per Production value of the combat units you keep, each turn · 40 per enemy defeated · 100 per Raider Camp cleared |
| Growth | 0.8 per Food for growth · 10 per colonist grown · 10 per Colony founded · 10 per Improvement |
| Wonders | 0.8 per Production spent on buildings and Wonders · 150 per Wonder · 40 per Landmark |

A Land Colony is worth its economy, not a jackpot: at Landfall one colony adds roughly 40–50% of the Dawn target
(10 Points, plus 20 more with the USA's The Astronaut).

Targets (`roguelite/constants.ts`): Dawn = `ERA_TARGETS` [450, 3600, 14700, 33600, 85000, 235000]; Crisis = Dawn ×2.2
(Landfall ×3.5, New Earth ×2.3). Tuned with `bun scripts/sim.ts --runs 40 --size small` (40 runs per policy):
- `--policy guided` (what the guide teaches: fill queues, research, Land Colony when possible, buy the first Crew; with
  full Slots sell the weakest Crew for a pricier one): Landfall Dawn ≈2.2×, Landfall Crisis passed ≈80%, the run
  usually ends in eras 3–4.
- `--policy passive` (only fills build queues and research, never lands a colony): passes Landfall Dawn ≈50%.
- the bot: wins ≈40–45%; every chapter's median score/target 1.3–2.3×; Dawn medians ≈1.0–1.6× the Crisis median.
- `--nation random` repeats any policy over the roster; `--focus <pillar>` forces one Focus all run (each Focus scores
  within ≈±15% of the others, Growth a little stronger early).

## 6. The Shop

Simplified Balatro economy: 2 Crew, 1 Boost, 2 Packs (Crew Pack / Boost Pack), reroll, sell, drag to reorder.
Coins are tight on purpose: base pay 2, chapter bonus 1 (Dawn) / 3 (Crisis), savings bonus +1 per 5 Coins (max +2),
Big Win +3, Bonus Coins max +2. Once the 5 Slots are full, Coins go to rerolls, Boosts and selling a weak Crew member
to buy a better one (the bot spends ≈2/3 of what it earns, a guided player ≈60%).
Crew editions: **Gilded → "Gold"**, **Radiant → "Shiny"**, **Prismatic → "Rainbow"**, **Ethereal → "Ghost"** (uses no Slot).

### Crew (jokers, ~170)
Named people or small groups, each with a nationality badge (`DoctrineDef.nation`). Kinds:
- Map-play buffs ("**The Channel Hydrologist** — +1 Food on Ice Channel tiles; +1 Multiplier for each colony on a channel").
- Scoring engines ("+3 Points for each Science building; ×1.5 Multiplier if your Focus is Science").
- Scaling ("gains +0.5 Multiplier every time a storm touches your land").
- Rule-benders ("Wake Colonists gives +1 extra colonist"; "Land Colony costs 1 Coin instead of a Pod once per era").
- Economy, risk/reward, nation synergies ("+1 Multiplier for each different nation among your Crew").

### Boosts (tarots), Crises (bosses)
All reskinned to Mars. Crises draw on real Mars hazards and the apocalypse: Global Dust Storm, Solar Particle
Event, Phobos Debris Shower, Earth's Last Broadcast, Raider Uprising, Martian Winter…

## 7. Mars mechanics (sim contract in `src/sim/mars.ts`)

### Dust storms
- 1–3 cells active (more in later eras / Crisis chapters / Global Dust Storm). Each cell spawns at the
  map edge, rolls its full path (1 hex/turn, gentle wobble), radius 1–2 (great storms 3), power 1–3,
  lives 4–8 turns. Forecast of the next 2 eye positions is always visible.
- Inside a storm: tile Food and Production ×0.5 (floor), vision −1, no Land Colony.
- End of round: every unit inside takes `STORM_DAMAGE × power` HP (fortified/in a colony: half; a
  colony takes damage to its HP instead). Units can die ("lost in the storm" — counts as unitsLost).
- Hooks: `storm` (modify damage; runs for victim and territory owner), content uses `stormPowerAt`.
- Mars buildings play with it: Wind Farm (+Production per storm power), Storm Shelter, Dust Scrubbers.

### The Ark: Pods
- Each nation starts with `START_CRYO` = 3 Pods (nation overrides); +1 per era start.
- **Land Colony** (`orbitalDrop {tile}`): tile explored, valid colony site, not in a storm, within
  `DROP_RANGE` = 8 of one of your colonies. Costs `dropPrice` (default 1 Pod). A colony lands this turn
  (`podLanded` → `cityFounded`) with a burst of fire from the sky.
- **Wake Colonists** (`thawColonists {cityId}`): 1 Pod → +2 pop.
- Hab Crawlers (settler unit) still exist as the slow, Pod-free expansion.
- Game start = **Landfall**: every nation's Capital is already founded on its start tile with `CAPITAL_START_POP` = 3
  colonists; starting units: Militia (`warrior`) + Scout Rover (`scout`, starts on auto-explore).

### Research draft
- The human researches only from `player.researchOffer`: 3 available techs, always one from the newest era you can
  research; the others are era-weighted toward the oldest available. When research is empty a pick-1-of-3 sheet opens
  by itself. `rerollResearch` costs Credits (15, +10 each reroll of the same offer). AIs research freely.
- Every tech needs 1–2 techs, all from the era before it (era-0 roots need none), so the newest era is always one
  step away.

### Units (automatic)
- Promotions apply themselves (`bestPromotion`); upgrades are free and automatic at turn start (`autoUpgrade`).
- No pillage, no diplomacy: `isHostile(a, b)` is true only when one side is Raiders. Raiders that break a
  colony loot it (`raidCity`) instead of capturing it.

### Pacing
- Chapter lengths [4, 5]. Production, growth, border and tech costs scaled so a colony finishes something every
  2–4 turns. Research: a healthy run (bot) researches ≈30 of 36 techs and reaches Modern techs by the Terraform era;
  a passive player stays in era 2–3 techs.
- Default map: small; 3 rivals.

## 8. The Arks (nations = Balatro decks)

Fifty Arks. The original twelve live in `src/content/leaders.ts` (six open from the start, six unlocked by meta
progression); the other 38 live in `src/content/nations/<region>.ts` (leaders + starting Crew) and
`<region>.uniques.ts` (unique unit/building defs), spread into `LEADERS` / `UNIQUE_UNITS` / `UNIQUE_BUILDINGS`.
The code is the source of truth for every name, title and rule; each nation's rule-breaker is its `bonus` text,
written in B2 as short sentences in the order the code applies them.

- Every Ark offers two commanders, one female and one male (`LeaderDef.gender` / `LeaderDef.alt`, portrait art
  `<id>` / `<id>_alt`). The choice is cosmetic (`GameConfig.altCommander`); rivals roll theirs from a derived rng
  stream so seeds play identically. Nation perks are labelled with the Ark name, not the commander.
- A bonus must matter under the streamlined rules: no war/peace, no player-attacked colonies, automatic
  promotions and upgrades (e.g. Switzerland now earns Credits per rival nation instead of vetoing war).
- Nations without a hand-tuned crest palette derive their `nation_<id>` icon from `flagColors`.

## 9. Presentation

- **Diorama Mars**: rust/ochre/butterscotch terrain, dark basalt ridges, white polar ice, rolling dust
  seas instead of water (animated dune-like swells, no specular), brine lakes teal and glassy.
  Butterscotch sky, blue sunset at dusk. Fog of war = drifting dust haze.
- **Terraforming arc**: each era the palette shifts — Landfall is harsh, dim, dusty; by New Earth the
  sky tints blue, lichen/moss greens creep into basins, lakes widen visually. The map literally comes
  alive as you progress.
- Colonies: pressurized domes, hab modules, solar arrays, antenna masts, evolving per era from landers
  and inflatable habs to arcologies and glass-domed towns.
- Units: chunky low-poly spacesuited troops, rovers, mechs, hovertanks, dust skiffs; team colors on
  shoulder panels.
- Storms: towering rust-brown walls of dust with lightning flickers; the forecast shows as a dashed
  hex outline 1–2 turns ahead.
- Orbital Drop: fiery streak from the sky, retro-rocket flare, dust shockwave, hab unfolds.
- UI: dark hazard-glass panels, rust/amber accents, cryo-cyan highlights, stencil display font.
- Audio: sparse analog-synth ambience, wind, Geiger-ish ticks, a hopeful piano motif that grows per era.
