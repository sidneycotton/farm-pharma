/**
 * PROCEDURAL ART APPROACH
 * ------------------------
 * Every plant is defined by a single integer seed. From that seed we
 * derive a full "genome" object (branch angles, petal counts, color
 * palette, curvature, jitter, etc). The genome is generated ONCE per
 * plant and cached — growth stages don't re-roll randomness, they just
 * reveal more of the same structure. This is what makes clicking
 * "Grow" feel like the *same* plant maturing rather than a new random
 * plant appearing each time.
 *
 * Trees & vines: recursive L-system-style branching. Each branch node
 * recursively spawns children with seed-derived angle spread, length
 * decay, and thickness taper. Recursion depth is tied to growth stage,
 * so stage 1 might only recurse 2 levels deep, stage 6 recurses 6+.
 *
 * Flowers & succulents: parametric radial generators. A base shape
 * function (petal silhouette) is repeated around a center point with
 * per-plant jitter on angle, size, and color, and layered so later
 * stages add layers (bud -> inner ring -> outer ring -> full bloom).
 *
 * All output is SVG path/shape data, built as strings and injected
 * into the live <svg>. This keeps the whole thing dependency-free and
 * infinitely scalable/crisp at any size.
 */

// Stage count is no longer a global constant — each individual plant rolls
// its own number of growth stages (per-species range, see STAGE_RANGES) so
// two flowers of the same type can have completely different lifecycles:
// one might bloom in 3 steps, another might take 9. Code that used to read
// the STAGE_COUNT constant now reads genome.stageCount instead.
const STAGE_RANGES = {
  tree: [5, 9],       // can include flower + fruit stages
  flower: [3, 9],
  succulent: [3, 6],
  vine: [4, 8],
  cactus: [4, 7],
  mushroom: [3, 5],
};

// Generic stage name pools used to build a per-plant stage list. We always
// start at 'Seed' and end at a "fully grown" label, filling the middle with
// a species-appropriate progression trimmed/stretched to stageCount.
const STAGE_NAME_POOL = {
  tree: ['Seed', 'Sprout', 'Sapling', 'Young Tree', 'Growing', 'Budding', 'Flowering', 'Fruiting', 'Full Bloom'],
  flower: ['Seed', 'Sprout', 'Bud', 'Opening', 'Growing', 'Unfurling', 'Blooming', 'Peak Bloom', 'Full Bloom'],
  succulent: ['Seed', 'Sprout', 'Rosette Forming', 'Growing', 'Filling Out', 'Maturing', 'Full Bloom'],
  vine: ['Seed', 'Sprout', 'Climbing', 'Spreading', 'Growing', 'Flowering', 'Full Bloom'],
  cactus: ['Seed', 'Sprout', 'Sapling', 'Growing', 'Budding', 'Flowering', 'Full Bloom'],
  mushroom: ['Seed', 'Pinning', 'Sprout', 'Growing', 'Full Bloom'],
};

function buildStageNames(type, stageCount) {
  const pool = STAGE_NAME_POOL[type] || ['Seed', 'Sprout', 'Growing', 'Full Bloom'];
  if (stageCount >= pool.length) {
    // stretch: keep first, last, and evenly resample the middle (with repeats
    // collapsed) up to stageCount entries
    const names = [pool[0]];
    for (let i = 1; i < stageCount - 1; i++) {
      const t = i / (stageCount - 1);
      const idx = Math.min(pool.length - 2, Math.max(1, Math.round(t * (pool.length - 1))));
      names.push(pool[idx]);
    }
    names.push(pool[pool.length - 1]);
    return names;
  }
  // shrink: always keep first + last, evenly sample the rest
  const names = [pool[0]];
  for (let i = 1; i < stageCount - 1; i++) {
    const t = i / (stageCount - 1);
    const idx = Math.round(t * (pool.length - 1));
    names.push(pool[idx]);
  }
  names.push(pool[pool.length - 1]);
  return names;
}

const PLANT_TYPES = ['tree', 'flower', 'succulent', 'vine', 'cactus', 'mushroom'];

function pickPlantType(rng, requested) {
  if (requested && requested !== 'random') return requested;
  return rng.pick(PLANT_TYPES);
}

// ---------- Species / variant names ----------
// Each plant type has a small set of "species" (structural variants).
// Combined with a seed-derived procedural name, this gives every plant
// a coherent identity beyond just its raw random parameters.
const SPECIES = {
  tree: ['Oak', 'Willow', 'Maple', 'Birch', 'Cypress', 'Elder', 'Cherry', 'Apple', 'Fig'],
  flower: ['Rose', 'Daisy', 'Poppy', 'Orchid', 'Lily', 'Aster', 'Peony'],
  succulent: ['Echeveria', 'Haworthia', 'Sedum', 'Aloe', 'Crassula', 'Barrel Cactus Cousin', 'String-of-Pearls'],
  vine: ['Ivy', 'Clematis', 'Wisteria', 'Jasmine', 'Morning Glory'],
  cactus: ['Saguaro', 'Barrel', 'Prickly Pear', 'Fishhook', 'Pincushion'],
  mushroom: ['Toadstool', 'Bracket', 'Puffball', 'Chanterelle', 'Inkcap'],
};

// ---------- Structural species profiles ----------
// These give each species a genuinely different SHAPE, not just a different
// name/palette. Each profile nudges/overrides genome parameters so, e.g., a
// Daisy and an Orchid don't just differ in color — they differ in petal
// count, shape, layering, and how many growth stages they need to bloom.
const FLOWER_PROFILES = {
  Rose: { petalShapeOptions: ['round', 'ruffled'], petalCountRange: [18, 28], doubleRowChance: 0.85, petalLenRange: [22, 32], stageRange: [6, 9], curlRange: [0.1, 0.35] },
  Daisy: { petalShapeOptions: ['pointed'], petalCountRange: [13, 21], doubleRowChance: 0.05, petalLenRange: [40, 55], stageRange: [3, 4], curlRange: [-0.05, 0.05] },
  Poppy: { petalShapeOptions: ['round', 'ruffled'], petalCountRange: [4, 6], doubleRowChance: 0.1, petalLenRange: [45, 62], stageRange: [4, 5], curlRange: [-0.3, -0.1] },
  Orchid: { petalShapeOptions: ['pointed', 'ruffled'], petalCountRange: [5, 6], doubleRowChance: 0.5, petalLenRange: [30, 44], stageRange: [7, 9], curlRange: [0.15, 0.4] },
  Lily: { petalShapeOptions: ['pointed'], petalCountRange: [6, 8], doubleRowChance: 0.0, petalLenRange: [48, 60], stageRange: [5, 6], curlRange: [-0.25, -0.1] },
  Aster: { petalShapeOptions: ['pointed'], petalCountRange: [20, 32], doubleRowChance: 0.15, petalLenRange: [24, 34], stageRange: [3, 5], curlRange: [-0.05, 0.1] },
  Peony: { petalShapeOptions: ['ruffled', 'round'], petalCountRange: [22, 30], doubleRowChance: 0.95, petalLenRange: [26, 36], stageRange: [7, 9], curlRange: [0.2, 0.35] },
};

