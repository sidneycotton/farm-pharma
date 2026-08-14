const STORAGE_KEY = 'procedural-garden-v1';

const svgRoot = document.getElementById('plantSvg');
const growBtn = document.getElementById('growBtn');
const newPlantBtn = document.getElementById('newPlantBtn');
const typeSelect = document.getElementById('typeSelect');
const plantTypeLabel = document.getElementById('plantType');
const stageLabel = document.getElementById('stageLabel');
const seedLabel = document.getElementById('seedLabel');
const gardenGrid = document.getElementById('gardenGrid');
const gardenCount = document.getElementById('gardenCount');
const clearGardenBtn = document.getElementById('clearGardenBtn');

let current = null; // { seed, type, genome, stage }

function startNewPlant() {
  const seed = makeSeed();
  const rngPick = new SeededRandom(seed);
  const type = pickPlantType(rngPick, typeSelect.value);
  const genome = generateGenome(seed, type);
  current = { seed, type, stage: 0, genome };
  renderCurrent();
  growBtn.disabled = false;
  newPlantBtn.disabled = true;
}

function renderCurrent() {
  svgRoot.innerHTML = renderPlant(current.genome, current.stage);
  plantTypeLabel.textContent = capitalize(current.type);
  stageLabel.textContent = `${STAGE_NAMES[current.stage]} (${current.stage + 1} / ${STAGE_COUNT})`;
  seedLabel.textContent = current.seed;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

growBtn.addEventListener('click', () => {
  if (!current) return;
  if (current.stage < STAGE_COUNT - 1) {
    current.stage++;
    renderCurrent();
    growBtn.classList.add('pulse');
    setTimeout(() => growBtn.classList.remove('pulse'), 300);
  }
  if (current.stage === STAGE_COUNT - 1) {
    growBtn.disabled = true;
    newPlantBtn.disabled = false;
    saveToGarden(current);
  }
});

newPlantBtn.addEventListener('click', startNewPlant);

typeSelect.addEventListener('change', () => {
  // Changing type mid-life starts a fresh plant of that type
  startNewPlant();
});

// ---------- Garden persistence ----------
function loadGarden() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveGarden(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function saveToGarden(plant) {
  const garden = loadGarden();
  garden.unshift({
    seed: plant.seed,
    type: plant.type,
    plantedAt: new Date().toISOString(),
  });
  saveGarden(garden);
  renderGarden();
}

function renderGarden() {
  const garden = loadGarden();
  gardenCount.textContent = garden.length;
  gardenGrid.innerHTML = '';

  if (garden.length === 0) {
    gardenGrid.innerHTML = '<p class="empty-msg">Grow a plant to full bloom to add it to your garden.</p>';
    return;
  }

  garden.forEach((entry) => {
    const genome = generateGenome(entry.seed, entry.type);
    const svgContent = renderPlant(genome, STAGE_COUNT - 1);
    const card = document.createElement('div');
    card.className = 'garden-card';
    card.innerHTML = `
      <svg viewBox="0 0 400 500" class="garden-thumb">${svgContent}</svg>
      <div class="garden-card-label">
        <span>${capitalize(entry.type)}</span>
        <span class="garden-seed">#${entry.seed}</span>
      </div>
    `;
    gardenGrid.appendChild(card);
  });
}

clearGardenBtn.addEventListener('click', () => {
  if (confirm('Clear your entire garden? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    renderGarden();
  }
});

// ---------- Init ----------
renderGarden();
startNewPlant();
