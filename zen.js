/**
 * ZEN GARDEN
 * ----------
 * A calm, endlessly-scrolling-right world rendered in the same
 * hand-drawn SVG style as the plants themselves. The scenery (hills,
 * grass tufts, rocks, distant bushes, clouds) is procedurally generated
 * from a FIXED seed, so the world always looks exactly the same no
 * matter how many times you visit it — it's a real place, not a new
 * random one each time.
 *
 * When a plant finishes growing in the Simulator tab, app.js calls
 * enterPlacementMode(genome) which switches to this tab, shows the
 * plant "held" in the center of the screen, and lets the user tap
 * anywhere in the world to permanently plant it at that exact spot.
 * Placed plants are saved to localStorage (world x position + genome
 * seed/type) so the garden persists across visits.
 */

const ZEN_STORAGE_KEY = 'zen-garden-v1';
const ZEN_SCENERY_SEED = 918273645; // fixed — the world is always identical
const GROUND_Y_FRAC = 0.78; // fraction down the viewport where grass horizon sits
const CHUNK_WIDTH = 900; // px of world generated per scenery chunk
const WORLD_HEIGHT = 900; // svg internal height for zenWorldSvg viewBox

const zenViewport = document.getElementById('zenViewport');
const zenSky = document.getElementById('zenSky');
const zenWorld = document.getElementById('zenWorld');
const zenWorldSvg = document.getElementById('zenWorldSvg');
const placementLayer = document.getElementById('placementLayer');
const heldPlantSvg = document.getElementById('heldPlantSvg');
const zenScrollHint = document.querySelector('.zen-scroll-hint');
const heldPlant = document.getElementById('heldPlant');

let zenBuiltChunks = 0; // how many CHUNK_WIDTH-wide chunks of scenery+decor exist so far
let placedPlants = [];  // { x, seed, type, plantedAt }
let placing = null;     // { genome } while holding a plant to place, else null
let zenInitialized = false;

// how close (in world px) a new plant's center can be to an existing one
// before that spot counts as "occupied" and can't be planted on
const PLANT_FOOTPRINT = 150;

