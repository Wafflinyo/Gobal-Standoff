# Global Standoff — Prototype 0.4.0

Mobile-first, single-player civilization sandbox: your country versus three CPU nations. This is an evolving gameplay test, not yet a finished multiplayer game.

## Play online

Enable **Settings → Pages → Deploy from a branch → main → /(root)** once in GitHub. The repo is currently named `Gobal-Standoff` (missing the second `l`), so the current website address is:

https://wafflinyo.github.io/Gobal-Standoff/

The page uses plain HTML, CSS, and JavaScript: no build pipeline or external dependencies. All progress is saved in the same browser using `localStorage`.

## New in 0.4.0 — Turn-based crews, construction and reliable territory panels

- **Starting capital:** all four countries begin with a Level 1 Homes building, a Level 1 Builders’ Bunk, one named citizen assigned as Builder, and one Level 1 Expedition Crew. Builders are not regular workers or soldiers. Homes create beds and do not employ caretakers.
- **Builders and travel:** a new construction or upgrade requires an idle builder. The builder is reserved immediately, travels from its current location (one map hex per turn), and then works on site. Building work progresses after **every country's individual turn**, including during opponents' turns, rather than only at the end of the entire round. Builders receive wages as part of national upkeep.
- **Builder capacity:** each Builders’ Bunk has 1/2/3 positions at building levels 1/2/3. Multiple Bunks provide more crews. With two builders, choose separate concurrent builds or assign an additional idle builder to an existing project for twice the progress per turn. Crew assignments free up when jobs finish.
- **Expeditions instead of instant expansion:** spending an expansion action dispatches an available expedition crew. The tile remains unclaimed while the expedition travels. When it reaches and secures the land, the border appears in the claiming country's color via the existing reveal animation. A country starts with one expedition; it cannot dispatch another while that crew is busy.
- **Per-turn completion cinema:** each completed construction project or claim is queued at the end of the individual turn when it finishes, with sequential camera focus and finish animations before the next country's turn proceeds. CPUs use the same animation rules as you.
- **Input repair:** map taps are handled at pointer release, with click/keyboard fallback, instead of depending on stale SVG hex elements from camera redraws. The game keeps interaction locked until the CPU return camera finishes, then re-enables territory overlays. Cards no longer have other text behind their fanned faces.
- **Migration:** older saved games keep existing countries, inventories, territory and military; the capital civic package and crews are added once, existing construction work gets translated to per-turn progress where possible.

**Notes:** Delivery shipments and recurring economic output still run on the existing global-round schedule. Construction and expeditions use individual-turn progress in this version. Expedition route-finding is currently hex-distance based; specialized terrain movement will be part of a later expansion.

## New in 0.3.9 — CPU cinematic turn repair

- Fixed incorrect action highlighting: the old code compared a building count to a building array, so every CPU action appeared to modify the first map hex. Events now carry exact action type, country, and selected hex, with a count-to-count fallback. Non-map actions no longer create fake map highlights.
- CPU claims and construction now use the **same on-hex reveal and cartoon worksite animations** as the player's own actions. The territory is hidden until the camera arrives, then the border reveals with the CPU's national color. Buildings display their worksite start effects.
- Cinematic camera transitions and pauses have been lengthened to make each CPU action easier to follow. The camera pans/zooms smoothly through the SVG viewBox without recreating the whole 169-hex map on every frame; the 2.5D tilt is rendered at a lower frequency to reduce mobile stutter.
- Each CPU first plays its optional card and shows the card effect, then takes its three major actions one at a time. Scene animations and holding pauses are awaited before the next action starts. **Skip CPU animations** still finishes the round quickly.
- Player-selected hex highlighting no longer persists in another country's POV. All 0.3.x browser saves remain compatible.

## 0.3.6 — One deposit per mountain / finite mining and military gear