const SUCCULENT_PROFILES = {
  Echeveria: { form: 'rosette', rowsRange: [4, 6], perRowRange: [6, 9], pointyChance: 0.3, stageRange: [4, 6] },
  Haworthia: { form: 'rosette', rowsRange: [3, 4], perRowRange: [5, 7], pointyChance: 0.9, stageRange: [3, 4] },
  Sedum: { form: 'clumping', rowsRange: [3, 5], perRowRange: [7, 10], pointyChance: 0.4, stageRange: [4, 5] },
  Aloe: { form: 'upright', rowsRange: [4, 6], perRowRange: [4, 6], pointyChance: 1.0, stageRange: [5, 6] },
  Crassula: { form: 'stacked', rowsRange: [4, 7], perRowRange: [2, 4], pointyChance: 0.2, stageRange: [4, 6] },
  'Barrel Cactus Cousin': { form: 'rosette', rowsRange: [5, 7], perRowRange: [8, 11], pointyChance: 0.7, stageRange: [5, 6] },
  'String-of-Pearls': { form: 'trailing', rowsRange: [3, 5], perRowRange: [3, 5], pointyChance: 0.0, stageRange: [3, 5] },
};

const VINE_PROFILES = {
  Ivy: { segRange: [6, 9], leafEveryRange: [1, 1], flowerChanceRange: [0, 0.1], stageRange: [4, 6] },
  Clematis: { segRange: [5, 7], leafEveryRange: [1, 2], flowerChanceRange: [0.35, 0.6], stageRange: [5, 7] },
  Wisteria: { segRange: [6, 9], leafEveryRange: [1, 2], flowerChanceRange: [0.5, 0.8], stageRange: [6, 8] },
  Jasmine: { segRange: [5, 8], leafEveryRange: [1, 2], flowerChanceRange: [0.4, 0.65], stageRange: [4, 6] },
  'Morning Glory': { segRange: [4, 6], leafEveryRange: [1, 1], flowerChanceRange: [0.3, 0.55], stageRange: [4, 5] },
};

const CACTUS_PROFILES = {
  Saguaro: { armRange: [1, 4], bodyHRange: [90, 130], roundedTopChance: 0.15, stageRange: [6, 7] },
  Barrel: { armRange: [0, 0], bodyHRange: [35, 55], roundedTopChance: 0.95, stageRange: [4, 5] },
  'Prickly Pear': { armRange: [1, 3], bodyHRange: [55, 80], roundedTopChance: 0.5, stageRange: [4, 6] },
  Fishhook: { armRange: [0, 1], bodyHRange: [50, 75], roundedTopChance: 0.8, stageRange: [4, 5] },
  Pincushion: { armRange: [0, 0], bodyHRange: [25, 40], roundedTopChance: 1.0, stageRange: [3, 4] },
};

const MUSHROOM_PROFILES = {
  Toadstool: { clusterRange: [1, 2], capShapeOptions: ['dome'], spottedChance: 0.85, stageRange: [3, 4] },
  Bracket: { clusterRange: [1, 3], capShapeOptions: ['flat'], spottedChance: 0.1, stageRange: [3, 4] },
  Puffball: { clusterRange: [1, 3], capShapeOptions: ['dome'], spottedChance: 0.05, stageRange: [3, 4] },
  Chanterelle: { clusterRange: [2, 4], capShapeOptions: ['flat', 'conical'], spottedChance: 0.1, stageRange: [4, 5] },
  Inkcap: { clusterRange: [2, 4], capShapeOptions: ['conical'], spottedChance: 0.2, stageRange: [3, 5] },
};

const TREE_PROFILES = {
  Oak: { branchAngleRange: [26, 40], leafDensityRange: [0.6, 1], flowering: false, fruiting: false, stageRange: [5, 7] },
  Willow: { branchAngleRange: [18, 28], leafDensityRange: [0.7, 1], flowering: false, fruiting: false, stageRange: [5, 6] },
  Maple: { branchAngleRange: [28, 42], leafDensityRange: [0.55, 0.95], flowering: false, fruiting: false, stageRange: [5, 7] },
  Birch: { branchAngleRange: [24, 36], leafDensityRange: [0.5, 0.85], flowering: false, fruiting: false, stageRange: [5, 6] },
  Cypress: { branchAngleRange: [14, 22], leafDensityRange: [0.8, 1], flowering: false, fruiting: false, stageRange: [5, 6] },
  Elder: { branchAngleRange: [26, 38], leafDensityRange: [0.6, 0.9], flowering: true, fruiting: true, stageRange: [7, 9] },
  Cherry: { branchAngleRange: [24, 36], leafDensityRange: [0.55, 0.85], flowering: true, fruiting: true, stageRange: [7, 9] },
  Apple: { branchAngleRange: [26, 38], leafDensityRange: [0.6, 0.9], flowering: true, fruiting: true, stageRange: [7, 9] },
  Fig: { branchAngleRange: [22, 34], leafDensityRange: [0.65, 0.95], flowering: false, fruiting: true, stageRange: [6, 8] },
};

const NAME_PREFIX = [
  'Ember', 'Frost', 'Dusk', 'Dawn', 'Velvet', 'Amber', 'Silver', 'Copper',
  'Moon', 'Sun', 'Shadow', 'Coral', 'Misty', 'Golden', 'Crimson', 'Jade',
  'Wild', 'Quiet', 'Ancient', 'Feral', 'Gentle', 'Rustic', 'Hollow', 'Bright',
];
const NAME_SUFFIX = [
  'Whisper', 'Bloom', 'Drift', 'Song', 'Veil', 'Glow', 'Hollow', 'Bramble',
  'Fern', 'Petal', 'Thorn', 'Shade', 'Root', 'Bell', 'Wisp', 'Crown',
  'Ember', 'Dew', 'Haze', 'Spire', 'Nook', 'Charm', 'Flare', 'Murmur',
];

/** Deterministic, human-friendly procedural name from seed + type. */
function generatePlantName(seed, type) {
  const rng = new SeededRandom(seed + 7777);
  const speciesList = SPECIES[type] || ['Plant'];
  const species = rng.pick(speciesList);
  const prefix = rng.pick(NAME_PREFIX);
  const suffix = rng.pick(NAME_SUFFIX);
  return {
    species,
    fullName: `${species} "${prefix} ${suffix}"`,
  };
}

