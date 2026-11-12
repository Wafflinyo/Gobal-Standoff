# Global Standoff — Prototype 0.3.4

Mobile-first, single-player civilization sandbox: your country versus three CPU nations. This is an evolving gameplay test, not yet a finished multiplayer game.

## New in 0.3.4 — Visible build and expansion animations

- Constructing a building now **dismisses the territory overlay before animating**.
- The camera centers on the selected hex; cartoon dust puffs appear and the new miniature building springs up with a bounce.
- The building stays hidden on the board until the animation starts, rather than appearing behind the overlay.
- Claiming territory uses the same hide → camera → border reveal → restore sequence.
- After the animation ends, the territory overlay reopens on the same tile, restoring the construction options and scroll position where possible.
- Actions are temporarily locked during an animation, and CPU turn playback still advances normally.
- Reduced-motion accessibility settings shorten the animation.

## Play online

Enable **Settings → Pages → Deploy from a branch → main → /(root)** once in GitHub. The repo is currently named `Gobal-Standoff` (missing the second `l`), so the current website address is:

https://wafflinyo.github.io/Gobal-Standoff/

The page uses plain HTML, CSS, and JavaScript: no build pipeline or external dependencies. All progress is saved in the same browser using `localStorage`.

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
- **Military roster:** recruit adult citizens into Military Posts (up to 12 per post), train them, and transfer one soldier between posts per turn. Training can unlock a placeholder perk, `Disciplined`; warfare/experience gains are not implemented yet.
- **Automatic waterways:** rivers and lakes are generated randomly with each new world (no manual setting). Maps may have either, both, or neither. Farms on riverbank hexes gain +1 Food production.
- The map supports drag-to-pan and pinch-to-zoom on a touchscreen.
- Old 0.1 saved matches can be resumed, but retain their original 61-hex layout. Start a **new match** for the larger world and generation options.

## Other gameplay

- Expand into neighboring neutral territory (Gold + Food)
- Build or sell structures with Gold cost and Gold upkeep; negative Gold puts construction/recruitment on hold
- Research Irrigation, Commerce, and Cartography
- Draw and play resource and discount cards
- Three CPU opponents build and expand after each turn; 24-round economy leaderboard

## Current limitations

This remains a **local solo test**. Battles, troop travel time, diplomacy, trade caravans, espionage, public online multiplayer, and the complete four-category scoring system will be developed in later updates. Soldier `Experience` is currently 0 until battle progression is introduced. Troop transfers are instantaneous for this test, and population arrival is simplified.

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