# Sprites

Every plant, animal and building in the game is drawn from a PNG sprite sheet in this folder, and the ground and
water can wear textures from it too. Change a PNG and the game draws the new picture, on the map and in the field guide. Sheets are made from the game's own drawing code by
`npm run sprites`, so they always start out looking exactly like the code-drawn art.

```
sprites/
  sprites.js        the list of sheets the game loads, with each sheet's frame size and anchor
  plants/<id>.png   one sheet per plant and plant level (oak.png, oak2.png, meadow3.png …)
  animals/<id>.png  one sheet per animal (fox.png, heron.png …)
  buildings/<look>.png  one sheet per building look (house-2-1-r3.png, tower-0-12.png …)
  textures/<surface>.png  optional ground and water textures you draw yourself (soil.png, water.png …)
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

## Building sheets

Each look of a building has its own sheet, named `<kind>-<colour>-<floors>` plus what else sets it apart:

- `tower-2-11.png`: a tower in colour scheme 2 (of 0–3), 11 floors high. Kinds without colour schemes skip the colour
  (`warehouse-2.png`, `farm-2.png`).
- `-spire` marks the one tall tower with a spire, `-rp` a garage, mast or flyover being reclaimed by nature.
- Houses and terraces add their roof colour, `-r0` to `-r3`, and houses without a fruit tree in the garden end in `-bare`.

The grid is small:

- **4 rows, one per season**: spring, summer, autumn, winter (snow on the roofs). One row is used all year.
- **Column 1 is the building, column 2 its night lights**: only the parts that glow after dark (lit windows, shop
  windows, lamps), on a transparent background. The game fades them in at dusk. Leave column 2 out and the building stays dark.

Buildings stand on the middle of their tile (the anchor), and the game adds a foundation under them on slopes.
Ivy, cracks from demolition and nests on reclaimed buildings are still drawn on top by the game. A city only loads the
sheets for the buildings it actually has.

## Ground and water textures

The ground and water take their shape from the terrain and their colour from what is happening on each tile (toxic
brown turning green, water clearing as reeds filter it), so they are not sprites. Instead you can give each surface a
texture that the game lays over every tile of it, bent to follow the slope:

- Draw a diamond the shape of one tile, twice as wide as it is high (for example 192 × 96 pixels), on a transparent
  background, and save it as `textures/<surface>.png`. Surfaces: `soil`, `garden`, `pave`, `road`, `runway`, `path`,
  `rubble`, `water`.
- Run `npm run sprites` to add it to `sprites.js`.
- `mode` in `sprites.js` says how it mixes with the tile's own colour. `overlay` (the default) keeps the colour and adds
  your light and dark detail, so draw it around mid grey. `multiply` only darkens. `normal` paints your texture as it is,
  so that surface no longer changes colour with the soil or the seasons.
- More rows spread over the year like plant rows (a snowy last row, say); more columns are looks picked at random per tile.

Without a texture a surface keeps its plain colour.

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
npm run sprites -- house       re-bake every look of one building kind
npm run sprites -- --force     re-bake everything (overwrites every PNG)
npm run sprites -- --scale=4   bake at 4 pixels per game unit
```

Sheets that already exist are never overwritten unless you name them or pass `--force`, so redrawn PNGs are safe.
Delete a PNG to go back to the code-drawn art for that species (until the next `npm run sprites` bakes it again).

After changing sprites, run `npm run sync` so the iPhone app picks them up.