- **Every mountain holds at most one mineral deposit, or none at all.** World generation assigns a fixed mineral vein deterministically by map seed: Coal 26%, Iron 20%, Copper 9%, Silver 5%, Gold Ore 3%, Diamond 1%, and 36% of mountain hexes are barren. A mountain never generates all ore types.
- **Only a mountain with a mineral vein can host a new Mine.** Mining a vein yields only that mineral. Deposits have finite reserves and can be exhausted. Coal produces frequently and Diamonds are rare both as deposits and as successful extractions (12% chance per mining round, 1 unit if successful).
- **Steel is made, not mined:** Smelt Steel using 2 Iron + 1 Coal + 1 Gold coin, taking one major action. Each country tracks Coal, Iron, Copper, Silver, Gold Ore, Diamonds and Steel. Gold Ore is *not* the same as spendable Gold coins.
- **Mineral Exchange:** The Nation overlay lists mineral holdings. Sell any raw mineral to the Global Bank for Gold, or import common minerals at a premium; each purchase/sale takes an action. Diamonds have the highest bank sale value (40 Gold). Direct mineral cargo trading between countries is still planned.
- **Troop equipment:** Named soldiers can be issued Iron Gear, Gold Gear (made with Steel and Gold Ore), or Diamond Gear (made with Steel and Diamonds). Equipment persists on the soldier and increases their readiness score. Combat resolution is not yet implemented, so bonuses are tracked for future battles.
- **Old saved worlds:** Their terrain, buildings and citizens are preserved. The previous generic Ore inventory is converted to Iron. Mountains gain a single deterministic vein or none; older working Mines on otherwise barren mountains receive an Iron vein to prevent breaking existing builds.

## New in 0.2.0

- A **169-hex** random world (previously 61) and a **24-round** economic test (previously 16).
- Terrain limits for **building space / maximum population** (building slots and residents):

  | Terrain | Building space | Maximum residents |
  | --- | ---: | ---: |
  | Plains | 8 | 30 |
  | Forest | 6 | 20 |
  | Hills | 5 | 16 |
  | Desert | 3 | 10 |
  | Mountains | 2 | 6 |
  | Lakes | 0 | 0 |

- Multiple buildings can share a hex until its space is full. The capital consumes two spaces and provides 12 housing spaces. Farms, mines, lumber camps, markets, academies, and military posts consume two slots each; Homes consume one slot.
- Each Homes building houses **up to eight citizens**, limited by the terrain's total population ceiling. Building homes cannot overcome a territory's natural population limit.
- **Citizen roster:** each person has a name, age, residence, and optional military assignment. Countries start with 10 citizens. New citizens can arrive each round when Food and living conditions permit. Unhoused people are tracked as homeless.
- **Food use:** 1 Food per six citizens (round up), in addition to existing expansion costs. Food shortages stop population growth; citizens in housing produce some tax Gold.
- **Military roster:** citizens enlist voluntarily after a military post is complete. Each potential volunteer uses age, health and morale to determine their odds. Recruiting campaigns boost interest; players can train and transfer soldiers. Older citizens are far less likely to enlist.
- **Automatic waterways:** rivers and lakes are generated randomly with each new world (no manual setting). Maps may have either, both, or neither. Farms on riverbank hexes gain +1 Food production.
- The map supports drag-to-pan and pinch-to-zoom on a touchscreen.
- Old 0.1 saved matches can be resumed, but retain their original 61-hex layout. Start a **new match** for the larger world and generation options.

## Other gameplay

- Expand into neighboring neutral territory (Gold + Food)
- Build or sell structures with Gold, Wood and Ore costs and ongoing Gold upkeep; unfinished builds reserve space but give no output
- Research Irrigation, Commerce, and Cartography
- Draw and play resource and discount cards
- Three CPU opponents build and expand after each turn; 24-round economy leaderboard

## Current limitations

This remains a **local solo test**. Battles, troop travel time, resource-carrying trade caravans, espionage, public online multiplayer, and the complete four-category scoring system are still planned. Trade-route negotiation and construction now exist, but do not yet carry itemized cargo. Soldier `Experience` is currently 0 until battle progression is introduced. Troop transfers are instantaneous for this test, and population arrival is simplified.

## Source files

- `index.html` — game markup
- `styles.css` — mobile layout and game styling
- `game.js` — rules, world generation, rosters, CPU AI, and saved progress
- `icon.svg` — game icon

## 2.5D board & camera (v0.3)

