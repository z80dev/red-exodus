# AEONS — A Roguelike Civilization

> "Every empire is a story. Make yours worth telling."

Mobile-first, pause-anywhere, 1–4 hour runs. Civilization's build-an-empire depth, compressed like
Polytopia, wrapped in a Balatro engine-building roguelike loop, with Against the Storm's escalating
pressure and per-run "cornerstone" drafting. Target: feels like a premium AAA-studio mobile title.

## 1. Pillars (design north stars)

1. **Weighty decisions, zero friction.** Civ-grade choices (where to settle, what to build, war or
   peace) with Polytopia's frictionless mobile UX: no worker units, no micro, one-thumb play.
2. **The Chronicle is the dopamine machine.** Every ~6 turns your empire is *scored*. Numbers fly,
   Doctrines fire one-by-one left-to-right, multipliers stack, the score bar smashes the target.
   This is Balatro's chips × mult moment, fed by how well you played the map.
3. **Every run has its own logic.** Random Doctrine drafts, Crises, Omens, leaders and maps mean a
   "river-farming culture engine" one run and a "conquest snowball" the next.
4. **Hard, fair, rewarding.** Escalating targets and era Crises create real tension. Losing teaches.
   Winning feels earned. Ascension levels for mastery. No IAP, no energy, no timers.
5. **Pause and resume anytime.** Autosave every action. Chapters are natural ~8–12 min sessions.

## 2. Comparable games & what we steal

| Game | Steal | Avoid |
|---|---|---|
| Civilization III–VI | Tile yields, city growth, tech tree, wonders race, 1UPT hex combat, borders, "one more turn" | 500-turn games, worker micro, late-game slog, diplomacy spreadsheet |
| Battle of Polytopia | Tiny map, ~16–30 turn arcs, instant improvements bought from city, one-tap interactions, cute readable low-poly art | Shallow economy |
| Balatro | Chips×Mult scoring, sequential joker triggers with juicy feedback, shop with rerolls, editions, packs, vouchers, boss blinds, stakes, seeded runs | — |
| Slay the Spire | Readable intent (Crisis revealed ahead), elites/boss rhythm, ascension ladder, card rarity | — |
| Against the Storm | Cornerstone draft each "year", escalating storm pressure, orders (optional objectives) | — |
| Hexarchy / Rogue Hex | Proof that 4X fits in ~1 hour | Card-hand abstraction replacing the map |
| Old World / Humankind | Era transitions as dramatic moments, leader identity | Complexity |
| Thronefall / Dorfromantik | Diorama beauty, satisfying placement feedback | — |

## 3. Run structure

```
RUN (~120 turns, 1.5–3h)
 └ 6 ERAS: Ancient · Classical · Medieval · Renaissance · Industrial · Modern   (+ Endless after victory)
    └ 3 CHAPTERS per era: I "Rise" (6 turns) · II "Trial" (6 turns) · III "Crisis" (8 turns)
       ├ Chapter start: choose FOCUS PILLAR; optionally accept 1 of 2 OMENS (optional objective)
       ├ Play turns on the map (normal 4X)
       ├ Chapter end: THE CHRONICLE scores the chapter → Legacy vs target
       └ THE COUNCIL (shop): spend Influence on Doctrines / Edicts / Scrolls / Packs / Reform
```
- Chapter III of every era is under a **Crisis** (boss blind), revealed at the *start* of the era so the
  player can prepare for ~12 turns. Crisis modifies rules for its chapter (and sometimes spawns threats).
- **Mandate** = lives (3). Failing a chapter target costs 1 Mandate (Crisis chapter: 2) and inflicts a
  *Dark Age* debuff next chapter (−15% yields). 0 Mandate → civilization collapses → run lost.
  Losing your capital city → immediate collapse (unless a Doctrine prevents it).
- **Victory**: pass Era 6 Chapter III. Then optional Endless mode (targets keep scaling) for high score.
- Rivals: 3 AI civilizations + barbarian camps share the map. AIs can be eliminated; eliminating a
  rival is a huge Might moment. The player does NOT need to conquer to win — score is the win condition.

## 4. The Chronicle (scoring) — the core hook

**Legacy = Renown × Splendor** (Renown = Balatro chips, Splendor = Balatro mult).

Six **Pillars** (Balatro hand types). During each chapter the sim tallies `ChapterStats`:

