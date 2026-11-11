# Global Standoff

**Prototype v0.1.1 — solo test against three CPU countries.**

## Play on your phone

After GitHub Pages is enabled, visit **https://wafflinyo.github.io/Gobal-Standoff/** in Safari. Note that the repository is currently named `Gobal-Standoff` (without the second l); the URL must match the repository name.

### Activate GitHub Pages (one-time repository setting)

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Set the branch to **main** and the folder to **/(root)**, then save.
4. Open the Pages URL shown by GitHub once deployment finishes.

## What's playable

- Name your country and capital, select your country color
- Compete against three CPU countries on a random 61-hex map
- Claim neighboring land and build farms, homes, mines, markets, and other structures
- Manage Gold, Food, Materials, Knowledge, building upkeep, and debt
- Draw and play starter cards; take turns while CPUs expand and develop
- Play a 16-round economy-focused match; save and resume on the same browser

This is a **local single-player prototype**, not a live multiplayer game. The save is stored in the browser of the device where you're playing, and isn't synchronized to other devices. Combat, military posts, reconnaissance, diplomacy, and caravans are planned for later versions.

## Repository files

- `index.html`: mobile game UI
- `styles.css`: layout and design
- `game.js`: game rules, map generation, CPU behavior and local saves
- `icon.svg`: icon

Built with vanilla HTML, CSS and JavaScript. No build tools or external libraries required.