// ---------- Color palettes ----------
// Each plant picks a coherent palette rather than fully random RGB,
// so results stay visually pleasing.
const PALETTES = {
  tree: [
    { trunk: '#6b4423', leaf: ['#3f7d3f', '#5a9c5a', '#2f5f2f'] },
    { trunk: '#5c3a21', leaf: ['#e07a3f', '#c9542f', '#f4a259'] }, // autumn
    { trunk: '#4a3826', leaf: ['#7fb069', '#a3c586', '#4f7942'] },
    { trunk: '#3e2723', leaf: ['#d63447', '#f07167', '#e8543f'] }, // cherry blossom-ish
    { trunk: '#5a4a3a', leaf: ['#f7e26b', '#ffd23f', '#e8b93f'] }, // golden autumn
    { trunk: '#4a2f28', leaf: ['#9c5aa0', '#c07bc4', '#7a4080'] }, // lavender bloom
    { trunk: '#3a2a1e', leaf: ['#2f6b5f', '#4a9c8a', '#1f5248'] }, // deep evergreen
    { trunk: '#6b5a3f', leaf: ['#ffffff', '#f2eee6', '#e8dfd0'] }, // snow-laden
  ],
  flower: [
    { stem: '#3f7d3f', petal: ['#ff6b9d', '#ffb6c1', '#ff8fab'], center: '#ffd23f' },
    { stem: '#4a7c59', petal: ['#a06cd5', '#c8a2ff', '#7b4fbf'], center: '#ffec6b' },
    { stem: '#3f7d3f', petal: ['#ff9f1c', '#ffbf69', '#ff6b35'], center: '#8b3a00' },
    { stem: '#4a7c59', petal: ['#ffffff', '#f2f2f2', '#e8e8e8'], center: '#ffd23f' },
    { stem: '#3f7d3f', petal: ['#4ecdc4', '#88d9d1', '#2fb8ac'], center: '#ff6b6b' },
    { stem: '#4a7c59', petal: ['#e63946', '#f1727f', '#c1121f'], center: '#2b2b2b' }, // deep red
    { stem: '#3f7d3f', petal: ['#3a86ff', '#8ecae6', '#219ebc'], center: '#ffb703' }, // blue
    { stem: '#4a7c59', petal: ['#fb8500', '#ffb703', '#ff9f1c'], center: '#6a3f1a' }, // marigold
    { stem: '#3f7d3f', petal: ['#f7d6e0', '#f4a6c1', '#e88aa6'], center: '#6b4423' }, // blush pink
  ],
  succulent: [
    { body: ['#7fb069', '#a3c586', '#5c8a4f'], tip: '#d67ba8' },
    { body: ['#8bc4a1', '#b4dcc4', '#6ba385'], tip: '#e8a87c' },
    { body: ['#6a8f6b', '#94b895', '#4f7250'], tip: '#c96f9c' },
    { body: ['#8a9c6b', '#b5c48f', '#6f8050'], tip: '#e0c355' }, // olive/gold tip
    { body: ['#5c7a8a', '#8fa9b8', '#3f5c6b'], tip: '#e8846b' }, // blue-grey
    { body: ['#9c7f8a', '#c2a5b0', '#7a5f68'], tip: '#f2d06b' }, // dusty mauve
  ],
  vine: [
    { stem: '#4a7c3c', leaf: ['#5a9c4a', '#7fb069', '#3f7d3f'], flower: '#ff6b9d' },
    { stem: '#3f6b2f', leaf: ['#6b9c4a', '#8fbf5f', '#4f8a3a'], flower: '#a06cd5' },
    { stem: '#5a6b3a', leaf: ['#8a9c4a', '#a8bf5f', '#6b8030'], flower: '#ffb703' }, // olive/gold flower
    { stem: '#3f5a4a', leaf: ['#4a8a6b', '#6bb08a', '#2f6b4a'], flower: '#ffffff' }, // jasmine-white
    { stem: '#4a3a5a', leaf: ['#6b5a8a', '#8a7ab0', '#4a3a6b'], flower: '#e8846b' }, // purple wisteria
  ],
  cactus: [
    { body: ['#4f8a5c', '#6bab78', '#3a6b46'], spine: '#e8dfc0', flower: '#ff6b9d' },
    { body: ['#5c9c6a', '#7fbf8a', '#458a52'], spine: '#f2ead0', flower: '#ffd23f' },
    { body: ['#3f6b52', '#5c9078', '#2f5540'], spine: '#d8cfa8', flower: '#ff9f1c' },
    { body: ['#6b8a5c', '#8fac7a', '#4f6b40'], spine: '#e0d6b0', flower: '#c8a2ff' },
  ],
  mushroom: [
    { stem: '#e8dfc8', cap: ['#c1444a', '#e0656b', '#9c2f36'], spots: '#ffffff' }, // classic red toadstool
    { stem: '#dcd3ba', cap: ['#8a5a3a', '#b07f52', '#6b4423'], spots: '#f2e6c8' }, // earthy brown
    { stem: '#e0d8c4', cap: ['#d68f3f', '#e8ab5f', '#b06f28'], spots: '#fff2d8' }, // chanterelle orange
    { stem: '#d8dcc8', cap: ['#5c7a5c', '#7f9c7a', '#3f5c3f'], spots: '#e8f0d8' }, // mossy green
    { stem: '#e6d8e0', cap: ['#8a5a8a', '#ab7fac', '#6b3f6b'], spots: '#f4e6f0' }, // violet
  ],
};

// Wall materials the vine climbs, varied per-seed like everything else.
const WALL_PALETTES = {
  brick: [
    { block: '#9c6b52', line: '#7a4f3a' }, // classic red brick
    { block: '#8a7568', line: '#6b5648' }, // weathered grey-brown brick
    { block: '#a8846b', line: '#8a6650' }, // sun-bleached tan brick
    { block: '#7a4a42', line: '#5c352e' }, // dark clinker brick
  ],
  stone: [
    { block: '#9c948a', line: '#7a7268' }, // classic grey stone
    { block: '#a89c88', line: '#877a68' }, // sandstone
    { block: '#8a9088', line: '#6b726b' }, // mossy grey stone
    { block: '#b0a89c', line: '#8f867a' }, // pale limestone
  ],
};

