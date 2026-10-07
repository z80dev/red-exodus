# RED EXODUS — A Roguelike Colony Game on a Dying World's Last Hope

> "Earth went dark on a Tuesday. Fifty Arks made it out. This is what landed."

Mobile-first, pause-anywhere, **45–75 minute runs**. A fast, tactical colony builder on Mars wrapped in
a Balatro engine-building loop. You are not building a civilization over 6,000 years: you are one of
fifty national Arks that escaped Earth's collapse, racing the dust, the cold, the other survivors and
your own dwindling cryo-sleeping passengers to prove your colony is *viable*.

Code name stays `aeons` (package, ids, save keys). Display title is **RED EXODUS**.

## 1. Pillars

1. **Fast. Every turn something lands, finishes or breaks.** ~78 turns per run (not 120+). Builds finish
   in 2–4 turns. The capital is already down on turn 1. No walking settlers across the map: colonies
   arrive by **Orbital Drop**.
2. **The Sol Report is the dopamine machine.** Every chapter your colony is scored:
   **Viability = Output × Hope** (Balatro chips × mult). Crew fire left-to-right, numbers fly.
3. **Crew are the jokers.** You collect named survivors from the original twelve nations — a disgraced oligarch,
   a Svalbard seed-vault keeper, a K-pop idol, an ex-NASA flight director. Each bends a rule or feeds
   the report. Order matters. Synergies make each run its own logic.
4. **Mars is the boss.** Telegraphed **dust storms** sweep the map every turn; eras end in Crises (solar
   flares, Phobos debris, Earth's final broadcast). Hard, fair, readable.
5. **Your nation is your deck.** Fifty Arks, each an asymmetric rule-breaker (Balatro decks), not a
   +10% bonus.

## 2. What makes it *not* Civilization

| Civ habit | RED EXODUS answer |
|---|---|
| Walk a settler 6 turns, found a city | **Orbital Drop**: spend a Cryo pod, a colony lands anywhere explored within 8 hexes, *this turn*. |
| Static tech tree, pick anything | **Breakthrough Draft**: each time research completes, choose 1 of 3 random available techs (reroll for Credits). |
| Weather-less map | **Dust storms**: cells with a truthful 2-turn forecast drift across the map; tiles inside lose half their Food/Industry, units caught in the open take damage. Plan around them, or build for them. |
| Pop grows from food only | **Cryo pods** are a finite, per-nation pool: Drop a new colony **or** Thaw 2 colonists into an existing one. Expand vs. grow is the central economic tension. |
| 6,000-year eras | 6 Mars eras, 3 short chapters each ([4, 4, 5] turns). |
| Culture, faith, great people | One scoring loop (Sol Report) + Crew cards. Everything feeds it. |

## 3. Run structure

```
RUN (~78 turns, 45–75 min)
 └ 6 ERAS: Landfall · Foothold · Frontier · Industry · Terraform · New Earth   (+ Endless "Beyond")
    └ 3 CHAPTERS per era: I "Dawn" (4 turns) · II "Dusk" (4 turns) · III "Crisis" (5 turns)
       ├ Chapter start: choose PRIORITY (focus pillar); optionally accept 1 of 2 DIRECTIVES (omens)
       ├ Play turns on the map
       ├ Chapter end: the SOL REPORT scores the chapter → Viability vs target
       └ THE UPLINK (shop): the Ark passes overhead; spend Scrip on Crew / Salvage / Blueprints / Supply Drops / Ark Modules
```
- Each era's Crisis is revealed at era start. **Charter** = lives (the Ark Council's backing). Missing a target
  costs Charter and sends a **Lifeline**: +3 Scrip on that report and the next chapter's target −25% (the comeback
  lever; Hazard 7 removes it). 0 Charter → the Ark cuts you off → run lost.
  Losing the Ark Hab (capital) → immediate collapse.
- Every new era the Ark thaws **+1 Cryo pod** for you.
- Victory: survive New Earth's Crisis. Endless "Beyond" after.

## 4. Vocabulary (display names; internal ids unchanged)

