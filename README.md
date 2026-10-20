# SECRET SHIFT — VERDANT HAVEN

A free, offline-first single-player nature-market adventure on a floating island. Grow and gather island goods, process supplies, stock market displays, serve visiting guests, help the keepers, earn glow coins, and uncover the SECRET SHIFT.

This is an early playable prototype using original procedural low-poly WebGL graphics. It is not a finished commercial game, photorealistic art, or online multiplayer. No paid service, asset, account, or Internet connection is required to play.

## Easiest way to play on Windows

1. Open the SECRET SHIFT project folder in File Explorer.
2. Double-click **start-game.bat**. A black window will stay open while the local game is running; your browser opens the game.
3. Click **Continue exploring**. Use **W A S D** or arrow keys to walk. Press **E** or **Space** near a glowing item, machine, keeper or shrine. Press **P** to pause.
4. To stop the local game, close the black server window.

The project already includes free Node.js dependencies and Android build tools. No downloads are needed for the browser prototype. The game saves supplies, market stock and sales, helper hire, requests, upgrades and the route choice on this device/browser.

## What is playable

- A third-person floating sanctuary with a warm garden, keeper market, habitat, central crossing, waterway, glass-roof huts, raised beds, trees, blossoms, a hidden lantern-root shrine and collectible resource glows.
- A reference-led procedural explorer with a visible face, brown hair, green field jacket, cream chest mark, trail goggles, gloves, boots and pack; keyboard or touch joystick movement, camera follow, free-look, recenter, pause and safe resume after switching apps. It is still low-poly geometry, not a rigged or textured imported 3D model.
- Collectable Sunfruit, salvage and crystal. The Sunfruit press makes nectar; the solar recycler turns salvage and a shard into a light cell.
- A small open-front timber nature-market with a green sign, lanterns, plants and three visible displays. Sunfruit, nectar and light cells move from real pack inventory onto shelves. Six distinct low-poly visitor silhouettes rotate through the plaza; visitors prefer different goods, browse briefly, buy only real shelf stock and leave. A valid sale pays 8, 14 or 18 glow coins; an empty shelf records a missed visit. Product dots match saved stock.
- Sunfruit, salvage and crystal patches regrow after 38 seconds of active play. Nori can be hired once for 70 glow coins and moves one Sunfruit from the pack to the shelf every 24 seconds. Habitat upgrades increase display capacity.
- The pack holds 12 items; the habitat upgrade adds two carrying slots and two spaces to each display. When full, gathering is blocked until supplies are stocked, crafted or delivered.
- Three different keeper requests that consume the right inventory and award glow coins only once. Use rewards for garden, solar and habitat upgrades. Garden and solar upgrades affect production; upgrades are saved and add visible island changes.
- Keeper requests can be delivered in any order when the required inventory is ready, while guest sales and helper restocking continue during the shift. This creates a small offline multitasking loop.
- An offline SECRET SHIFT choice between restoring the waterfall route and following lantern roots. The route visibly opens in the scene and is saved. The next island has a different set of requests.
- The story milestone result screen, score/time, next island and continued free exploration after the story. No fake online players or multiplayer service.

## Run from a terminal (optional)

If you already have a terminal open in this folder, run `npm run play`, then visit **http://127.0.0.1:4173**. The server only listens on your own computer and only serves the local browser files.

To run the automated checks, run `npm test`.

## Build and install the Android test app

This project retains the existing Capacitor Android wrapper and app ID `com.secretshift.game`.

1. Double-click **build-android-debug.bat** in this folder and wait for **APK ready at:**.
2. Copy **SECRET-SHIFT-debug.apk** from this folder to your Android phone (USB cable, or a file-transfer app you already use).
3. On the phone, open the APK in Files/Downloads and tap **Install**. If Android asks, allow your file app to install this test app, then confirm **Install**.
4. Open **SECRET SHIFT** and use the on-screen joystick and large interaction button. Hold the camera strip for a short look around; tap ⌖ to return the camera behind the explorer.

This is a locally signed debug build for testing, not an app-store release. Real-phone installation and graphics performance still need your device's playtest; the previously connected phone was not authorized for computer installation.

## Project map

- `index.html` — game layout, tutorial, touch controls, request/inventory/upgrade panel and menus.
- `client/verdant-game.js` — movement, camera/input flow, gathering, crafting, keeper requests, SHIFT story and UI.
- `client/verdant-sim.js` — pure offline economy, request, upgrade and versioned save rules.
- `client/scene3d.js` — hand-built WebGL 1 island environment, explorer, resource glows and camera; keeps a simple Canvas fallback.
- `client/style.css` — responsive desktop/phone/landscape layout and safe-area spacing.
- `scripts/serve.mjs` and `start-game.bat` — safe local-only browser launch.
- `tests/verdant-systems.test.cjs` and `tests/verdant-game.test.cjs` — progression rules and playable UI flow checks.
- `client/game.js` — the former Echo Station prototype is retained as a recovery/reference copy; the active browser page loads `verdant-game.js`.
- `android/` and `capacitor.config.json` — existing Capacitor Android project and package identity.
- `backups/pre-verdant-haven-20261020/` — previous source files and previous debug APK saved before this change.
- `backups/pre-market-overhaul-20261020/` — a complete source/test/docs and APK snapshot from immediately before the market and control work.
- `docs/verdant-art-direction.md` — how the supplied art references guided the local procedural art.

## Art and current limits

The supplied explorer reference guides the player silhouette and colors; the shop/customer board guides the wooden open-front market and a varied friendly visitor cast. The actual game uses original local procedural geometry, not the supplied images as textures. This lightweight low-poly scene is an achievable prototype; it is not a rigged character model or the polished painted 3D look of the references. The sample shop branding was not copied.

The broad market inspiration was researched from the game's Google Play description and publicly visible gameplay screenshots: production feeds shelves, customers consume stock, sales fund expansion and staff gradually automate the busywork. SECRET SHIFT applies that familiar management rhythm to original sky-island products, keeper requests, a mystery-changing world, and offline progression; it does not reuse the game's characters, branding, map, UI or assets.

## Current limits

The customers are a lightweight local simulation: six visitor variants select a preferred product when it is stocked, walk to a display, browse, buy one item, and leave; this is not a full checkout queue or deep pathfinding simulation. Nori is one fixed-role stocker, not a full staff assignment system. Production is currently an instant interaction rather than a timed machine queue. The current slice does not yet include an optional timed-task board, store-layout expansion, or another unlockable island beyond the existing second island milestone. The game remains single-player and offline; online multiplayer is not implemented.

The campaign is solo and offline. No online multiplayer, remote account, phone playtest, or store-ready signing is claimed. A browser test harness exercises actual controls and the complete mission flow; the automated graphics renderer is a simulated WebGL context and cannot prove how the GPU looks on every phone.

The current debug APK was built successfully and verified with Android's package and signature tools. Its exact path is `SECRET-SHIFT-debug.apk` in this project folder; the Android application ID remains `com.secretshift.game`. The APK requests no Internet permission (AndroidX contributes one app-specific dynamic-receiver permission). Phone installation was not verified because the attached device reports `unauthorized` to Android Debug Bridge; copy the APK to the phone for manual installation.