- The map now uses angled, layered, extruded vector hexes with illustrated plains, forests, mountains, hills, deserts, and water. There are no heavy 3D libraries or network image dependencies.
- Landmarks and all buildings are drawn as tiny structures on the terrain. The board shows up to three buildings on a tile and counts additional buildings.
- When you end your turn, the camera turns and pans toward each CPU country, then focuses on its changed territory or construction. Its action is displayed in a banner. You can skip CPU animations.
- The **⌂** camera button returns to your capital. **⤢** shows the entire board. Zoom and drag still work.
- Existing prototype 0.2 saves, named citizens, rosters, economic balances, terrain capacities, research, and CPU rules are retained.

This is **2.5D illustrative artwork**, not actual 3D geometry, textured models, or the final painted visuals. Smoothness will vary across phones; use the skip-animation control on slower devices. Combat and sophisticated rival-country interactions are not implemented in this visual update.

## New in 0.3.1 — automatic lakes and edge-following rivers

- Rivers and lakes are now generated automatically, without any lobby selectors. They each have a random chance of appearing; maps may have one, both, or neither.
- Lakes are larger, contiguous hex clusters (typically 4–9 water tiles per lake), and are more frequent than in 0.3.0.
- River channels are constructed as **connected shared edges between adjacent land hexes**, never through hex centers. River bank hexes receive the river farmland benefit.
- Existing saved matches keep their land ownership and water tiles, with old centerline rivers upgraded to border-following rivers. Generate a **new** world to see the new lake placement.


## New in 0.3.2 — map-first overlay interface

- The game now occupies a full-height map view rather than requiring page scrolling through sidebar controls.
- Tap **any hex** for an over-map territory sheet with terrain, capacity, buildings, expansion, and military-post actions. Choose **Construct** inside that sheet to see building choices; all existing costs and turn restrictions remain.
- Compact bottom buttons open panels over the map for **Nation** (treasury, population and emergency taxes), **Research**, **Citizens** (civilian and military rosters), and **World** (standings and dispatches).
- Your cards are displayed in a **fanned hand** at the bottom of the map. Tap a card to pull up a large, readable preview and decide whether to **Play Card** or close it. Merely tapping the hand cannot consume a card.
- **End Turn** remains available above the hand, with the same animated CPU POV transitions. All economic rules and old saves are preserved.
- All overlays work on iPhone-sized screens without leaving the map; long rosters scroll inside their overlay rather than scrolling the entire game page.


## 0.3.3 — Faster turns

- All four countries now receive **three major actions** per turn, plus one optional card and one troop logistics order.
- Any combination of claims, construction, military recruitment, training, research, building sales, or emergency taxes may be used while actions remain.
- Each additional claim in a single turn costs **2 extra Gold** to keep fast expansion from being free.
- Emergency taxes may be collected only **once per turn**.
- A visible action meter tracks remaining actions on the map. CPU countries play up to three actions, with each one presented during their camera turn.
- Existing local game saves are preserved: a previously used one-action turn counts as one of three actions rather than locking the turn.


## 0.3.4 — Construction-reveal animation

- Territory overlays now temporarily close while the game focuses on a construction or territory action, then reopen with the previous tab and scroll position when the action finishes.

## 0.3.5 — World activity, construction timers, trade routes, volunteers, and Wood/Ore

- **CPU observation:** during the other nations’ turns, your hand becomes a compact left-side stack showing card names; the focused opponent has a fanned set of card backs to the right. A smaller action caption stays near the top of the map instead of covering the center.
- **Card activation:** played cards appear in the center of the map, reveal their illustration/icon and name, then burst into fading fragments. Skip CPU animations also skips CPU card effects.
- **Timed construction:** starting a building spends its resources and reserves space. A worksite with looping cartoon dust is visible until the project has completed its 1–3 round build time. Only completed buildings generate resources, housing, or military posts. At the beginning of your next turn, newly completed buildings receive a dust-cloud/spring-up reveal before ordinary play continues.
- **International trade routes:** first contact happens when two countries' claimed territories come within two hexes. After contact, countries can propose a route and agree on the cost split (25/75, 50/50, or 75/25). CPU countries consider offers after a delay. Human players can accept or reject incoming offers in the World overlay. Accepted routes draw along **shared land-hex edges**, like rivers, and grow in length during their construction period. Longer routes take more rounds and cost more Gold. Once active, both countries earn 2 Gold per round. Trade goods and caravan interception remain future extensions.
- **Voluntary military enlistment:** finished military posts can accept up to 12 soldiers each. Citizens roll a chance to enlist each round based on age, health and morale; marketing costs 4 Gold and increases the chance for two rounds. Training and soldier transfers remain manual. Very old citizens have a very low (not zero) chance to join.
- **Materials split:** the old Materials balance becomes **Wood** and **Ore**. Forest hexes yield Wood and only forests can host Lumber Camps. In 0.3.5 mountains yielded generic Ore; as of 0.3.6 only mineral-bearing mountains can host Mines and they extract their own single deposit. Hills, deserts, and plains cannot host either extraction building. Construction costs use specific combinations of Wood and Ore.
- **Save migration:** v0.3.x saves retain map, player ownership, citizens, buildings, and progress. Old Materials holdings become approximately 60% Wood and 40% Ore. On old existing worlds, legacy extraction buildings remain where they were, but only newly constructed ones obey the terrain-specific rules.