| Pillar | Icon | Stats feeding it (per chapter) | Base renown per unit (L1) |
|---|---|---|---|
| Arts | lyre | culture generated | 1 / culture |
| Discovery | flask | science generated, techs completed | 0.6 / science, +30 / tech |
| Commerce | coin | gold earned (gross), trade routes | 0.6 / gold |
| Conquest | sword | enemy units killed, cities captured, camps cleared | 25 / kill, 150 / city, 60 / camp |
| Prosperity | wheat | population grown, cities founded, improvements built | 15 / pop, 80 / city, 10 / improvement |
| Glory | pillar | buildings built, wonders built, natural wonders discovered | 20 / building, 200 / wonder, 50 / nat.wonder |

Chronicle sequence (order matters, animated step-by-step):
1. Each pillar contributes Renown (stat × per-unit × pillar-level factor). The **Focus Pillar**'s renown ×2.
2. Base Splendor = Focus Pillar splendor (L1 = 2, +1 per level via Scrolls).
3. Cities scored left-to-right (by founding order): each city adds +1 Splendor per 5 pop... (city step
   gives the map-play a visible presence in the ceremony; capital first).
4. Doctrines fire left-to-right: `+Renown`, `+Splendor`, `×Splendor` effects, then editions.
5. Crisis / Dark Age modifiers apply. Final = floor(Renown × Splendor).
6. Pass if ≥ target. Overflow ≥ 2× target grants bonus Influence ("Triumph").

Pillar levels are raised by **Scrolls** (Balatro planets): each level +renown factor and +1 splendor.

**Targets** (base per era, ×1 / ×1.5 / ×2 for chapters I/II/III). Starting values, tuned by the
balance pass via headless simulation:
Era1 300 · Era2 1,200 · Era3 4,000 · Era4 12,000 · Era5 35,000 · Era6 100,000 · Endless ×3/era.
Ascension multiplies targets.

## 5. The Council (shop) — after every chronicle

Currency: **Influence (◈)**. Income per chapter: +3 base (+1 Rise, +2 Trial, +3 Crisis bonus), +1 per
5 unspent (interest, cap +5), Triumph +3, some buildings/doctrines add more.

Shop contents (rerollable; reroll 2◈, +1 per reroll this visit):
- 2 **Doctrine** cards (rarity Common 60% / Uncommon 30% / Rare 9% / Legendary 1% in packs only).
- 1 **Edict or Scroll** card.
- 2 **Packs**: Doctrine Pack (choose 1 of 3), Archive Pack (Scrolls, choose 1 of 3), Edict Pack (1 of 3).
- 1 **Reform** per era (voucher; permanent run upgrade, e.g. +1 Doctrine slot, +1 shop card).
- Sell doctrines for half cost. **Drag to reorder doctrines** (order matters in the Chronicle).
- Doctrine **editions** (rare roll): Gilded (+50 Renown), Radiant (+4 Splendor), Prismatic (×1.5
  Splendor), Ethereal (+1 Doctrine slot).
- Slots: 5 Doctrines, 2 Edicts (expandable).

**Doctrines** (Balatro jokers, ~120): permanent run effects, spanning:
- Map-play buffs ("Riverfolk: river tiles +1 food; cities on rivers +2 Splendor in Chronicle").
- Scoring engines ("Chronicler: +3 Renown per culture building, ×1.5 Splendor if Focus is Arts").
- Scaling ("Legend of the Steppe: gains +0.5 Splendor permanently every time a unit kills").
- Rule-benders ("Nomad Court: can found cities adjacent to others; −1 pop cap").
- Economy ("Tax Farmers: +1◈ per chapter per 3 cities").
- Risk/reward ("Iron Oath: ×3 Splendor, but lose 1 Mandate if you make peace").

**Edicts** (Balatro tarots, ~30): consumables, usable any time on the map (Golden Harvest: +3 pop,
Levy: spawn 2 era units, Revelation: finish current tech, Terraform, Grand Festival: +200 Renown now...).

**Omens** (Against the Storm orders): at chapter start, pick 1 of 2 optional objectives or decline.
Complete within the chapter for a reward (rare doctrine, influence, scroll).