| Internal | Display | Notes |
|---|---|---|
| Legacy (score) | **Viability** | Output × Hope |
| Renown (`renown`) | **Output** | chips |
| Splendor (`splendor`) | **Hope** | mult; ×Hope moments are the big ones |
| Chronicle | **Sol Report** | |
| Pillars | Heritage `arts` · Science `discovery` · Trade `commerce` · Warfare `conquest` · Growth `prosperity` · Monuments `glory` | |
| Focus pillar | **Priority** | |
| Mandate (lives) | **Charter** | |
| Influence (◈) | **Scrip** | shop currency |
| Council | **The Uplink** | |
| Doctrines | **Crew** | jokers; 5 slots = "bunks" |
| Edicts | **Salvage** | consumables |
| Scrolls | **Blueprints** | pillar level-ups |
| Packs | **Supply Drops**: Crew Capsule · Blueprint Cache · Salvage Crate | |
| Reforms | **Ark Modules** | vouchers |
| Omens | **Directives** | |
| Crises | **Crises** | |
| Ascension | **Hazard** 1–8 | |
| Dark Age | **Lifeline** | catch-up after a miss |
| Leaders / civs | **Nations** (an Ark + its commander) | |
| Cities / capital | **Colonies** / **Ark Hab** | |
| Settler | **Hab Crawler** | the slow way to expand |
| Barbarians / camps / ruins | **Ferals** / **Feral Dens** / **Crash Sites** | Ferals = the crew of a private colony ship that landed 11 years early and went feral |
| Yields | Food · **Industry** · **Credits** · **Data** · **Morale** | `food prod gold sci cul` |
| Happiness | **Stability** | |
| Techs | **Research**; completion = **Breakthrough** | |
| Wonders | **Megaprojects** | |
| Natural wonders | **Landmarks** | Olympus Mons, Valles Marineris, … |
| Improvements | **Installations** | |
| Eras | Landfall · Foothold · Frontier · Industry · Terraform · New Earth | |
| Chapters | Dawn · Dusk · Crisis | |

`src/ui/terms.ts` is the single source for UI vocabulary strings.

### Map reskin (ids stay; names/looks change)
| id | Mars |
|---|---|
| ocean | **Dust Sea** — deep basin of ultrafine dust; crossing needs hover tech (`cartography`) |
| coast | **Dust Shallows** — crossable after `sailing` (dust skiffs) |
| lake | **Brine Lake** — rare liquid water, precious |
| grassland | **Clay Basin** — hydrated clays, best greenhouse ground |
| plains | **Regolith Plain** |
| desert | **Dune Sea** |
| tundra | **Frost Flats** (permafrost) |
| snow | **Polar Ice** |
| hills / mountain | **Ridges** / **Massif** |
| forest | **Hoodoo Field** (wind-carved spires: cover + Industry) |
| jungle | **Lava Tubes** (shelter: defense, Food via tube farms) |
| marsh | **Perchlorate Bog** |
| oasis | **Geyser Vent** |
| floodplains | **Ancient Delta** |
| reef | **Mineral Shoal** |
| ice | **Dry-Ice Sheet** |
| rivers | **Ancient Channels** (subsurface ice) |

Resources, units, buildings, megaprojects, techs, promotions, landmarks get full Mars names and
descriptions (see content files). Unit lines keep their ids and roles: melee = armored infantry
(Militia → Exo-Trooper → Power Armor → Titan Frame), ranged = rifles/rails, mounted = rovers/buggies →
hovertanks, siege = mortars → mass drivers, naval = dust skiffs.

## 5. The Sol Report (scoring)

Unchanged math, reskinned: pillar Output → Priority ×2 → Hope base → colonies left-to-right → Crew
left-to-right → editions → Crisis → Viability = floor(Output × Hope). Pass ≥ target;
≥2× = Triumph (+3 Scrip), plus **Overdrive** +1 Scrip per further full target (max +4). Blueprints level pillars. Targets retuned for the 78-turn pace by headless sim.

## 6. The Uplink (shop)

Unchanged Balatro economy (2 Crew, 1 Salvage/Blueprint, 2 Supply Drops, 1 Ark Module per era, reroll,
sell, drag to reorder). Crew editions: **Gilded → "Decorated"**, **Radiant → "Inspired"**,
**Prismatic → "Legendary Tale"**, **Ethereal → "Ghost"** (+1 bunk).