// ---------- Genome generation ----------
function generateGenome(seed, type) {
  const rng = new SeededRandom(seed);
  const nameInfo = generatePlantName(seed, type);
  const species = nameInfo.species;

  // Pick a species-appropriate stage count so lifecycles genuinely vary:
  // a Daisy might bloom in 3 steps while a Peony takes 9, even though both
  // are "flowers". Falls back to the type-wide range if no profile exists.
  const profileRange = (profiles) => (profiles && profiles[species] && profiles[species].stageRange) || STAGE_RANGES[type];
  let stageRange;
  switch (type) {
    case 'flower': stageRange = profileRange(FLOWER_PROFILES); break;
    case 'succulent': stageRange = profileRange(SUCCULENT_PROFILES); break;
    case 'vine': stageRange = profileRange(VINE_PROFILES); break;
    case 'cactus': stageRange = profileRange(CACTUS_PROFILES); break;
    case 'mushroom': stageRange = profileRange(MUSHROOM_PROFILES); break;
    case 'tree': stageRange = profileRange(TREE_PROFILES); break;
    default: stageRange = STAGE_RANGES[type] || [4, 6];
  }
  const stageCount = rng.int(stageRange[0], stageRange[1]);
  const stageNames = buildStageNames(type, stageCount);

  const base = {
    type,
    seed,
    palette: rng.pick(PALETTES[type]),
    species,
    displayName: nameInfo.fullName,
    stageCount,
    stageNames,
  };

  if (type === 'tree') {
    const profile = TREE_PROFILES[species] || TREE_PROFILES.Oak;
    return Object.assign(base, {
      trunkLean: rng.range(-8, 8),
      branchAngle: rng.range(profile.branchAngleRange[0], profile.branchAngleRange[1]),
      angleJitter: rng.range(4, 14),
      lengthDecay: rng.range(0.68, 0.78),
      widthDecay: rng.range(0.62, 0.72),
      branchesPerNode: rng.int(2, 3),
      curviness: rng.range(-6, 6),
      leafDensity: rng.range(profile.leafDensityRange[0], profile.leafDensityRange[1]),
      leafSize: rng.range(6, 11),
      asymmetry: rng.range(-0.15, 0.15),
      flowering: profile.flowering,
      fruiting: profile.fruiting,
      flowerColor: rng.pick(['#ffb6c1', '#ffe0ec', '#ffffff', '#f4a6c1', '#ffd6e8']),
      fruitColor: rng.pick(['#c1272d', '#d9534f', '#e8843f', '#8b4a9c', '#e8c547']),
      fruitCount: rng.int(4, 10),
    });
  }

  if (type === 'flower') {
    const profile = FLOWER_PROFILES[species] || FLOWER_PROFILES.Daisy;
    return Object.assign(base, {
      petalCount: rng.int(profile.petalCountRange[0], profile.petalCountRange[1]),
      petalShape: rng.pick(profile.petalShapeOptions),
      petalLength: rng.range(profile.petalLenRange[0], profile.petalLenRange[1]),
      petalWidth: rng.range(14, 24),
      petalCurl: rng.range(profile.curlRange[0], profile.curlRange[1]),
      jitter: rng.range(0.02, 0.12),
      stemCurve: rng.range(-20, 20),
      stemHeight: rng.range(140, 200),
      leafPairs: rng.int(1, 3),
      doubleRow: rng.chance(profile.doubleRowChance),
    });
  }

  if (type === 'succulent') {
    const profile = SUCCULENT_PROFILES[species] || SUCCULENT_PROFILES.Echeveria;
    return Object.assign(base, {
      form: profile.form,
      leafRows: rng.int(profile.rowsRange[0], profile.rowsRange[1]),
      leavesPerRow: rng.int(profile.perRowRange[0], profile.perRowRange[1]),
      leafLength: rng.range(24, 46),
      leafWidth: rng.range(10, 18),
      pointy: rng.chance(profile.pointyChance),
      rowShrink: rng.range(0.72, 0.85),
      rotationOffset: rng.range(0, 360),
      tipColorChance: rng.range(0.3, 0.8),
    });
  }

  if (type === 'vine') {
    const profile = VINE_PROFILES[species] || VINE_PROFILES.Ivy;
    const wallStyle = rng.pick(['brick', 'stone']);
    return Object.assign(base, {
      curlTightness: rng.range(0.15, 0.4),
      segments: rng.int(profile.segRange[0], profile.segRange[1]),
      segmentLength: rng.range(28, 42),
      leafEvery: rng.int(profile.leafEveryRange[0], profile.leafEveryRange[1]),
      leafSize: rng.range(10, 18),
      flowerChance: rng.range(profile.flowerChanceRange[0], profile.flowerChanceRange[1]),
      direction: rng.sign(),
      waviness: rng.range(15, 35),
      wallHeight: rng.range(30, 55),
      wallWidth: rng.range(140, 210),
      wallStyle,
      wallColors: rng.pick(WALL_PALETTES[wallStyle]),
    });
  }

  if (type === 'cactus') {
    const profile = CACTUS_PROFILES[species] || CACTUS_PROFILES.Barrel;
    return Object.assign(base, {
      armCount: rng.int(profile.armRange[0], profile.armRange[1]),
      bodyWidth: rng.range(22, 34),
      bodyHeight: rng.range(profile.bodyHRange[0], profile.bodyHRange[1]),
      ribCount: rng.int(5, 9),
      spineChance: rng.range(0.5, 1),
      roundedTop: rng.chance(profile.roundedTopChance),
      flowerChance: rng.range(0.3, 0.7),
      armAsymmetry: rng.range(-0.2, 0.2),
    });
  }

  if (type === 'mushroom') {
    const profile = MUSHROOM_PROFILES[species] || MUSHROOM_PROFILES.Toadstool;
    return Object.assign(base, {
      clusterCount: rng.int(profile.clusterRange[0], profile.clusterRange[1]),
      capWidth: rng.range(24, 44),
      capHeight: rng.range(14, 26),
      stemHeight: rng.range(28, 52),
      stemWidth: rng.range(6, 11),
      spotted: rng.chance(profile.spottedChance),
      spotCount: rng.int(3, 8),
      capShape: rng.pick(profile.capShapeOptions),
      glowing: rng.chance(0.15),
    });
  }

  return base;
}