This update keeps the equal **3 major actions per turn** rule for all countries. Trade proposals and recruitment marketing each consume one major action; accepting an incoming diplomatic proposal does not.

## Version 0.3.7 — Workforce, upgrades, mineral pairs and armor

- Every mountain has either zero deposits, one primary deposit, or a primary deposit **plus Coal only**. Coal can also be the sole primary mineral. There are never two different non-Coal veins together. Deposits have limited reserves.
- Troop armor progression: **Leather → Iron → Steel → Gold-Reinforced Steel → Diamond-Reinforced Steel**. Steel is manufactured from Iron and Coal, not mined.
- Every completed building (including homes and military posts) has a staff capacity. Adults not enlisted in the army fill eligible jobs automatically unless the workplace is switched to manual staffing. Players can **Hire**, **Release**, or toggle **Auto ON/OFF** in a territory overlay; staffing changes do not spend major actions.
- Each worker is a named citizen, can hold exactly one job, and costs **1 Gold in wages each round**, on top of the building's base upkeep. Worker morale affects how much the workplace produces. Empty workplaces produce no resources, although the treasury still pays fixed upkeep.
- All buildings may be upgraded to **Level 2** and **Level 3** for more worker spaces, improved equipment and greater potential production. An upgrade takes time, costs Wood, Iron and Gold, increases base upkeep, and requires one major action. Example Mine slots: **2 / 4 / 6**.
- Mines produce only from their fixed primary/secondary deposits. Staff quantity, worker morale, equipment level and rarity affect the chance of a successful extraction and its quantity. Empty mines produce nothing. A Coal co-deposit can continue producing after the primary vein is depleted.
- New **Steelworks Factory** (plains and hills) has 2/4/6 staff positions and automatically uses 2 Iron + 1 Coal to make Steel per production batch, when staffed and supplied.
- Older 0.3.x saved matches are migrated in place, keeping existing buildings and soldiers, adding worksite metadata, and mapping old Basic armor to Leather.

The military readiness bonuses are tracked but combat is still a future system. Trade routes and player-vs-CPU interactions remain experimental.

- Newly generated countries now begin with 34 Gold instead of 24, allowing a little more time to establish their first wages and buildings under the three-action turn system. Existing saves retain their Gold balance.


## Version 0.3.8 — physical production chains and deliveries