### Crew (jokers, ~170)
Named people or small groups, each with a nationality badge (`DoctrineDef.nation`). Kinds:
- Map-play buffs ("**The Hydrologist** — Ancient Channel tiles +1 Food; colonies on channels +2 Hope").
- Scoring engines ("**Flight Director Okafor** — +3 Output per Science building; ×1.5 Hope if Priority is Science").
- Scaling ("**The Storm Chaser** — gains +0.5 Hope every time a storm touches your territory").
- Rule-benders ("**Cryo Tech** — Thaws grant +1 extra pop"; "**Orbital Bookie** — Drops cost 1 Scrip instead of a pod once per era").
- Economy, risk/reward, nation synergies ("**Diaspora** — +1 Hope per distinct nationality among your Crew").

### Salvage (tarots), Blueprints (planets), Ark Modules (vouchers), Directives (orders), Crises (bosses)
All reskinned to Mars. Crises draw on real Mars hazards and the apocalypse: Global Dust Storm (storm
count ×3, great storms), Solar Particle Event, Phobos Debris Shower, Earth's Last Broadcast, Reactor
Scram, Cryo Bay Failure, Feral Uprising, Perchlorate Bloom, Ark Orbit Decay, Comms Blackout, Rival
Landing, Martian Winter…

## 7. Mars mechanics (sim contract in `src/sim/mars.ts`)

### Dust storms
- 1–3 cells active (more in later eras / Crisis chapters / Global Dust Storm). Each cell spawns at the
  map edge, rolls its full path (1 hex/turn, gentle wobble), radius 1–2 (great storms 3), power 1–3,
  lives 4–8 turns. Forecast of the next 2 eye positions is always visible.
- Inside a storm: tile Food and Industry ×0.5 (floor), vision −1, no Orbital Drops.
- End of round: every unit inside takes `STORM_DAMAGE × power` HP (fortified/in a colony: half; a
  colony takes damage to its HP instead). Units can die ("lost in the storm" — counts as unitsLost).
- Hooks: `storm` (modify damage; runs for victim and territory owner), content uses `stormPowerAt`.
- Mars buildings play with it: Wind Farm (+Industry per storm power), Storm Shelter, Dust Scrubbers.

### The Ark: Cryo pods
- Each nation starts with `START_CRYO` = 3 pods (nation overrides); +1 per era start.
- **Orbital Drop** (`orbitalDrop {tile}`): tile explored, valid colony site, not in a storm, within
  `DROP_RANGE` = 8 of one of your colonies. Costs `dropPrice` (default 1 pod). A colony lands this turn
  (`podLanded` → `cityFounded`) with a burst of fire from the sky.
- **Thaw** (`thawColonists {cityId}`): 1 pod → +2 pop.
- Hab Crawlers (settler unit) still exist as the slow, pod-free expansion.
- Game start = **Landfall**: every nation's Ark Hab (capital) is already founded on its start tile;
  starting units: Militia (`warrior`) + Scout Rover (`scout`).

### Breakthrough Draft
- The human researches only from `player.researchOffer` (3 random available techs, era-weighted toward
  the oldest available). Completing research redraws. `rerollResearch` costs Credits (15, +10 each
  reroll of the same offer). AIs research freely.

### Pacing
- Chapter lengths [4, 4, 5]. Production, growth, border and tech costs scaled so a colony finishes
  something every 2–4 turns and a healthy run researches ~24 of 36 techs by the end.
- Default map: small; 3 rivals.

## 8. The Arks (nations = Balatro decks)

The original twelve: six open from the start, six unlocked by meta progression. Commanders are fictional people.
Every Ark offers two commanders, one female and one male (`LeaderDef.gender` / `LeaderDef.alt`, portrait art
`<id>` / `<id>_alt`). The choice is cosmetic (`GameConfig.altCommander`); rivals roll theirs from a derived rng
stream so seeds play identically. Nation perks are labelled with the Ark name, not the commander.
Rivals are drawn from the other eleven.