// ---------- SVG helpers ----------
function svgEl(tag, attrs) {
  let s = `<${tag} `;
  for (const k in attrs) s += `${k}="${attrs[k]}" `;
  return s + '/>';
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// ---------- TREE renderer (recursive branching, + optional flower/fruit) ----------
function renderTree(genome, stage) {
  const rng = new SeededRandom(genome.seed + 999); // secondary stream for leaf placement
  const lastStage = genome.stageCount - 1;
  const stageT = lastStage > 0 ? stage / lastStage : 1; // 0..1 progress through this plant's own lifecycle
  const maxDepth = Math.max(1, Math.round(stageT * 7));
  const growth = (stage + 1) / genome.stageCount; // 0..1 overall scale
  let svg = '';
  const leaves = [];

  const startX = 200;
  const startY = 460;
  const trunkLen = 70 * growth + 10;
  const trunkWidth = 14 * growth + 3;

  function branch(x, y, len, width, angle, depth) {
    if (depth > maxDepth || len < 4) {
      if (depth > 1 && genome.leafDensity > rng.next() * 1.1) {
        leaves.push({ x, y, size: genome.leafSize * (0.6 + growth * 0.4) });
      }
      return;
    }
    const wobble = genome.curviness * (depth / maxDepth);
    const endAngle = angle + wobble;
    const [ex, ey] = polar(x, y, len, endAngle);

    const midCtrlAngle = angle + wobble * 0.5;
    const [cx, cy] = polar(x, y, len * 0.5, midCtrlAngle);

    svg += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" 
      stroke="${genome.palette.trunk}" stroke-width="${Math.max(width, 1).toFixed(1)}" 
      fill="none" stroke-linecap="round" />`;

    if (depth === maxDepth || len < 10) {
      if (genome.leafDensity > rng.next() * 0.9) {
        leaves.push({ x: ex, y: ey, size: genome.leafSize * (0.6 + growth * 0.4) });
      }
    }

    if (depth < maxDepth) {
      const nBranches = genome.branchesPerNode + (rng.chance(0.3) ? 1 : 0);
      for (let i = 0; i < nBranches; i++) {
        const spread = genome.branchAngle + rng.range(-genome.angleJitter, genome.angleJitter);
        const dir = i % 2 === 0 ? 1 : -1;
        const asymShift = genome.asymmetry * 30;
        const childAngle = endAngle + dir * spread + asymShift;
        const childLen = len * genome.lengthDecay * rng.range(0.85, 1.05);
        const childWidth = width * genome.widthDecay;
        branch(ex, ey, childLen, childWidth, childAngle, depth + 1);
      }
    }
  }

  branch(startX, startY, trunkLen, trunkWidth, genome.trunkLean, 1);

  // ground
  svg = `<ellipse cx="200" cy="465" rx="50" ry="8" fill="#5c4a3a" opacity="0.4"/>` + svg;

  // leaves (drawn after branches so they sit on top)
  let leafSvg = '';
  for (const l of leaves) {
    const color = rng.pick(genome.palette.leaf);
    const r = l.size;
    leafSvg += `<circle cx="${l.x.toFixed(1)}" cy="${l.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.88"/>`;
  }

  const leavesOut = stageT >= 0.3; // roughly "past sapling" regardless of total stage count

  // Flowering & fruiting species get extra life stages layered on top of the
  // leaf canopy near the end of their lifecycle: blossoms appear first
  // (flowering window), then fade into fruit (fruiting window) as the plant
  // finishes growing. Both are entirely optional per-species (see
  // TREE_PROFILES) so only some trees ever show them.
  let blossomSvg = '';
  let fruitSvg = '';
  if (leavesOut && (genome.flowering || genome.fruiting)) {
    const flowerRng = new SeededRandom(genome.seed + 2468);
    const floweringWindow = genome.flowering && stageT >= 0.55 && stageT < 0.85;
    const fruitingWindow = genome.fruiting && stageT >= 0.8;

    if (floweringWindow) {
      for (const l of leaves) {
        if (!flowerRng.chance(0.35)) continue;
        const [fx, fy] = [l.x + flowerRng.range(-4, 4), l.y + flowerRng.range(-4, 4)];
        const petals = 5;
        for (let p = 0; p < petals; p++) {
          const a = (360 / petals) * p;
          const [px, py] = polar(fx, fy, 4.5, a);
          blossomSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="${genome.flowerColor}" opacity="0.95"/>`;
        }
        blossomSvg += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="1.6" fill="#ffd23f"/>`;
      }
    }

    if (fruitingWindow) {
      const fruitProgress = Math.min((stageT - 0.8) / 0.2, 1);
      const fruitLeaves = leaves.filter(() => flowerRng.chance(0.25));
      const activeFruit = Math.max(1, Math.round(genome.fruitCount * fruitProgress * (fruitLeaves.length / Math.max(1, genome.fruitCount))));
      fruitLeaves.slice(0, genome.fruitCount).forEach((l) => {
        const fr = 4 + fruitProgress * 3.5;
        fruitSvg += `<circle cx="${(l.x).toFixed(1)}" cy="${(l.y + 3).toFixed(1)}" r="${fr.toFixed(1)}" fill="${genome.fruitColor}" opacity="0.95"/>`;
      });
    }
  }

  return `<g>${svg}${leavesOut ? leafSvg : ''}${blossomSvg}${fruitSvg}</g>`;
}

// ---------- FLOWER renderer (parametric petals) ----------
function petalPath(cx, cy, angle, length, width, shape, curl) {
  const tipLen = length;
  const [tipX, tipY] = polar(cx, cy, tipLen, angle);
  const leftBase = polar(cx, cy, width * 0.3, angle - 90);
  const rightBase = polar(cx, cy, width * 0.3, angle + 90);

  const ctrlLen = tipLen * (0.55 + curl);
  const [lx, ly] = polar(cx, cy, ctrlLen, angle - width);
  const [rx, ry] = polar(cx, cy, ctrlLen, angle + width);

  if (shape === 'pointed') {
    return `M ${leftBase[0].toFixed(1)} ${leftBase[1].toFixed(1)} 
      Q ${lx.toFixed(1)} ${ly.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}
      Q ${rx.toFixed(1)} ${ry.toFixed(1)} ${rightBase[0].toFixed(1)} ${rightBase[1].toFixed(1)} Z`;
  }
  // round / ruffled use same base curve, ruffled adds a mid-wobble via extra control
  return `M ${leftBase[0].toFixed(1)} ${leftBase[1].toFixed(1)} 
    Q ${lx.toFixed(1)} ${ly.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}
    Q ${rx.toFixed(1)} ${ry.toFixed(1)} ${rightBase[0].toFixed(1)} ${rightBase[1].toFixed(1)} Z`;
}

function renderFlower(genome, stage) {
  const rng = new SeededRandom(genome.seed + 555);
  const growth = (stage + 1) / genome.stageCount;
  const baseX = 200, groundY = 470;
  const stemH = genome.stemHeight * Math.min(growth * 1.3, 1);
  const topY = groundY - stemH;
  const midX = baseX + genome.stemCurve * 0.5;

  let svg = `<ellipse cx="${baseX}" cy="${groundY + 4}" rx="40" ry="7" fill="#5c4a3a" opacity="0.35"/>`;

  // stem
  svg += `<path d="M ${baseX} ${groundY} Q ${midX.toFixed(1)} ${(groundY - stemH * 0.5).toFixed(1)} ${(baseX + genome.stemCurve).toFixed(1)} ${topY.toFixed(1)}"
    stroke="${genome.palette.stem}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

  // leaves along stem
  if (stage >= 1) {
    for (let i = 0; i < genome.leafPairs; i++) {
      const t = (i + 1) / (genome.leafPairs + 1);
      const ly = groundY - stemH * t;
      const lx = baseX + genome.stemCurve * t;
      const size = 16 + rng.range(-3, 3);
      svg += `<ellipse cx="${(lx - 14).toFixed(1)}" cy="${ly.toFixed(1)}" rx="${size}" ry="${size * 0.4}" fill="${genome.palette.stem}" transform="rotate(-25 ${(lx-14).toFixed(1)} ${ly.toFixed(1)})" opacity="0.9"/>`;
      svg += `<ellipse cx="${(lx + 14).toFixed(1)}" cy="${ly.toFixed(1)}" rx="${size}" ry="${size * 0.4}" fill="${genome.palette.stem}" transform="rotate(25 ${(lx+14).toFixed(1)} ${ly.toFixed(1)})" opacity="0.9"/>`;
    }
  }

  const flowerX = baseX + genome.stemCurve;
  const flowerY = topY;

  if (stage === 0) {
    // just a seed in the dirt
    return `<g>${svg}<circle cx="${baseX}" cy="${groundY - 2}" r="5" fill="#4a3826"/></g>`;
  }

  // Bud stage only exists as its own beat if there's room for it — a
  // 3-stage flower (seed -> petals -> full bloom) skips straight past it,
  // while a 9-stage flower gets a lingering, distinct bud phase.
  const budStage = genome.stageCount >= 4 ? 1 : -1;
  if (stage === budStage) {
    svg += `<ellipse cx="${flowerX.toFixed(1)}" cy="${flowerY.toFixed(1)}" rx="9" ry="13" fill="${rng.pick(genome.palette.petal)}"/>`;
    return `<g>${svg}</g>`;
  }

  // Petals unfold gradually across the remaining stages (from just after
  // the bud through to full bloom), so long-lived species reveal them a
  // few at a time while short-lived species jump straight to most of them.
  const petalStartStage = budStage >= 0 ? budStage + 1 : 1;
  const petalEndStage = genome.stageCount - 1;
  const petalT = petalEndStage > petalStartStage
    ? Math.min(Math.max((stage - petalStartStage) / (petalEndStage - petalStartStage), 0), 1)
    : 1;
  const visiblePetals = Math.max(1, Math.round(genome.petalCount * petalT));
  const petalLen = genome.petalLength * growth;
  const petalWidth = 18 + genome.petalWidth * 0.4;

  let petalsSvg = '';
  for (let i = 0; i < visiblePetals; i++) {
    const angle = (360 / genome.petalCount) * i + rng.range(-genome.jitter * 40, genome.jitter * 40);
    const color = rng.pick(genome.palette.petal);
    const len = petalLen * rng.range(0.92, 1.08);
    petalsSvg += `<path d="${petalPath(flowerX, flowerY, angle, len, petalWidth, genome.petalShape, genome.petalCurl)}" fill="${color}" opacity="0.95" stroke="${color}" stroke-width="1"/>`;
  }

  // second inner row for double flowers, only once mostly grown (last 2 stages)
  if (genome.doubleRow && stage >= genome.stageCount - 2) {
    for (let i = 0; i < Math.round(genome.petalCount * 0.7); i++) {
      const angle = (360 / (genome.petalCount * 0.7)) * i + 20;
      const color = rng.pick(genome.palette.petal);
      const len = petalLen * 0.6;
      petalsSvg += `<path d="${petalPath(flowerX, flowerY, angle, len, petalWidth * 0.7, genome.petalShape, genome.petalCurl)}" fill="${color}" opacity="0.9"/>`;
    }
  }

  svg += petalsSvg;
  svg += `<circle cx="${flowerX.toFixed(1)}" cy="${flowerY.toFixed(1)}" r="${8 * growth + 4}" fill="${genome.palette.center}"/>`;

  return `<g>${svg}</g>`;
}

// ---------- SUCCULENT renderer (radial rosette layers) ----------
function renderSucculent(genome, stage) {
  const rng = new SeededRandom(genome.seed + 333);
  const growth = (stage + 1) / genome.stageCount;
  const cx = 200, cy = 420;

  let svg = `<ellipse cx="${cx}" cy="${cy + 30}" rx="55" ry="10" fill="#7a5c3e" opacity="0.5"/>`;
  svg += `<ellipse cx="${cx}" cy="${cy + 20}" rx="60" ry="14" fill="#8b6b47"/>`;

  const activeRows = Math.max(1, Math.round(genome.leafRows * growth));

  for (let row = activeRows - 1; row >= 0; row--) {
    const rowScale = Math.pow(genome.rowShrink, row);
    const leafLen = genome.leafLength * rowScale * growth;
    const leafWidth = genome.leafWidth * rowScale;
    const count = genome.leavesPerRow - Math.floor(row * 0.6);
    const rowOffset = genome.rotationOffset + row * 25;
    const layerY = cy - row * 4;

    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i + rowOffset;
      const color = rng.pick(genome.palette.body);
      const [tx, ty] = polar(cx, layerY, leafLen, angle);
      const leftB = polar(cx, layerY, leafWidth * 0.3, angle - 90);
      const rightB = polar(cx, layerY, leafWidth * 0.3, angle + 90);
      const tipShape = genome.pointy
        ? `M ${leftB[0].toFixed(1)} ${leftB[1].toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${rightB[0].toFixed(1)} ${rightB[1].toFixed(1)} Z`
        : `M ${leftB[0].toFixed(1)} ${leftB[1].toFixed(1)} Q ${tx.toFixed(1)} ${ty.toFixed(1)} ${rightB[0].toFixed(1)} ${rightB[1].toFixed(1)} Q ${cx} ${layerY} ${leftB[0].toFixed(1)} ${leftB[1].toFixed(1)} Z`;

      const useTip = rng.chance(genome.tipColorChance) && row === activeRows - 1;
      svg += `<path d="${tipShape}" fill="${useTip ? genome.palette.tip : color}" opacity="0.95" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>`;
    }
  }

  return `<g>${svg}</g>`;
}

