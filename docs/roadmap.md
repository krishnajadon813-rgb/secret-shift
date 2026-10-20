# SECRET SHIFT — development path

## Current milestone: VERDANT HAVEN offline slice

The active browser page now uses an original floating-island setting and a working single-player loop: gather Sunfruit/salvage/crystal, craft nectar or light cells at different stations, fulfil three keeper requests, earn glow coins, buy persistent sanctuary upgrades, and choose a waterfall or lantern-root route when the SECRET SHIFT changes the world. Island 02 has a new request set and alternate waterway/forest arrangement. Progress saves locally. Android packaging remains on the existing Capacitor app ID `com.secretshift.game`.

Automated tests cover inventory, recipes, rewards, duplicate delivery prevention, upgrades/save restoration, the route choice, sector progression, keyboard movement, touch joystick, pause/background recovery, camera-follow direction, local browser resources, and the Canvas fallback. Graphics tests use a simulated WebGL context; real-browser visual and physical-phone GPU playtests are still needed.

## Next milestones

1. Play the browser slice and the debug APK on real screens. Adjust camera distance, camera turn smoothing, touch areas, text, and WebGL performance from actual device feedback.
2. Add more genuinely different islands, characters and request/puzzle varieties based on playtesting. Improve collision, environmental animation, ambient sound and visual effects without sacrificing ordinary-phone performance.
3. Add a longer campaign, tutorial pacing, accessibility settings and richer persistent town changes.
4. Design real multiplayer as a separate future phase. It needs a real authoritative networking implementation, reconnect/synchronization behavior and hosting; it is not present in this offline prototype.
5. Prepare release signing and app-store requirements only if/when distribution is requested.

No paid service or external art asset is required by the current prototype. Concept art supplied by the user is kept as reference only; it is not bundled as game art.
