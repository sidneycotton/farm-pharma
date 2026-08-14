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

const STAGE_COUNT = 6; // 0 = seed, 5 = fully grown

const STAGE_NAMES = [
  'Seed',
  'Sprout',
  'Sapling',
  'Growing',
  'Maturing',
  'Full Bloom'
];

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
  tree: ['Oak', 'Willow', 'Maple', 'Birch', 'Cypress', 'Elder'],
  flower: ['Rose', 'Daisy', 'Poppy', 'Orchid', 'Lily', 'Aster', 'Peony'],
  succulent: ['Echeveria', 'Haworthia', 'Sedum', 'Aloe', 'Crassula'],
  vine: ['Ivy', 'Clematis', 'Wisteria', 'Jasmine', 'Morning Glory'],
  cactus: ['Saguaro', 'Barrel', 'Prickly Pear', 'Fishhook', 'Pincushion'],
  mushroom: ['Toadstool', 'Bracket', 'Puffball', 'Chanterelle', 'Inkcap'],
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

// ---------- Genome generation ----------
function generateGenome(seed, type) {
  const rng = new SeededRandom(seed);
  const nameInfo = generatePlantName(seed, type);
  const base = {
    type,
    seed,
    palette: rng.pick(PALETTES[type]),
    species: nameInfo.species,
    displayName: nameInfo.fullName,
  };

  if (type === 'tree') {
    return Object.assign(base, {
      trunkLean: rng.range(-8, 8),
      branchAngle: rng.range(22, 42),
      angleJitter: rng.range(4, 14),
      lengthDecay: rng.range(0.68, 0.78),
      widthDecay: rng.range(0.62, 0.72),
      branchesPerNode: rng.int(2, 3),
      curviness: rng.range(-6, 6),
      leafDensity: rng.range(0.55, 1),
      leafSize: rng.range(6, 11),
      asymmetry: rng.range(-0.15, 0.15),
    });
  }

  if (type === 'flower') {
    return Object.assign(base, {
      petalCount: rng.int(5, 12),
      petalShape: rng.pick(['round', 'pointed', 'ruffled']),
      petalLength: rng.range(38, 58),
      petalWidth: rng.range(14, 24),
      petalCurl: rng.range(-0.3, 0.3),
      jitter: rng.range(0.02, 0.12),
      stemCurve: rng.range(-20, 20),
      stemHeight: rng.range(140, 200),
      leafPairs: rng.int(1, 3),
      doubleRow: rng.chance(0.4),
    });
  }

  if (type === 'succulent') {
    return Object.assign(base, {
      leafRows: rng.int(3, 5),
      leavesPerRow: rng.int(5, 9),
      leafLength: rng.range(24, 46),
      leafWidth: rng.range(10, 18),
      pointy: rng.chance(0.5),
      rowShrink: rng.range(0.72, 0.85),
      rotationOffset: rng.range(0, 360),
      tipColorChance: rng.range(0.3, 0.8),
    });
  }

  if (type === 'vine') {
    return Object.assign(base, {
      curlTightness: rng.range(0.15, 0.4),
      segments: rng.int(5, 8),
      segmentLength: rng.range(28, 42),
      leafEvery: rng.int(1, 2),
      leafSize: rng.range(10, 18),
      flowerChance: rng.range(0.2, 0.5),
      direction: rng.sign(),
      waviness: rng.range(15, 35),
      wallHeight: rng.range(30, 55),
      wallStyle: rng.pick(['brick', 'stone']),
    });
  }

  if (type === 'cactus') {
    return Object.assign(base, {
      armCount: rng.int(0, 3),
      bodyWidth: rng.range(22, 34),
      bodyHeight: rng.range(70, 110),
      ribCount: rng.int(5, 9),
      spineChance: rng.range(0.5, 1),
      roundedTop: rng.chance(0.5),
      flowerChance: rng.range(0.3, 0.7),
      armAsymmetry: rng.range(-0.2, 0.2),
    });
  }

  if (type === 'mushroom') {
    return Object.assign(base, {
      clusterCount: rng.int(1, 4),
      capWidth: rng.range(24, 44),
      capHeight: rng.range(14, 26),
      stemHeight: rng.range(28, 52),
      stemWidth: rng.range(6, 11),
      spotted: rng.chance(0.55),
      spotCount: rng.int(3, 8),
      capShape: rng.pick(['dome', 'flat', 'conical']),
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

// ---------- TREE renderer (recursive branching) ----------
function renderTree(genome, stage) {
  const rng = new SeededRandom(genome.seed + 999); // secondary stream for leaf placement
  const maxDepth = Math.max(1, Math.round((stage / (STAGE_COUNT - 1)) * 7));
  const growth = (stage + 1) / STAGE_COUNT; // 0..1 overall scale
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

  return `<g>${svg}${stage >= 2 ? leafSvg : ''}</g>`;
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
  const growth = (stage + 1) / STAGE_COUNT;
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

  if (stage === 1) {
    // small closed bud
    svg += `<ellipse cx="${flowerX.toFixed(1)}" cy="${flowerY.toFixed(1)}" rx="9" ry="13" fill="${rng.pick(genome.palette.petal)}"/>`;
    return `<g>${svg}</g>`;
  }

  // stage 2+: petals appear, more each stage
  const visiblePetals = Math.round(genome.petalCount * Math.min((stage - 1) / 3, 1));
  const petalLen = genome.petalLength * growth;
  const petalWidth = 18 + genome.petalWidth * 0.4;

  let petalsSvg = '';
  for (let i = 0; i < visiblePetals; i++) {
    const angle = (360 / genome.petalCount) * i + rng.range(-genome.jitter * 40, genome.jitter * 40);
    const color = rng.pick(genome.palette.petal);
    const len = petalLen * rng.range(0.92, 1.08);
    petalsSvg += `<path d="${petalPath(flowerX, flowerY, angle, len, petalWidth, genome.petalShape, genome.petalCurl)}" fill="${color}" opacity="0.95" stroke="${color}" stroke-width="1"/>`;
  }

  // second inner row for double flowers, only once mostly grown
  if (genome.doubleRow && stage >= 4) {
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
  const growth = (stage + 1) / STAGE_COUNT;
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

// ---------- VINE renderer (climbing a low wall, growth reaching upward) ----------
function renderWall(genome) {
  const wallTop = 470 - genome.wallHeight;
  const wallBottom = 472;
  let svg = `<ellipse cx="200" cy="${wallBottom + 4}" rx="90" ry="7" fill="#3a2f26" opacity="0.35"/>`;
  svg += `<rect x="120" y="${wallTop.toFixed(1)}" width="160" height="${(wallBottom - wallTop).toFixed(1)}" fill="#9c948a" stroke="#7a7268" stroke-width="1.5"/>`;

  if (genome.wallStyle === 'brick') {
    const rows = Math.max(2, Math.round(genome.wallHeight / 12));
    for (let r = 0; r < rows; r++) {
      const ry = wallTop + r * 12;
      const offset = r % 2 === 0 ? 0 : 15;
      svg += `<line x1="120" y1="${ry.toFixed(1)}" x2="280" y2="${ry.toFixed(1)}" stroke="#7a7268" stroke-width="1"/>`;
      for (let bx = 120 + offset; bx < 280; bx += 30) {
        svg += `<line x1="${bx}" y1="${ry.toFixed(1)}" x2="${bx}" y2="${(ry + 12).toFixed(1)}" stroke="#7a7268" stroke-width="1"/>`;
      }
    }
  } else {
    // rough stone blocks
    const rng = new SeededRandom(genome.seed + 222);
    const rows = Math.max(2, Math.round(genome.wallHeight / 14));
    for (let r = 0; r < rows; r++) {
      let bx = 120;
      const ry = wallTop + r * 14;
      while (bx < 280) {
        const bw = 20 + rng.range(0, 20);
        svg += `<rect x="${bx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.min(bw, 280 - bx).toFixed(1)}" height="13" fill="none" stroke="#7a7268" stroke-width="1"/>`;
        bx += bw + 2;
      }
    }
  }
  return { svg, wallTop };
}

function renderVine(genome, stage) {
  const rng = new SeededRandom(genome.seed + 111);
  const growth = (stage + 1) / STAGE_COUNT;
  const activeSegments = Math.max(1, Math.round(genome.segments * growth));

  const { svg: wallSvg, wallTop } = renderWall(genome);

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
    } else if (stage >= 3) {
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
  const growth = (stage + 1) / STAGE_COUNT;
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
  const activeArms = stage >= 2 ? genome.armCount : 0;
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
  if (stage >= 4 && rng.chance(genome.flowerChance)) {
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
  const growth = (stage + 1) / STAGE_COUNT;
  const groundY = 465;
  let svg = `<ellipse cx="200" cy="${groundY + 6}" rx="60" ry="10" fill="#4a3826" opacity="0.4"/>`;

  const activeCount = Math.max(1, Math.round(genome.clusterCount * Math.min((stage + 1) / 3, 1)));
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

    if (genome.spotted && stage >= 2) {
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