// ---------- persistence ----------
function loadZenGarden() {
  try {
    const raw = localStorage.getItem(ZEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveZenGarden(list) {
  localStorage.setItem(ZEN_STORAGE_KEY, JSON.stringify(list));
}

// ---------- sky (fixed gradient + sun, sits behind everything, doesn't scroll) ----------
function buildSky() {
  zenSky.setAttribute('viewBox', '0 0 800 900');
  zenSky.innerHTML = `
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bfe4f7"/>
        <stop offset="55%" stop-color="#dcf0f8"/>
        <stop offset="100%" stop-color="#f3f8ea"/>
      </linearGradient>
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff6cf" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#fff6cf" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="800" height="900" fill="url(#skyGrad)"/>
    <circle cx="640" cy="150" r="140" fill="url(#sunGlow)"/>
    <circle cx="640" cy="150" r="48" fill="#ffe27a"/>
    <circle cx="640" cy="150" r="48" fill="#fff3c4" opacity="0.5"/>
  `;
}

// ---------- deterministic cloud layer (parallax, tied to scroll) ----------
function cloudGlyph(cx, cy, scale, rng) {
  const puffs = rng.int(3, 5);
  let d = '';
  for (let i = 0; i < puffs; i++) {
    const px = cx + (i - puffs / 2) * 26 * scale + rng.range(-6, 6);
    const py = cy + rng.range(-6, 6) - Math.abs(i - puffs / 2) * 4 * scale;
    const r = (16 + rng.range(-3, 5)) * scale;
    d += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}"/>`;
  }
  return `<g fill="#ffffff" opacity="0.92">${d}</g>`;
}

// ---------- scenery generation: deterministic per chunk index ----------
// Each chunk is CHUNK_WIDTH wide. Using (ZEN_SCENERY_SEED + chunkIndex * big-prime)
// as a seed means the same chunk index always regenerates identical scenery.
function buildChunkScenery(chunkIndex) {
  const worldX0 = chunkIndex * CHUNK_WIDTH;
  const rng = new SeededRandom(ZEN_SCENERY_SEED + chunkIndex * 104729);
  const groundY = WORLD_HEIGHT * GROUND_Y_FRAC;
  let svg = '';

  // --- far background hills (soft, muted) ---
  const hillY = groundY - 70 - rng.range(0, 20);
  svg += `<path d="M ${worldX0} ${groundY}
    Q ${worldX0 + CHUNK_WIDTH * 0.25} ${hillY - rng.range(20, 50)} ${worldX0 + CHUNK_WIDTH * 0.5} ${hillY}
    Q ${worldX0 + CHUNK_WIDTH * 0.75} ${hillY - rng.range(10, 40)} ${worldX0 + CHUNK_WIDTH} ${groundY}
    Z" fill="#c9e3c2" opacity="0.55"/>`;

  // --- mid background bushes / tree silhouettes, sparse ---
  const bushCount = rng.int(2, 4);
  for (let i = 0; i < bushCount; i++) {
    const bx = worldX0 + rng.range(20, CHUNK_WIDTH - 20);
    const by = groundY - rng.range(4, 14);
    const scale = rng.range(0.6, 1.1);
    const colors = ['#8fbf7a', '#7fb570', '#a3cc8c'];
    const color = rng.pick(colors);
    svg += bushGlyph(bx, by, scale, color, rng);
  }

  // --- distant small rock clusters ---
  if (rng.chance(0.6)) {
    const rx = worldX0 + rng.range(30, CHUNK_WIDTH - 30);
    const ry = groundY + rng.range(2, 10);
    svg += rockGlyph(rx, ry, rng.range(0.6, 1.2), rng);
  }

  // --- ground band for this chunk (slightly varied green, grassy edge) ---
  const groundWobble = rng.range(-6, 6);
  svg += `<path d="M ${worldX0} ${(groundY + groundWobble).toFixed(1)}
    Q ${(worldX0 + CHUNK_WIDTH / 2).toFixed(1)} ${(groundY + groundWobble * 0.4).toFixed(1)} ${(worldX0 + CHUNK_WIDTH).toFixed(1)} ${groundY.toFixed(1)}
    L ${(worldX0 + CHUNK_WIDTH).toFixed(1)} ${WORLD_HEIGHT} L ${worldX0} ${WORLD_HEIGHT} Z"
    fill="#9fd482"/>`;
  svg += `<path d="M ${worldX0} ${(groundY + groundWobble).toFixed(1)}
    Q ${(worldX0 + CHUNK_WIDTH / 2).toFixed(1)} ${(groundY + groundWobble * 0.4).toFixed(1)} ${(worldX0 + CHUNK_WIDTH).toFixed(1)} ${groundY.toFixed(1)}
    L ${(worldX0 + CHUNK_WIDTH).toFixed(1)} ${(groundY + 18).toFixed(1)}
    Q ${(worldX0 + CHUNK_WIDTH / 2).toFixed(1)} ${(groundY + groundWobble * 0.4 + 18).toFixed(1)} ${worldX0} ${(groundY + groundWobble + 18).toFixed(1)} Z"
    fill="#b6e097" opacity="0.7"/>`;

  // --- grass tufts scattered across the foreground ---
  const tuftCount = rng.int(10, 16);
  for (let i = 0; i < tuftCount; i++) {
    const gx = worldX0 + rng.range(0, CHUNK_WIDTH);
    const gy = groundY + groundWobble * (1 - (gx - worldX0) / CHUNK_WIDTH) + rng.range(6, 60);
    svg += grassTuftGlyph(gx, gy, rng.range(0.7, 1.3), rng);
  }

  // --- a few small flowers dotted in the grass for warmth ---
  const flowerCount = rng.int(2, 5);
  const flowerColors = ['#f2a3c1', '#f7d15c', '#e88b8b', '#ffffff'];
  for (let i = 0; i < flowerCount; i++) {
    const fx = worldX0 + rng.range(0, CHUNK_WIDTH);
    const fy = groundY + rng.range(20, 70);
    const color = rng.pick(flowerColors);
    svg += `<g opacity="0.95">
      <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="2" fill="#f7d15c"/>
      ${[0,72,144,216,288].map(a => {
        const [px, py] = polarZen(fx, fy, 3.4, a);
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.3" fill="${color}"/>`;
      }).join('')}
    </g>`;
  }

  return svg;
}

function polarZen(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

function bushGlyph(cx, cy, scale, color, rng) {
  const lobes = rng.int(3, 5);
  let d = '';
  for (let i = 0; i < lobes; i++) {
    const lx = cx + (i - lobes / 2) * 12 * scale;
    const ly = cy - Math.abs(i - lobes / 2) * 3 * scale;
    const r = (14 + rng.range(-2, 4)) * scale;
    d += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
  }
  return `<g opacity="0.9">${d}</g>`;
}

function rockGlyph(cx, cy, scale, rng) {
  const w = 22 * scale, h = 14 * scale;
  return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${w.toFixed(1)}" ry="${h.toFixed(1)}" fill="#b9ada0" opacity="0.85"/>
    <ellipse cx="${(cx - w * 0.3).toFixed(1)}" cy="${(cy - h * 0.3).toFixed(1)}" rx="${(w * 0.4).toFixed(1)}" ry="${(h * 0.35).toFixed(1)}" fill="#cfc5b8" opacity="0.7"/>`;
}