| id | Nation · Ark | Commander | Rule-breaker | UU / UB | Start Crew | AI |
|---|---|---|---|---|---|---|
| `usa` | United States · **Liberty Ark** | Harlan Price, Designated Survivor (was Secretary of the Interior) | **Everything's For Sale**: the Uplink stocks +1 Crew card; selling Crew refunds full price; +10% Credits. | Marine Raider (melee era1) · Liberty Exchange (market) | The Astronaut | expansionist |
| `china` | China · **Tiangong Ark** | Chief Engineer Lin Weiqi | **Five-Year Plan**: Megaprojects −25% Industry; +2 Hope per Megaproject owned in every Sol Report; +2 Cryo pods. | Jade Rabbit Crawler (mounted era0) · Harmony Hab Block (granary) | The Foreman | builder |
| `russia` | Russia · **Novaya Zarya** | Cosmonaut-Colonel Valentina Sokolova | **General Dust**: your units and colonies take no storm damage; enemy units in your territory take double; Frost Flats & Polar Ice +1 Industry. Starts with *Tsar Charge* Salvage. | Frostguard Spetsnaz (melee era0) · RBMK Reactor (workshop) | The Veteran Cosmonaut | warmonger |
| `india` | India · **Mangalyaan Collective** | Mission Director Dr. Anjali Rao | **Frugal Engineering**: Breakthrough offers 4 techs and the first reroll of each offer is free; Installations −30% Credits; +10% Data. | Pragyan Rover (scout) · Orbiter Relay (library) | The Jugaad Mechanic | scientist |
| `japan` | Japan · **Yamato Ark** | Director Kenji Arakawa | **Kaizen Robotics**: every new unit arrives with a free promotion; buildings −15% Industry. | Mecha Frame (melee era3) · Robotics Lab (workshop-tier) | The Roboticist | scientist |
| `france` | France · **Arche Lumière** | Curator Élodie Marchand (she smuggled the Louvre aboard) | **The Louvre in the Hold**: start with *La Joconde* (Legendary Crew: +1 Hope per chapter passed, permanent); Heritage starts at level 2; +20% Morale. | Légion Étrangère (melee era2) · Salon (amphitheater) | La Joconde | builder |
| `brazil` | Brazil · **Arca Amazônia** | Seed-Keeper Dr. Thaís Oliveira | **Living Seedbank**: Clay Basin & Ancient Delta +1 Food; colonies need 20% less Food to grow; the Carnival project (festival) converts at double rate. | Jaguar Rover (mounted era1) · Biodome | The Botanist | expansionist |
| `uae` | UAE · **Al-Amal (Hope)** | Minister Rashid Al-Falasi | **Sovereign Fund**: start +100 Credits; +3% interest on banked Credits per turn (cap 15); with no pods left, Orbital Drops can be bought for Credits. | Falcon Drone (ranged era1) · Sky Souk (bank-tier) | The Wealth Manager | builder |
| `nigeria` | Nigeria · **Naija Ark** | Governor Chidinma Okafor | **Hustle**: Crash Sites also grant a random Salvage; Feral Dens pay double; colonies grow 15% faster. | Okada Rider (mounted era0 fast) · Nollywood Studio (Morale + Scrip) | The Nollywood Star | expansionist |
| `switzerland` | Switzerland · **Helvetia Vault** | Federal Councillor Anna Brunner | **Armed Neutrality**: rival nations can never declare war on you and you can never declare war; colonies +50% defense; Scrip interest cap doubled. | Alpine Guard (anti-cavalry) · Bunker Bank (bank) | The Private Banker | builder |
| `north_korea` | North Korea · **Juche Ark** (challenge deck) | Marshal Ri Song-hwa, "the Dear Commander" | **Hermit Kingdom**: the Uplink cannot be rerolled; military units −30% Industry and +15% strength; −25% Morale. Start with *Eternal Leader* (×2 Hope; cannot be sold). | Songun Trooper (melee era1) · Mass Games Arena (stadium) | Eternal Leader | warmonger |
| `vatican` | Holy See · **The Last Conclave** | Pope Innocent XIV | **Faith Beyond Earth**: +2 Hope in every Sol Report; Salvage has a 1-in-3 chance not to be consumed ("Miracle"); +1 Charter. | Swiss Guard (anti-cavalry) · Basilica of the Red Planet (cathedral) | The Cardinal | builder |

### Expansion Arks (38 more; open from the start)
Content lives in `src/content/nations/<region>.ts` (leaders + starting Crew) and `<region>.uniques.ts` (literal unique
unit/building defs), spread into `LEADERS` / `UNIQUE_UNITS` / `UNIQUE_BUILDINGS`. Rule-breakers are in each file's `bonus`.
Nations without a hand-tuned crest palette derive their `nation_<id>` icon from `flagColors`.

