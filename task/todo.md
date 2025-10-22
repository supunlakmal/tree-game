## Project TODO Roadmap

### Gameplay & UX Enhancements

- **Instant replay flow**: Replace the `window.location.reload()` reset in `app/game/page.tsx` with state resets so the scene stays mounted, letting players jump back into a run without a full page flash or audio drop.
- **In-game pause drawer**: Extend the existing HUD to expose a pause/settings panel where users can adjust steering sensitivity, toggle music or haptics, and read condensed controls without exiting a session.
- **Richer game-over recap**: Expand the game-over modal to surface personal bests, change vs last run, and clearer score sync messages to reward improvements and reassure players their progress is saved.
- **Onboarding overlay**: Show an optional first-run overlay that animates the controls and highlights the spherical driving mechanic before the timer starts, reducing confusion for new players.
- **Leaderboard resiliency**: Add retry/error states around Supabase leaderboard fetches and surface a manual refresh action so outages or rate limits are obvious instead of silently failing.

### Visual Improvements

- **Landing hero polish**: Swap the static landing gradient for a dusk-time parallax or scene capture with subtle motion to sell the “Night Drive” fantasy before gameplay begins.
- **Environment asset pass**: Convert the palm tree FBX into an optimized glTF and instance it around the planet so foliage loads quickly, casts correct shadows, and keeps draw calls low.
- **Vehicle upgrade**: Replace the placeholder box car with a stylized mesh featuring emissive trims and reactive brake lights to align the hero asset with the atmospheric world.
- **HUD urgency cues**: Refine timer styles to pulse or glow as time runs low, improving readability and emotional pacing during the final seconds of a run.
- **Consistent iconography**: Replace mis-encoded emoji literals (e.g., leaderboard ranks) with proper glyphs or React icon components to ensure crisp rendering across fonts and locales.

### Performance & Technical Tasks

- **Foliage batching**: Rework tree placement to use `THREE.InstancedMesh`, impostors, or chunk streaming so populating 1,000 trees no longer clones full scenes or materials on the main thread.
- **Planet motion rethink**: Investigate moving the car relative to a static world or faking curvature in shaders instead of rotating the whole `planetGroup`, reducing matrix recalculations each frame.
- **Adaptive rendering**: Cap renderer pixel ratio (for example `Math.min(1.5, window.devicePixelRatio)`) and expose a performance toggle so high-DPI phones retain frame rate without manual tweaks.
- **Input handling update**: Modernize keyboard handling by switching from deprecated `keyCode` events and limiting `preventDefault` to the keys the game actually consumes; this keeps browser shortcuts intact.
- **Geolocation caching**: Cache the detected country in localStorage/session to avoid hammering the IP API on every load, protect against rate limits, and accelerate replays.