function grassTuftGlyph(cx, cy, scale, rng) {
  const blades = rng.int(3, 5);
  let d = '';
  const color = rng.pick(['#5fa855', '#6bb85e', '#4f9648']);
  for (let i = 0; i < blades; i++) {
    const lean = (i - blades / 2) * 6 + rng.range(-3, 3);
    const h = (10 + rng.range(-2, 6)) * scale;
    const bx = cx + (i - blades / 2) * 2.5;
    d += `<path d="M ${bx.toFixed(1)} ${cy.toFixed(1)} Q ${(bx + lean * 0.6).toFixed(1)} ${(cy - h * 0.6).toFixed(1)} ${(bx + lean).toFixed(1)} ${(cy - h).toFixed(1)}"
      stroke="${color}" stroke-width="${(2 * scale).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
  }
  return `<g>${d}</g>`;
}

// clouds are drawn separately into their own always-rendered strip so we
// don't have to keep regenerating them as chunks build; they cover a wide
// fixed span and repeat every REPEAT px, gently looping.
const CLOUD_REPEAT = 1400;
function buildCloudLayer() {
  const rng = new SeededRandom(ZEN_SCENERY_SEED + 55);
  let svg = '';
  const count = 6;
  for (let i = 0; i < count; i++) {
    const cx = rng.range(0, CLOUD_REPEAT);
    const cy = rng.range(60, 230);
    const scale = rng.range(0.7, 1.4);
    svg += cloudGlyph(cx, cy, scale, rng);
  }
  return svg;
}
let cloudLayerMarkup = '';

function ensureChunksUpTo(worldXRight) {
  const neededChunks = Math.ceil(worldXRight / CHUNK_WIDTH) + 2;
  if (neededChunks <= zenBuiltChunks) return;
  for (let c = zenBuiltChunks; c < neededChunks; c++) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-chunk', c);
    g.innerHTML = buildChunkScenery(c);
    zenWorldSvg.appendChild(g);
  }
  zenBuiltChunks = neededChunks;
  const totalWidth = zenBuiltChunks * CHUNK_WIDTH;
  zenWorldSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${WORLD_HEIGHT}`);
  zenWorld.style.width = totalWidth + 'px';
}

// ---------- placed plant rendering ----------
const placedLayer_id = 'placedPlantsLayer';
function getPlacedLayer() {
  let layer = zenWorldSvg.querySelector(`#${placedLayer_id}`);
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.id = placedLayer_id;
    zenWorldSvg.appendChild(layer);
  }
  return layer;
}

function renderPlacedPlants() {
  const layer = getPlacedLayer();
  layer.innerHTML = '';
  const groundY = WORLD_HEIGHT * GROUND_Y_FRAC;
  placedPlants.forEach((p) => {
    const genome = generateGenome(p.seed, p.type);
    const svgContent = renderPlant(genome, genome.stageCount - 1);
    const scale = 0.62;
    const plantW = 400 * scale, plantH = 500 * scale;
    const tx = p.x - plantW / 2;
    const ty = groundY - plantH + 40 * scale; // anchor near base (plant's own ground line ~y460-470/500)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${scale})`);
    g.innerHTML = svgContent;
    layer.appendChild(g);
  });
}

// ---------- placement mode ----------
function enterPlacementMode(genome) {
  placing = { genome };
  heldPlantSvg.innerHTML = renderPlant(genome, genome.stageCount - 1);
  placementLayer.classList.add('active');
  heldPlant.classList.remove('occupied');
  // start the ghost centered in the viewport until the user moves the pointer
  zenViewport.style.setProperty('--held-x', '50%');
  switchTab('zen');
  // scroll to a pleasant spot: end of currently placed content, or start
  requestAnimationFrame(() => {
    ensureChunksUpTo(zenViewport.clientWidth * 3);
    const targetScroll = placedPlants.length
      ? Math.max(0, (placedPlants[placedPlants.length - 1].x) - zenViewport.clientWidth / 2)
      : 0;
    zenViewport.scrollLeft = targetScroll;
  });
}

function exitPlacementMode() {
  placing = null;
  placementLayer.classList.remove('active');
}

function worldXFromViewportTap(clientX) {
  const rect = zenViewport.getBoundingClientRect();
  const viewportX = clientX - rect.left;
  // world coord = current scroll + tap position within viewport, scaled by
  // the ratio between the svg's internal coordinate space and its rendered px width
  const svgRect = zenWorldSvg.getBoundingClientRect();
  const scaleRatio = (zenBuiltChunks * CHUNK_WIDTH) / svgRect.width;
  return (zenViewport.scrollLeft + viewportX) * scaleRatio;
}

// true once a candidate spot is too close to a tree that's already planted
function isSpotOccupied(worldX) {
  return placedPlants.some((p) => Math.abs(p.x - worldX) < PLANT_FOOTPRINT);
}