**Crises** (boss blinds, ~18; 3 candidates per era, 1 rolled): e.g. *The Long Winter* (tundra/snow
yield nothing, food −25%), *Horde from the Steppe* (barbarian waves each 2 turns), *Plague* (cities ≥8
pop lose 1 pop every 3 turns unless Aqueduct), *Schism* (culture halved in cities without a temple),
*Rival Ascendant* (strongest AI declares war, +30% strength), *The Great Flood*, *Iconoclasm* (the
leftmost Doctrine is disabled), *Debt Crisis* (gold income −50%, interest disabled), *Dark Prophecy*
(target +50% but Crisis rewards doubled)...

**Leaders** (Balatro decks, 8): distinct starting bonus + unique unit or building + starting doctrine.
Unlocked via meta progression. Fictional civs (no real-world IP).

**Ascension** (stakes, 8 levels): +target, stronger AIs, fewer rerolls, Mandate 2, harsher crises...

## 6. The map (civ layer)

- Hex map, pointy-top, odd-r offset. Default 28×20 (Small 22×16, Large 34×24). Continents + islands,
  rivers, lakes, hills, mountains, forests, jungle, marsh, desert, tundra, snow. 1–2 Natural Wonders.
- Yields: **Food, Production, Gold, Science, Culture**.
- Cities: founded by Settlers (pop cost 1 from the building city). Territory grows with culture. Pop
  auto-works best tiles by **city focus** (Balanced / Food / Production / Gold / Science / Culture).
- **Improvements bought instantly** (Polytopia-style) on owned tiles with Gold: Farm, Mine, Pasture,
  Plantation, Lumber Mill, Quarry, Fishing Boats, Camp, Trading Post... No worker units. Roads auto
  between connected cities (optional).
- Buildings (~30) and Wonders (18, 3 per era, race against AIs).
- Happiness (empire-wide, Civ5-like): luxuries/buildings/wonders add, cities & pop subtract. Negative
  → growth halts; ≤ −10 → yields −20% and rebels may spawn.
- Tech tree: 6 techs per era (36), each unlocks units/buildings/improvements/wonders. Era is driven by
  the Chronicle clock, not by tech: falling behind in tech is a real threat.
- Combat: 1 unit per tile, Civ5 formula (strength ratio → damage, HP 100), ranged units, terrain
  defense, rivers, flanking +10%/adjacent ally, fortify, cities have HP + ranged strike. Units gain XP
  → **promotion choice of 1 of 2 random perks** (roguelite flavor in tactics too).
- ~4 unit types per era, plus Settler, Scout. Embark on water after *Sailing*.
- Barbarian camps spawn in fog; clearing grants gold + Conquest renown.
- Rivals: 3 AIs with personalities (Expansionist, Warmonger, Builder, Scientist). Simple diplomacy:
  war/peace, AI can declare war, player can offer peace (gold tribute). No diplomacy screens beyond
  that.

## 7. Session & UX

- Portrait-first, landscape supported. One-thumb: tap to select, tap to move/attack, pinch zoom,
  drag pan, long-press for tile info. Bottom sheet panels; top bar with yields.
- **Next** button cycles idle units/cities; becomes **End Turn** when nothing needs orders.
- Autosave to IndexedDB after every action. "Continue" from main menu restores exactly.
- Seeds: every run has a shareable seed; Daily Chronicle (same seed for everyone per day).
- Tutorial: the first run's Era 1 has contextual coach marks (skippable).
- Codex/Collection: all doctrines/edicts/leaders discovered, with win stats.

## 8. Presentation targets ("AAA feel")

- 3D diorama map (Three.js): smooth stylized terrain (not blocky prisms), soft shadows, animated
  water with shoreline foam, drifting cloud fog-of-war, tilt-shift depth feel, warm lighting that shifts
  palette per era (Ancient golden dawn → Modern crisp daylight).
- Low-poly hand-modeled assets built in Blender (trees, mountains, cities that visually evolve per
  era, wonders, units with team colors).
- Juice everywhere: unit hop animations, city founding burst, building completion sparkle, numbers
  popping during Chronicle with rising pitch ticks, screen shake on ×Splendor, card flips in Council.
- Typography: Cinzel (display) + Inter (UI). Palette: deep navy/ink, parchment, gold leaf accents,
  per-pillar colors. UI panels are dark glass with gold filigree edges.
- Procedural adaptive music per era + rich SFX (WebAudio).
