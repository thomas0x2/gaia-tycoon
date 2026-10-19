# Sprites

Every plant and animal in the game is drawn from a PNG sprite sheet in this folder. Change a PNG and the game
draws the new picture, on the map and in the field guide. Sheets are made from the game's own drawing code by
`npm run sprites`, so they always start out looking exactly like the code-drawn art.

```
sprites/
  sprites.js        the list of sheets the game loads, with each sheet's frame size and anchor
  plants/<id>.png   one sheet per plant and plant level (oak.png, oak2.png, meadow3.png …)
  animals/<id>.png  one sheet per animal (fox.png, heron.png …)
  homes/<id>.png    one sheet per animal home, named for its animal (fox.png is the fox earth)
```

The file name is the species id from `FLORA` or `FAUNA` in `index.html`. A species with no sheet is simply drawn by
its code, so new species keep working before anyone has drawn them.

## Plant sheets

A grid of frames, all the same size (`w` × `h` pixels in `sprites.js`):

- **Rows are the days of the year**: 12 rows, three per season, starting with the first day of spring.
  Row 1 is early spring blossom, rows 4–6 summer, 7–9 autumn colour and leaf fall, 10–12 winter and snow.
- **Columns are growth stages and looks**: 3 stages (young, half grown, grown) × 2 looks.
  Columns 1–2 are the two looks of a young plant, 3–4 half grown, 5–6 grown. Each tile picks one of the two looks
  so neighbouring patches don't repeat exactly.

You don't have to fill the whole grid. The game counts the rows and columns of whatever PNG it finds:

| You draw | It is used for |
|---|---|
| 1 frame | every season and stage |
| 1 column, 4 rows | one picture per season (spring, summer, autumn, winter) |
| 3 columns | young, half grown and grown, the same all year |
| any rows × columns | rows spread over the year, columns spread over growth |

Keep each frame the size given in `sprites.js`, or change `w` and `h` there to match yours.

## Animal sheets

- **Row 1 is the animal moving** (walking, swimming, flying), **row 2 standing still.** A sheet with one row uses it for both.
- Frames run left to right through one loop of the animal's stride or wingbeat. The game plays the loop at a speed set by
  `omega` in `sprites.js` (radians per second: one loop takes 2π/omega seconds), whatever the number of frames.
- Animals face **right**; the game mirrors them when they walk left.

## Home sheets

The warrens, dens, nests and wallows drawn on an animal's home tile.

- **Rows are the seasons**: spring, summer, autumn, winter (the thrush nest has eggs in spring). One row is used all year.
- **Columns are looks**: the heron's nest has two, high in a tree and out in the reeds. The others have one.
- The anchor is the spot on the ground (or the branch, for nests) where the home sits. Re-bake one with
  `npm run sprites -- home-fox`.

## Size and anchor

Each entry in `sprites.js` looks like this:

```js
"oak": {"file": "plants/oak.png", "w": 122, "h": 115, "ax": 61, "ay": 98, "scale": 3, ...}
```

- `w`, `h`: the size of one frame in pixels.
- `ax`, `ay`: the anchor, the pixel in each frame that sits on the centre of the tile (for plants) or under the
  animal's feet. Keep the trunk or feet on this point.
- `scale`: pixels per game unit. A tile is 64 units wide, so at scale 3 a tile is 192 pixels wide. Draw at a higher
  scale for sharper art and set the number here; the game shrinks it to fit.
- `stages`, `variants` (plants): the growth each column stands for, and how many looks there are per stage.
- `shadow` (plants): the ground shadow under each frame, drawn by the game so trees still cast shade when an animal walks
  behind them. It is only used while the sheet keeps the baked grid; delete it if your art brings its own shadow.

## Making and re-making sheets

You need Node.js and, once, `npx playwright install chromium` (or Google Chrome installed).

```
npm run sprites                bake sheets for any species that has none yet
npm run sprites -- oak fox     re-bake just these (overwrites their PNGs)
npm run sprites -- --force     re-bake everything (overwrites every PNG)
npm run sprites -- --scale=4   bake at 4 pixels per game unit
```

Sheets that already exist are never overwritten unless you name them or pass `--force`, so redrawn PNGs are safe.
Delete a PNG to go back to the code-drawn art for that species (until the next `npm run sprites` bakes it again).

After changing sprites, run `npm run sync` so the iPhone app picks them up.