// moves the "held" plant ghost so it tracks the pointer/finger, and shows
// whether the spot underneath it is free to plant on
function updateHeldGhostPosition(clientX) {
  if (!placing) return;
  const rect = zenViewport.getBoundingClientRect();
  const viewportX = Math.max(0, Math.min(clientX - rect.left, rect.width));
  zenViewport.style.setProperty('--held-x', viewportX + 'px');
  const worldX = worldXFromViewportTap(clientX);
  heldPlant.classList.toggle('occupied', isSpotOccupied(worldX));
}

function handleZenPointerMove(e) {
  if (!placing) return;
  const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  updateHeldGhostPosition(clientX);
}

function handleZenTap(e) {
  if (!placing) return;
  const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  updateHeldGhostPosition(clientX);
  const worldX = worldXFromViewportTap(clientX);
  if (isSpotOccupied(worldX)) {
    // spot's taken — give a little shake to say "no" and keep holding the plant
    heldPlant.classList.remove('shake');
    // eslint-disable-next-line no-unused-expressions
    void heldPlant.offsetWidth; // restart animation
    heldPlant.classList.add('shake');
    return;
  }
  placeHeldPlantAt(worldX);
}

function placeHeldPlantAt(worldX) {
  if (!placing) return;
  if (isSpotOccupied(worldX)) return; // safety net against double-taps/races
  const entry = {
    x: worldX,
    seed: placing.genome.seed,
    type: placing.genome.type,
    plantedAt: new Date().toISOString(),
  };
  placedPlants.push(entry);
  placedPlants.sort((a, b) => a.x - b.x);
  saveZenGarden(placedPlants);
  ensureChunksUpTo(worldX + zenViewport.clientWidth);
  renderPlacedPlants();
  exitPlacementMode();
}

// ---------- tab switching ----------
function switchTab(name) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((el) => el.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add('active');
  if (name === 'zen') initZenGarden();
}

function initZenGarden() {
  if (!zenInitialized) {
    buildSky();
    cloudLayerMarkup = buildCloudLayer();
    placedPlants = loadZenGarden();
    ensureChunksUpTo(Math.max(zenViewport.clientWidth * 2, 1800));
    renderPlacedPlants();
    zenInitialized = true;

    // parallax: clouds + hills drift slower than foreground scroll
    zenViewport.addEventListener('scroll', () => {
      const offset = zenViewport.scrollLeft * 0.25;
      zenSky.style.setProperty('--cloud-offset', offset + 'px');
      updateCloudScroll();
    });
    updateCloudScroll();

    zenViewport.addEventListener('click', handleZenTap);
    zenViewport.addEventListener('mousemove', handleZenPointerMove);
    zenViewport.addEventListener(
      'touchmove',
      (e) => {
        if (!placing) return;
        handleZenPointerMove(e);
      },
      { passive: true }
    );
    zenViewport.addEventListener(
      'touchend',
      (e) => {
        if (!placing) return;
        e.preventDefault();
        handleZenTap(e.changedTouches[0]);
      },
      { passive: false }
    );

    // extend world as user scrolls near the right edge
    zenViewport.addEventListener('scroll', () => {
      const rightEdge = zenViewport.scrollLeft + zenViewport.clientWidth;
      const svgRect = zenWorldSvg.getBoundingClientRect();
      const scaleRatio = svgRect.width > 0 ? (zenBuiltChunks * CHUNK_WIDTH) / svgRect.width : 1;
      const worldRightEdge = rightEdge * scaleRatio;
      if (worldRightEdge > (zenBuiltChunks - 1) * CHUNK_WIDTH) {
        ensureChunksUpTo(worldRightEdge + CHUNK_WIDTH * 2);
        renderPlacedPlants();
      }
    });
  } else {
    // refresh in case new plants were placed since last visit to this tab
    renderPlacedPlants();
  }
}

function updateCloudScroll() {
  const offset = zenViewport.scrollLeft * 0.25;
  const loopOffset = offset % CLOUD_REPEAT;
  const cloudViewBoxX = loopOffset;
  zenSky.querySelectorAll('.cloud-layer').forEach((n) => n.remove());
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'cloud-layer');
  // draw two copies side by side so the loop is seamless
  const scaleToSky = 800 / zenViewport.clientWidth; // sky viewBox is 800 wide, fixed
  const skyX = -((cloudViewBoxX * scaleToSky) % CLOUD_REPEAT);
  g.innerHTML = `<g transform="translate(${skyX.toFixed(1)},0)">${cloudLayerMarkup}</g>
    <g transform="translate(${(skyX + CLOUD_REPEAT).toFixed(1)},0)">${cloudLayerMarkup}</g>`;
  zenSky.appendChild(g);
}

// tab bar wiring
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