| id | Nation · Ark | Commander | UU · UB | Start Crew | AI |
|---|---|---|---|---|---|
| `germany` | Germany · **Arche Ordnung** | Dr. Katharina Weidner, Chief Engineer of the Ordnung Ark | Eisenfaust Driver · Mittelstand Works | The Safety Inspector | builder |
| `uk` | United Kingdom · **Albion Ark** | Dame Imogen Hartley-Pryce, Admiral-Governor of the Albion Ark | Longbow Coilgunner · Royal Dockyard | The Tea Lady | expansionist |
| `italy` | Italy · **Arca Rinascimento** | Dr. Giulia Ferrante, Curator-General of the Rinascimento Ark; Superintendent of Eternal Restoration | Codex Mortar · Grand Galleria | The Barista | builder |
| `spain` | Spain · **Arca del Sol** | Capitana Lucía Navarro, Capitana of the Sol Ark; Director of the Great Survey | Matador Hover Bike · Plaza Mayor | El Cartógrafo | warmonger |
| `netherlands` | Netherlands · **Polder Ark** | Dr. Fenna de Vries, Dike-Warden of the Polder Ark | Dijkwacht Squad · Polder Pump | The Pump Engineer | expansionist |
| `belgium` | Belgium · **Atomium Ark** | Commissaire Hélène Van den Berg, Commissioner of the Atomium Ark; Chair of the Subcommittee on Subcommittees | Ardennes Ranger · Chocolaterie | The Chocolatier | scientist |
| `ireland` | Ireland · **Emerald Ark** | Siobhán Gallagher, Skipper of the Emerald Ark | Sliotar Slinger · Last Orders Pub | The Publican | expansionist |
| `portugal` | Portugal · **Arca Navegante** | Inês Carvalho, Navigator-General of the Navegante Ark | Navegador Rover · Sagres Beacon | The Fadista | expansionist |
| `austria` | Austria · **Edelweiss Ark** | Dr. Theresia Gruber, Director of the Edelweiss Ark; Chair of the Philharmonic Hab | Edelweiss Jäger · Kaffeehaus | The Kapellmeister | scientist |
| `denmark` | Denmark · **Hygge Ark** | Kaptajn Freja Madsen, Jarl-Director of the Hygge Ark | Viking Raider · Hygge Lounge | The Windsmith | warmonger |
| `sweden` | Sweden · **Folkhem Ark** | Astrid Lindqvist, Chair of the Prize Committee; Chief Safety Inspector | Carolean Marcher · Prize Hall | The Laureate | scientist |
| `norway` | Norway · **Fjord Ark** | Ingrid Solheim, Harbour Admiral of the Fjord Ark | Ski Patrol · Fjord Pier | The Fjord Pilot | expansionist |
| `finland` | Finland · **Sisu Ark** | Aino Virtanen, Reservist General and Sauna Warden of the Sisu Ark | Sisu Sharpshooter · Sauna | The Winter Sniper | builder |
| `poland` | Poland · **Feniks Ark** | Katarzyna Nowak, Marshal of the Feniks Ark; Union Steward | Winged Hussar Rover · Bastion of the Hill | The Pierogi Chef | warmonger |
| `czechia` | Czechia · **Orloj Ark** | Marta Novotná, Master Horologist and Chief Brewmaster of the Orloj Ark | Wagon-Fort Crew · Orloj Tower | The Brewmaster | builder |
| `romania` | Romania · **Carpathian Ark** | Ileana Munteanu, Voivode of the Carpathian Ark; Keeper of the Pods | Haiduk Raider · Bran Keep | The Count | expansionist |
| `turkey` | Türkiye · **Crossroads Ark** | Deniz Aksoy, Caravanserai Warden of the Crossroads Ark | Janissary Bombardier · Covered Bazaar | The Tea Seller | warmonger |
| `kazakhstan` | Kazakhstan · **Baikonur Ark** | Aigerim Sarsenova, Launch Director of the Baikonur Ark; Marshal of the Steppe | Steppe Batyr · Cosmodrome Gantry | The Launch Director | expansionist |
| `canada` | Canada · **Aurora Ark** | Marguerite Beaulieu, Search-and-Rescue Commander of the Aurora Ark | Mountie Sled Rover · Universal Med Bay | The Maple Tapper | builder |
| `mexico` | Mexico · **Arca Quinto Sol** | Itzel Navarro Cruz, Commander of the Quinto Sol Ark | Luchador Trooper · Sun Stone Chapel | La Catrina | warmonger |
| `argentina` | Argentina · **Arca Pampa** | Lucía Benedetti, Comandante of the Pampa Ark | Gaucho Hover Bike · Estancia | The Gaucho | expansionist |
| `colombia` | Colombia · **Arca Esmeralda** | Valeria Quintero Montoya, Coffee Grower and Commander of the Arca Esmeralda | Chiva Rover · Cafetería Exchange | The Cafetero | expansionist |
| `chile` | Chile · **Arca Cordillera** | Dr. Ignacia Carrasco Millán, Chief Astronomer of the Cordillera Ark | Andean Sentinel · Atacama Array | The Seismologist | scientist |
| `australia` | Australia · **Southern Cross Ark** | Bronwyn Hartigan, Chief Ranger of the Southern Cross Ark | Boomerang Mortar · Shell Harbour | The Wildlife Ranger | expansionist |
| `south_africa` | South Africa · **Rainbow Ark** | Thandiwe van Wyk, Convener of the Rainbow Ark | Springbok Scrum · Reef Foundry | The Braai Master | builder |
| `egypt` | Egypt · **Sphinx Ark** | Dr. Amira Khalil, Curator-General of the Sphinx Ark | Medjay Sentry · House of Life | The Royal Scribe | builder |
| `iran` | Iran · **Pardis Ark** | Dr. Shirin Karimi-Nejad, Astronomer-Poet and Navigator of the Pardis Ark | Immortal Guard · Qanat Reclaimer | The Garden Keeper | builder |
| `pakistan` | Pakistan · **Karakoram Ark** | Major Ayesha Chaudhry, Expedition Leader of the Karakoram Ark | Karakoram Marksman · Karakoram Ramparts | The Truck Artist | warmonger |
| `south_korea` | South Korea · **Hanbit Ark** | Park Ha-neul, Producer-General of the Hanbit Ark | Hwacha Swarm Rack · Hallyu Broadcast Hub | The Idol Trainee | scientist |
| `indonesia` | Indonesia · **Nusantara Ark** | Dewi Kusuma, Harbourmaster-General of the Nusantara Ark | Silat Skirmisher · Pinisi Harbor | The Spice Trader | expansionist |
| `saudi_arabia` | Saudi Arabia · **Najd Ark** | Reem Al-Harbi, Director-General of the Najd Ark | Dromedary Courser · Deuterium Refinery | The Wildcatter | builder |
| `taiwan` | Taiwan · **Yushan Ark** | Chen Yu-ting, Chief Fab Engineer of the Yushan Ark | Typhoon Battery · Semiconductor Fab | The Chip Designer | scientist |
| `thailand` | Thailand · **Suvarnabhumi Ark** | Nattaya Chaiyasit, Director of the Suvarnabhumi Ark | Elephant Walker · Spirit House Garden | The Night Market Chef | builder |
| `singapore` | Singapore · **Merlion Ark** | Dr. Grace Tan, Port Director of the Merlion Ark | Lion-City Sentinel · Free Port Exchange | The Harbourmaster | scientist |
| `philippines` | Philippines · **Perlas Ark** | Marisol Dela Cruz, Chief Nurse of the Perlas Ark | Eskrima Duelist · Nurse Corps Clinic | The Balikbayan Courier | expansionist |
| `vietnam` | Vietnam · **Hồng Hà Ark** | Trần Minh Anh, Chief Tunnel Engineer of the Hồng Hà Ark | Tunnel Sniper · Tunnel Network | The Tunnel Scout | warmonger |
| `bangladesh` | Bangladesh · **Padma Ark** | Tahmina Haque, Delta Commissioner of the Padma Ark | Lathial Guard · Embankment Works | The Textile Foreman | expansionist |
| `malaysia` | Malaysia · **Muhibbah Ark** | Zahra Ibrahim, Convener of the Muhibbah Ark | Keris Vanguard · Canopy Institute | The Teh Tarik Mediator | builder |

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
