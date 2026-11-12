# Global Standoff — Prototype 0.2.0

Mobile-first, single-player civilization sandbox: your country versus three CPU nations. This is an evolving gameplay test, not yet a finished multiplayer game.

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
- **Optional waterways:** choose `Random`, `Always generate`, or `Off` separately for rivers and lakes when creating a world. Maps can have neither. River-crossing Farms gain +1 Food production.
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