- **No starting army equipment:** newly enlisted soldiers begin without armor, weapons or shields. Legacy saves reset their old free/default Leather, while previously earned Iron/Steel/Gold/Diamond armor stays on the soldier. Newly produced gear must be shipped before issue.
- **Farms** make Food and **raw Leather** at the farm worksite, scaled by workforce and morale. Output does not appear in the treasury until a shipment reaches the warehouse.
- **Lumber Camps** collect raw **Timber Logs**. **Woodworks Factories** choose a recipe: logs into **Construction Wood** (for buildings), or logs into **Wooden Shields**. Both outputs must be shipped onward.
- **Every mountain yields Stone when a staffed Mine is operating**, even a barren mountain. Ore (plus optional Coal co-deposit) is separate and still finite. **Stone Workshops** produce Stone Axes, Stone Pickaxes, Stone Swords or Stone Clubs, chosen from the territory overlay.
- **Leather Factories** convert delivered Leather into Leather Armor. **Steelworks** consume delivered Iron and Coal to make Steel. **Armories** produce Iron, Steel, Gold-Reinforced Steel, and Diamond-Reinforced Steel armor; recipes consume local inputs.
- **Local inventories:** goods are held at a worksite, in an outbound shipment, at another worksite, or at the capital warehouse. Wages, Gold and research are not physical cargo.
- **Delivery routing:** each producer has independent routes for every item. Players can send raw Leather directly to a Leather Factory, Stone to a Stone Workshop, Timber Logs to a Woodworks Factory, or finished gear to a chosen Military Post. The default destination is the capital warehouse. Factories automatically request missing ingredients from the capital warehouse; all inputs physically travel and cannot be used before arriving.
- **Domestic freight:** shipment paths only traverse owned hexes and typically require 1–3 complete rounds based on distance. Transit lists and local stock counts appear in the Nation and Territory overlays. A destroyed/sold site has its remaining inventory sent back to capital.
- **Issue gear at destination:** named soldiers can receive armor, Wooden Shields and Stone weapons only when the finished items have arrived at their own post. Equipping consumes the delivered item and a major action. Three-action fairness applies to humans and CPUs.
- Building construction and upgrades still take multiple rounds, and employees still receive wages. This adds strategic bottlenecks rather than providing any item for free.

Known prototype limitations: shipments are not yet visual caravans; military combat and interception are not in the game; capital-warehouse construction purchases use stocked materials without a separate delivery animation. National trade-route negotiation from 0.3.5 remains independent of these domestic supply chains. Ore variants Copper/Silver and mining probabilities remain unchanged.

The prototype currently includes a modest personal-income tax from housed adults and employed citizens to offset the increased salary pressure; wage and fixed upkeep are still fully charged. Economy balance is provisional.

## 0.4.5 — Messenger Falcons, Cooperative Roads & Caravans

- You can propose an international road between **any two named, owned territories**, even before borders meet. Roads follow hex edges through neutral land; third-party owned land blocks routes without permission.
- A messenger falcon carries proposals to the recipient's capital, taking individual turns. The receiving nation can accept or decline when it arrives.
- The offered 10–90% cost share is rounded to **whole border segments** (mountain segments cost more). Each country prepays its exact segments and commits an **idle named builder**. Builders travel from their current location, then work from opposite ends; the country paying less finishes sooner and regains its builder.
- Caravans are *physical* units stored in Caravan Warehouses. L1/L2/L3 warehouse provides 1/2/3 berths. A wagon travels to pickup, then delivery, then a warehouse; it cannot instantly deliver. Default final policy is the nearest available warehouse, with options to return home or stay at a warehouse destination where space permits.
- Routes, falcons, expedition footsteps and wagons are drawn using original SVG primitives, not emoji images. Other older UI emoji are not yet replaced globally.
- Older finished routes persist, while incompatible unaccepted proposals are marked rejected to avoid silent legacy charge or builder-lock problems.


## v0.4.6 — Silver Pents, falcon diplomacy, war phases
- **Silver Pents (SP)** is the currency; the save data property remains `gold` for compatibility, but the game displays SP and a custom silver pentagonal coin emblem. Gold Ore remains a mineral.
- Falcons may carry territorial warnings, war declarations or ceasefire proposals. They take individual turns to fly between capitals. A warning can be tied to a named neutral hex; claiming it launches the promised war declaration. No battle begins on entering a war phase.
- Active wars lower morale of ordinary nonmilitary citizens at declaration and each global round. Military volunteers and stationed troops are excluded from the penalty.
- War orders support border patrols of owned frontier tiles, and slower flanking via unowned hexes without roads. Troops are drawn from real military post rosters. Each country has one military logistics order per turn. Troop positions are hidden from the enemy; CPU camera does not reveal confidential orders.
- International road proposals can still be sent for remote territories, but builders may only lay border segments on edges adjoining hexes owned by their own country. Neutral stretches remain **waiting for land** until claimed. No road may be physically constructed through unclaimed land.
- Military battles, recon visibility, battle results and occupation are future systems; this version models the war phase and maneuvering, not combat resolution.