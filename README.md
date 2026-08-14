# 🌱 Procedural Garden

A dependency-free procedural plant generator. Click **Grow** to advance a plant through
6 life stages (Seed → Sprout → Sapling → Growing → Maturing → Full Bloom). Every plant
is unique, generated from a random integer seed. Once a plant reaches full bloom, click
**Plant Next** to start a new one — full-grown plants are saved permanently to your
garden gallery (stored in browser `localStorage`).

## How the procedural art works

Everything is built as raw SVG, generated in JavaScript — no images, no canvas, no
external libraries.

1. **Seed → Genome**: each plant gets one random integer seed. That seed feeds a
   seeded PRNG (`mulberry32`) which deterministically generates a "genome" object:
   branch angles, petal counts, color palette, curl amounts, jitter, etc. This genome
   is generated once and cached — clicking Grow never re-rolls randomness, it just
   reveals more of the *same* structure, so the plant feels like it's maturing rather
   than randomly changing.

2. **Trees & Vines** use recursive L-system-style branching: a `branch()` function
   recursively draws a segment, then spawns 2-3 child branches at seed-derived angles,
   shrinking length/width each recursion. Growth stage controls max recursion depth,
   so young trees are simple forks and mature trees are dense and leafy. Each tree
   species also carries a `canopy` shape (round, conical, weeping, vase, umbrella,
   spreading) that biases branch angle by height, plus a `droop` factor (e.g. Willow)
   and a per-species `leafShape` glyph (circle, oval, star/palmate, needle-cluster) —
   so an Oak and a Cypress are structurally different silhouettes, not just recolored
   copies of the same tree. Vines climb freely with no backing wall: they spiral
   upward from a small root mound and cascade outward once they run out of height.

3. **Flowers & Succulents** use parametric radial generation: a petal/leaf shape
   function is repeated around a center point at even angular spacing plus jitter,
   with per-stage layering (bud → single ring → double ring → full bloom). Petal
   shape genuinely differs by species now: `pointed` (Daisy/Lily), `round` (smooth
   plump curve), and `ruffled` (Rose/Peony — extra wobble control points crinkle
   the outline) each produce a distinct silhouette, not just a recolored petal.

4. **Mushrooms** occasionally roll "giant" (~12% chance): a single towering,
   often-glowing specimen scaled 3–4.5x instead of the usual small cluster.

4. **Colors** are drawn from small hand-picked palettes per plant type (rather than
   fully random RGB) so results stay visually coherent while still varying a lot.

5. Because a plant is fully defined by `(seed, type)`, the garden gallery doesn't
   store images — it just stores the seed and re-renders the SVG on load. This keeps
   storage tiny and every saved plant perfectly reproducible.

## Running it

No build step. Just open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000
```

## Deploying to GitHub Pages

1. Push this folder's contents to a GitHub repo.
2. Go to **Settings → Pages**, set source to your main branch (root).
3. Visit the published URL.

## Files

- `index.html` — page structure
- `style.css` — visual styling
- `rng.js` — seeded PRNG
- `plants.js` — procedural generation + SVG rendering for all plant types
- `app.js` — growth state machine + garden persistence (localStorage)