// ---------- VINE renderer (climbing a low wall that rises as the plant grows) ----------
function renderWall(genome, stage) {
  // The wall itself grows alongside the vine: it starts as a low, freshly-laid
  // course and rises to its full seed-defined height by full bloom, so the
  // whole scene reads as "being built" rather than a static prop.
  const growth = (stage + 1) / genome.stageCount;
  const minHeight = Math.min(14, genome.wallHeight * 0.35);
  const wallHeightNow = minHeight + (genome.wallHeight - minHeight) * growth;
  const wallWidthNow = Math.max(60, genome.wallWidth * Math.min(growth * 1.6, 1));

  const wallTop = 471 - wallHeightNow;
  const wallBottom = 472;
  const left = 200 - wallWidthNow / 2;
  const right = 200 + wallWidthNow / 2;
  const colors = genome.wallColors;

  let svg = `<ellipse cx="200" cy="${wallBottom + 4}" rx="${(wallWidthNow * 0.56).toFixed(1)}" ry="7" fill="#3a2f26" opacity="0.35"/>`;
  svg += `<rect x="${left.toFixed(1)}" y="${wallTop.toFixed(1)}" width="${wallWidthNow.toFixed(1)}" height="${(wallBottom - wallTop).toFixed(1)}" fill="${colors.block}" stroke="${colors.line}" stroke-width="1.5"/>`;

  if (genome.wallStyle === 'brick') {
    const rows = Math.max(1, Math.round(wallHeightNow / 12));
    for (let r = 0; r < rows; r++) {
      const ry = wallTop + r * 12;
      const offset = r % 2 === 0 ? 0 : 15;
      svg += `<line x1="${left.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${right.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="${colors.line}" stroke-width="1"/>`;
      for (let bx = left + offset; bx < right; bx += 30) {
        svg += `<line x1="${bx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(ry + 12).toFixed(1)}" stroke="${colors.line}" stroke-width="1"/>`;
      }
    }
  } else {
    // rough stone blocks — re-rolled from the same seed each call so the
    // pattern stays identical as the wall grows, it just reveals more rows.
    const rng = new SeededRandom(genome.seed + 222);
    const rows = Math.max(1, Math.round(wallHeightNow / 14));
    for (let r = 0; r < rows; r++) {
      let bx = left;
      const ry = wallTop + r * 14;
      while (bx < right) {
        const bw = 20 + rng.range(0, 20);
        svg += `<rect x="${bx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.min(bw, right - bx).toFixed(1)}" height="13" fill="none" stroke="${colors.line}" stroke-width="1"/>`;
        bx += bw + 2;
      }
    }
  }
  return { svg, wallTop };
}

