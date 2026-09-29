# RED EXODUS — id → Mars reskin map (binding)

Ids and model keys stay; display names and looks follow this table. Content owners may write their own
descriptions and flavor, but the **names below are fixed** so text, 2D glyphs, 3D models and art agree.

## Resources (`res_<id>`)
| id | Mars name | look |
|---|---|---|
| wheat | Nitrate Salts | white crystalline crust patches |
| rice | Brine Algae | teal-green algae mats in shallow brine |
| cattle | Lichen Beds | engineered orange/green lichen clumps on rocks |
| sheep | Methane Seep | small vent with faint haze, frost ring |
| deer | Crater Ice | blue-white ice lens in a small crater |
| fish | Regolith Silt | swirl of fine mineral silt in dust shallows |
| stone | Basalt | dark hexagonal basalt columns |
| bananas | Glowcap Fungus | bioluminescent cap mushrooms (lava-tube farms) |
| gold | Platinum Nuggets | bright metallic nuggets in rock |
| gems | Martian Opal | iridescent opal shards |
| silk | Spider-Silk Culture | glossy silk spools/tanks |
| spices | Saffron Seedstock | sealed purple-flower seed canisters |
| wine | Last Vintage | crate of sealed Earth wine bottles |
| incense | Earth Soil | sacks of dark brown Earth soil |
| furs | Aerogel | translucent blue foam blocks |
| pearls | Hematite Blueberries | clusters of small dark spherules |
| marble | Martian Jade | green serpentine boulders |
| ivory | Meteorite Iron | pitted iron-nickel meteorite |
| dyes | Jarosite Pigment | yellow-ochre pigment deposits |
| cotton | Bio-Cotton | white fiber pods in cultivation trays |
| sugar | Coffee Clones | tiny coffee shrubs under a mini-dome |
| whales | Orbital Debris | fallen satellite wreck half-sunk in dust sea |
| horses | Methane | cryo fuel tanks / methane ice |
| iron | Nickel-Iron | rusty metallic ore outcrop |
| niter | Perchlorates | yellow-white toxic salt crust |
| coal | Thorium | dark ore with faint green glow |
| oil | Deuterium | heavy-ice deposit with drill marker |

## Installations (`imp_<id>`)
farm Greenhouse Dome · mine Regolith Mine · pasture Bioreactor · plantation Hydroponics Bay ·
lumbermill Sinter Works · quarry Basalt Quarry · fishing_boats Dust Skimmer · camp Extraction Rig ·
trading_post Relay Station · oil_well Deep Drill

## Units (`u_<id>`) — chunky spacesuited low-poly, team color on shoulder/panels
| id | Mars name | look |
|---|---|---|
| settler | Hab Crawler | slow tracked vehicle carrying a folded hab module |
| scout | Scout Rover | small 4-wheel rover, big antenna dish |
| warrior | Militia | survivor in patched EVA suit, improvised rifle |
| archer | Slug Thrower | EVA suit, long scoped rifle |
| spearman | Breacher | riot shield + stun lance |
| horseman | Dune Buggy | open-frame buggy, roll cage, driver |
| swordsman | Security Trooper | armored suit, carbine, helmet visor |
| catapult | Mortar Team | tube mortar on bipod + crew |
| chariot | Assault Rover | 6-wheel armored rover with turret |
| man_at_arms | Exo-Trooper | exoskeleton frame over suit, heavy gun |
| crossbowman | Coilgunner | coil rifle with glowing rings |
| pikeman | Lancer Squad | shoulder-launched anti-vehicle tube |
| knight | Hover Bike | sleek hover bike with rider |
| trebuchet | Rail Mortar | long rail on tracked base |
| musketman | Power Armor | bulky powered armor |
| cannon | Mass Driver | towed electromagnetic cannon |
| lancer | Strike Rover | fast wedge-shaped rover |
| rifleman | Hardsuit Marine | sleek hardsuit, rifle |
| field_gun | Plasma Caster | tripod plasma weapon, glowing |
| cavalry | Hover Skimmer | open hover platform with gunner |
| artillery | Arc Howitzer | big gun with capacitor coils |
| infantry | Titan Frame | small bipedal mech |
| machine_gun | Pulse Turret | walker with rotary pulse gun |
| at_gun | Lance Walker | spider walker with long lance cannon |
| tank | Hovertank | hovering heavy tank |
| rocket_artillery | Swarm Launcher | tracked missile box launcher |
| boat (embarked) | Dust Skiff | sand-yacht skiff with sail/fan |

