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
- **Neighbours matter.** Every grown plant earns more or less depending on what grows and lives right next to it:
  mixed planting, edges where grassland, scrub, woodland and water meet, nitrogen fixers, pollinators, light grazing
  and partner animals help; monocultures, deep shade and overgrazing hurt. The Synergies view shows where.
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

## Native iPhone app (Capacitor)

The `ios/` folder is an Xcode project that wraps the same `index.html` in a native app with
[Capacitor](https://capacitorjs.com). It runs fully offline, fonts included, and keeps its own save.

You need a Mac with Xcode, Node.js 22 or newer, and an Apple ID.

1. `npm install`
2. `npm run ios` copies the game into the app (`www/`, downloading the fonts) and opens the project in Xcode.
3. In Xcode, select the **App** target → **Signing & Capabilities** → pick your **Team** (sign in with your Apple ID
   under Xcode → Settings → Accounts if none is listed). If Xcode says the bundle identifier is taken, change
   `io.github.thomas0x2.idlenature` to something unique.
4. Plug in your iPhone, choose it as the run destination at the top of the window, and press ▶ Run.
   The first time, the phone asks you to turn on **Developer Mode** (Settings → Privacy & Security) and to trust
   your developer certificate (Settings → General → VPN & Device Management).

With a free Apple ID the app stops opening after 7 days until you run it from Xcode again. A paid Apple Developer
Program membership removes that limit and lets you share it through TestFlight or the App Store
(Product → Archive in Xcode).

After changing `index.html`, run `npm run sync` (or `npm run ios`) so the app picks up the new version.