function renderVine(genome, stage) {
  const rng = new SeededRandom(genome.seed + 111);
  const growth = (stage + 1) / genome.stageCount;
  const activeSegments = Math.max(1, Math.round(genome.segments * growth));

  const { svg: wallSvg, wallTop } = renderWall(genome, stage);

  // Vine starts at the base of the wall and climbs upward along its face,
  // then spills over the top once it's tall enough to reach it.
  let x = 190 + rng.range(-10, 10);
  let y = 471;
  let angle = 0; // straight up (polar() treats 0deg as "up")
  let svg = wallSvg;
  let path = `M ${x.toFixed(1)} ${y.toFixed(1)} `;
  const decorations = [];

  for (let i = 0; i < activeSegments; i++) {
    const climbing = y > wallTop + 10; // still on the wall face
    const sway = genome.direction * genome.waviness * 0.5 * Math.sin(i * genome.curlTightness * 4) + rng.range(-6, 6);
    // While climbing, bias strongly upward with gentle sway; once past the
    // top of the wall, allow it to curl outward more freely like real vine growth.
    angle = climbing ? (sway * 0.6) : (angle + sway);
    const len = genome.segmentLength;
    const [nx, ny] = polar(x, y, len, angle);
    const [ctrlX, ctrlY] = polar(x, y, len * 0.5, angle + genome.direction * 20);
    path += `Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)} `;

    if (i % genome.leafEvery === 0) {
      decorations.push({ x: nx, y: ny, angle, type: 'leaf' });
    }
    if (rng.chance(genome.flowerChance) && i > 1) {
      decorations.push({ x: nx, y: ny, angle, type: 'flower' });
    }
    x = nx; y = ny;
  }

  svg += `<path d="${path}" stroke="${genome.palette.stem}" stroke-width="4" fill="none" stroke-linecap="round"/>`;

  for (const d of decorations) {
    if (d.type === 'leaf') {
      const color = rng.pick(genome.palette.leaf);
      svg += `<ellipse cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" rx="${genome.leafSize}" ry="${genome.leafSize * 0.55}" fill="${color}" transform="rotate(${d.angle.toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)})" opacity="0.9"/>`;
    } else if (stage >= Math.max(1, Math.round(genome.stageCount * 0.5))) {
      svg += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="6" fill="${genome.palette.flower}"/>`;
    }
  }

  return `<g>${svg}</g>`;
}

// ---------- CACTUS renderer (ribbed body with optional arms) ----------
function cactusLobe(cx, topY, botY, width, ribCount, roundedTop) {
  const halfW = width / 2;
  let d = `M ${(cx - halfW).toFixed(1)} ${botY.toFixed(1)} `;
  d += `L ${(cx - halfW).toFixed(1)} ${(topY + halfW).toFixed(1)} `;
  if (roundedTop) {
    d += `Q ${(cx - halfW).toFixed(1)} ${topY.toFixed(1)} ${cx.toFixed(1)} ${topY.toFixed(1)} `;
    d += `Q ${(cx + halfW).toFixed(1)} ${topY.toFixed(1)} ${(cx + halfW).toFixed(1)} ${(topY + halfW).toFixed(1)} `;
  } else {
    d += `L ${(cx + halfW).toFixed(1)} ${(topY + halfW).toFixed(1)} `;
  }
  d += `L ${(cx + halfW).toFixed(1)} ${botY.toFixed(1)} Z`;
  let ribs = '';
  for (let i = 1; i < ribCount; i++) {
    const rx = cx - halfW + (width / ribCount) * i;
    ribs += `<line x1="${rx.toFixed(1)}" y1="${(topY + halfW * 0.3).toFixed(1)}" x2="${rx.toFixed(1)}" y2="${botY.toFixed(1)}" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>`;
  }
  return { body: d, ribs };
}

function renderCactus(genome, stage) {
  const rng = new SeededRandom(genome.seed + 444);
  const growth = (stage + 1) / genome.stageCount;
  const cx = 200, groundY = 470;
  let svg = `<ellipse cx="${cx}" cy="${groundY + 5}" rx="45" ry="9" fill="#c9a86b" opacity="0.5"/>`;
  svg += `<ellipse cx="${cx}" cy="${groundY - 2}" rx="55" ry="12" fill="#d9be8a"/>`;

  const bodyH = genome.bodyHeight * growth;
  const bodyW = genome.bodyWidth;
  const topY = groundY - bodyH;
  const mainColor = rng.pick(genome.palette.body);

  const { body, ribs } = cactusLobe(cx, topY, groundY, bodyW, genome.ribCount, genome.roundedTop);
  svg += `<path d="${body}" fill="${mainColor}"/>${ribs}`;

  // arms grow in once the plant is past early sapling stage
  const activeArms = stage >= Math.max(1, Math.round(genome.stageCount * 0.35)) ? genome.armCount : 0;
  for (let i = 0; i < activeArms; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const armY = topY + bodyH * (0.3 + i * 0.18);
    const armLen = bodyH * (0.28 + genome.armAsymmetry * side);
    const armW = bodyW * 0.6;
    const armX = cx + side * bodyW * 0.5;
    const elbowY = armY - armLen * 0.5;
    const armColor = rng.pick(genome.palette.body);
    svg += `<path d="M ${(armX - armW * 0.3 * side).toFixed(1)} ${armY.toFixed(1)}
      Q ${(armX + side * armW * 0.9).toFixed(1)} ${armY.toFixed(1)} ${(armX + side * armW * 0.9).toFixed(1)} ${elbowY.toFixed(1)}
      L ${(armX + side * armW * 0.9).toFixed(1)} ${(armY - armLen).toFixed(1)}
      Q ${(armX + side * armW * 0.9).toFixed(1)} ${(armY - armLen - armW * 0.5).toFixed(1)} ${armX.toFixed(1)} ${(armY - armLen - armW * 0.5).toFixed(1)}
      L ${(armX - side * armW * 0.1).toFixed(1)} ${(armY - armLen).toFixed(1)}
      Z" fill="${armColor}"/>`;
  }

  // spines
  if (stage >= 1) {
    const spineRows = Math.round(6 * growth) + 2;
    for (let r = 0; r < spineRows; r++) {
      const sy = topY + (bodyH / spineRows) * r + 8;
      for (let s = 0; s < genome.ribCount; s++) {
        if (!rng.chance(genome.spineChance)) continue;
        const sx = cx - bodyW / 2 + (bodyW / genome.ribCount) * s;
        svg += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${(sx + 2.5).toFixed(1)}" y2="${(sy - 3.5).toFixed(1)}" stroke="${genome.palette.spine}" stroke-width="1"/>`;
      }
    }
  }

  // bloom on top once mature
  if (stage >= genome.stageCount - 2 && rng.chance(genome.flowerChance)) {
    svg += `<circle cx="${cx}" cy="${(topY - 2).toFixed(1)}" r="7" fill="${genome.palette.flower}"/>`;
    for (let p = 0; p < 6; p++) {
      const a = (360 / 6) * p;
      const [px, py] = polar(cx, topY - 2, 9, a);
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${genome.palette.flower}"/>`;
    }
  }

  return `<g>${svg}</g>`;
}

// ---------- MUSHROOM renderer (clustered caps with optional spots/glow) ----------
function mushroomCapPath(cx, capY, width, height, shape) {
  const halfW = width / 2;
  if (shape === 'conical') {
    return `M ${(cx - halfW).toFixed(1)} ${(capY + height * 0.9).toFixed(1)}
      Q ${(cx - halfW * 0.3).toFixed(1)} ${capY.toFixed(1)} ${cx.toFixed(1)} ${(capY - height * 0.15).toFixed(1)}
      Q ${(cx + halfW * 0.3).toFixed(1)} ${capY.toFixed(1)} ${(cx + halfW).toFixed(1)} ${(capY + height * 0.9).toFixed(1)}
      Q ${cx.toFixed(1)} ${(capY + height * 0.6).toFixed(1)} ${(cx - halfW).toFixed(1)} ${(capY + height * 0.9).toFixed(1)} Z`;
  }
  if (shape === 'flat') {
    return `M ${(cx - halfW).toFixed(1)} ${(capY + height * 0.7).toFixed(1)}
      Q ${cx.toFixed(1)} ${(capY - height * 0.2).toFixed(1)} ${(cx + halfW).toFixed(1)} ${(capY + height * 0.7).toFixed(1)}
      Q ${cx.toFixed(1)} ${(capY + height).toFixed(1)} ${(cx - halfW).toFixed(1)} ${(capY + height * 0.7).toFixed(1)} Z`;
  }
  // dome
  return `M ${(cx - halfW).toFixed(1)} ${(capY + height).toFixed(1)}
    Q ${(cx - halfW).toFixed(1)} ${(capY - height * 0.3).toFixed(1)} ${cx.toFixed(1)} ${(capY - height * 0.4).toFixed(1)}
    Q ${(cx + halfW).toFixed(1)} ${(capY - height * 0.3).toFixed(1)} ${(cx + halfW).toFixed(1)} ${(capY + height).toFixed(1)}
    Q ${cx.toFixed(1)} ${(capY + height * 0.75).toFixed(1)} ${(cx - halfW).toFixed(1)} ${(capY + height).toFixed(1)} Z`;
}

function renderMushroom(genome, stage) {
  const rng = new SeededRandom(genome.seed + 666);
  const growth = (stage + 1) / genome.stageCount;
  const groundY = 465;
  let svg = `<ellipse cx="200" cy="${groundY + 6}" rx="60" ry="10" fill="#4a3826" opacity="0.4"/>`;

  const clusterFillStages = Math.max(1, Math.round(genome.stageCount * 0.5));
  const activeCount = Math.max(1, Math.round(genome.clusterCount * Math.min((stage + 1) / clusterFillStages, 1)));
  const positions = [];
  for (let i = 0; i < genome.clusterCount; i++) {
    const angle = (360 / genome.clusterCount) * i + rng.range(-15, 15);
    const dist = i === 0 ? 0 : rng.range(20, 40);
    const [px, py] = polar(200, groundY, dist, angle);
    positions.push({ x: px, y: py, scale: rng.range(0.7, 1.1) });
  }

  for (let i = 0; i < activeCount; i++) {
    const pos = positions[i];
    const scale = pos.scale * growth;
    const stemH = genome.stemHeight * scale;
    const stemW = genome.stemWidth * (0.5 + growth * 0.5);
    const capW = genome.capWidth * scale;
    const capH = genome.capHeight * scale;
    const capY = pos.y - stemH;
    const capColor = rng.pick(genome.palette.cap);

    svg += `<rect x="${(pos.x - stemW / 2).toFixed(1)}" y="${capY.toFixed(1)}" width="${stemW.toFixed(1)}" height="${stemH.toFixed(1)}" rx="${(stemW / 2).toFixed(1)}" fill="${genome.palette.stem}"/>`;

    if (genome.glowing) {
      svg += `<ellipse cx="${pos.x.toFixed(1)}" cy="${capY.toFixed(1)}" rx="${(capW * 0.9).toFixed(1)}" ry="${(capH * 1.4).toFixed(1)}" fill="${capColor}" opacity="0.25"/>`;
    }

    svg += `<path d="${mushroomCapPath(pos.x, capY, capW, capH, genome.capShape)}" fill="${capColor}"/>`;

    if (genome.spotted && stage >= Math.max(1, Math.round(genome.stageCount * 0.35))) {
      for (let s = 0; s < genome.spotCount; s++) {
        const sx = pos.x + rng.range(-capW * 0.35, capW * 0.35);
        const sy = capY + rng.range(-capH * 0.1, capH * 0.4);
        svg += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(2 + growth * 1.5).toFixed(1)}" fill="${genome.palette.spots}" opacity="0.9"/>`;
      }
    }
  }

  return `<g>${svg}</g>`;
}

// ---------- Dispatcher ----------
function renderPlant(genome, stage) {
  switch (genome.type) {
    case 'tree': return renderTree(genome, stage);
    case 'flower': return renderFlower(genome, stage);
    case 'succulent': return renderSucculent(genome, stage);
    case 'vine': return renderVine(genome, stage);
    case 'cactus': return renderCactus(genome, stage);
    case 'mushroom': return renderMushroom(genome, stage);
    default: return '';
  }
}