## Buildings (`bld_<id>` landmarks)
palace Ark Hab Command · walls Blast Walls · shrine Earth Shrine · temple Memorial Chapel ·
library Data Archive · market Exchange · barracks Armory · harbor Skiff Dock · granary Seed Silo ·
workshop Fabricator · university Research Institute · amphitheater Holo-Theater · bank Credit Vault ·
factory Foundry · observatory Deep Space Array · castle Bastion Dome · aqueduct Water Reclaimer ·
cathedral Cathedral of Earth · powerplant Fusion Plant · stadium Arena · lighthouse Beacon Tower.
Other building ids: name them in the same spirit (CivContent decides).

## City composition
`city_center_<era>`: 0 landed Ark lander with deployed legs & antenna · 1 inflatable hab cluster + solar
array · 2 regolith-shielded dome · 3 multi-dome complex w/ comm tower · 4 glass arcology towers ·
5 gleaming terraformed dome-city with greenery. `house_<era>_a/b`: hab pods → shielded domes → towers.
`wall_seg/tower`: 0 regolith berm & sandbags · 1 plated blast wall · 2 energy barrier pylons.

## Megaprojects (`w_<id>`)
era0 pyramids **Sintered Citadel** · stonehenge **Solar Henge** (ring of tall mirrors) · hanging_gardens **Hanging Greenhouses**
era1 colossus **Beacon Colossus** (giant robot/comm statue) · great_library **Library of Earth** · oracle **The Deep Ear** (listening dish array aimed at dead Earth)
era2 great_wall **Storm Wall** · hagia_sophia **Dome of Remembrance** · angkor_wat **Lava Tube Temple City**
era3 taj_mahal **Monument to the Lost** · leaning_tower **Tilted Spire** · himeji **Olympus Observatory**
era4 big_ben **Clocktower of Sols** · eiffel **Skyhook Pylon** · liberty **Statue of Tomorrow**
era5 opera_house **Biodome Opera** · cristo **Guardian of Mars** (colossal figure, arms open over a valley) · launch_pad **Space Elevator**

## Landmarks (`nw_<id>`)
sky_arch **Valles Marineris** · ember_peak **Olympus Mons** · crystal_falls **Korolev Ice Crater** ·
elder_tree **Jezero Delta** · titan_bones **Face of Cydonia** · mirror_lake **Hellas Brine Sea**

## Nature props (keys → Mars look; renderer maps features to keys)
tree_pine **basalt spire** · tree_broadleaf **hoodoo** (mushroom-shaped wind-carved rock) · tree_palm
**geyser chimney** (mineral vent with steam) · tree_jungle **lava-tube skylight** (collapsed pit w/ rim) ·
tree_snowpine **ice spire** · bush **boulder cluster** · reeds **salt crystals** · cactus **ventifact**
(wind-faceted rock) · flowers **terraform lichen patch** (orange/green, grows later eras) · rock_small /
rock_large **rust boulders** · mountain_a/b/c **shield volcano / mesa / crater-rim massif** ·
mountain_snow **frost-capped massif** · hill_rocks **layered sediment outcrop** · ice_floe **dry-ice slab** ·
reef_coral **mineral shoal** (crystal cluster in dust) · camp_barbarian **Feral Den** (scrap shanty + barrels) ·
ruin_ancient **Crash Site** (half-buried pre-war rover/lander) · road_marker **cairn beacon** · drop_pod
**Orbital drop pod** (scorched capsule, retro nozzles, fins; ~0.35 tall).

## Palette anchors (Mars)
regolith #b5552b #c8693a #9b4424 · butterscotch dust #d9a066 · basalt #3b2f2a #57463d · polar ice #eef3f6 ·
brine lake #3f8f8a · dust sea #a4552c (darker troughs #6e3219) · sky #d7a07a (terraformed #8fb6d6) ·
hab white #e7e3dc · hull grey #8d9097 · solar panel #1d2a44 · hazard orange #f28c28 · cryo cyan #5fd4e8 ·
lichen #8a9a3b #c77b2c · glass #6fa8c9.
