# Idle Nature

An isometric idle game about rewilding a British city. Bring down buildings, break up the paving and let
succession take over: pioneer weeds, then grassland, scrub and woodland. Bring back the animals that
pollinate, carry seed, browse and hunt, and discover hidden ecosystems along the way.

The whole game is a single file: open `index.html` in a browser. Progress is saved in the browser.

## How it plays

- **Research only what is new.** The Wood Wide Web holds the stages of succession, the animals and the
  forces of nature. Every node explains what it adds to the game.
- **Plants level up on their own.** A grown tile slowly turns into richer species of its own stage, as far
  as its spot allows: soil, height, damp, shade, pollinators and partner animals.
- **Seed travels like it does in nature.** On the wind, inside birds, buried by jays and squirrels, in the
  fur of grazers or on water. Once enough parent plants grow, their seed rains in everywhere.
- **A field guide** with an entry for every plant and animal, and lessons on how ecosystems work.

## Play on iPhone

The game is also an installable web app. Open it in Safari at
**https://thomas0x2.github.io/gaia-tycoon/**, tap the Share button, then **Add to Home Screen**. It then opens full
screen from its own icon and keeps working offline. Tap to act, drag to pan, pinch to zoom.

The Home Screen app keeps its own save, separate from the one in Safari.

Hosting is plain GitHub Pages from the `main` branch root (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).
`sw.js` caches the game for offline play; bump its `VERSION` if you add files the app needs.
