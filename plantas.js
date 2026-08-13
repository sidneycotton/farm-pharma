// Cada tipo de planta tem 3 estágios de SVG: broto, muda, madura
const estagiosPlanta = {
  flor: [
    // estágio 0 - broto
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 65" stroke="#7cb996" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="60" r="6" fill="#a3d9b1"/></svg>`,
    // estágio 1 - muda
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 45" stroke="#6aa87c" stroke-width="4" stroke-linecap="round"/><path d="M50 60 Q35 55 38 45" stroke="#6aa87c" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 65 Q65 60 62 50" stroke="#6aa87c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="42" r="8" fill="#f6b8c4"/></svg>`,
    // estágio 2 - madura (flor aberta)
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 40" stroke="#569368" stroke-width="5" stroke-linecap="round"/><path d="M50 65 Q30 58 34 45" stroke="#569368" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 70 Q70 63 66 50" stroke="#569368" stroke-width="4" fill="none" stroke-linecap="round"/><g transform="translate(50,32)"><circle cx="0" cy="-12" r="9" fill="#f6b8c4"/><circle cx="10" cy="-6" r="9" fill="#f6b8c4"/><circle cx="10" cy="6" r="9" fill="#f6b8c4"/><circle cx="0" cy="12" r="9" fill="#f6b8c4"/><circle cx="-10" cy="6" r="9" fill="#f6b8c4"/><circle cx="-10" cy="-6" r="9" fill="#f6b8c4"/><circle cx="0" cy="0" r="7" fill="#ffd88a"/></g></svg>`
  ],
  girassol: [
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 65" stroke="#7cb996" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="60" r="6" fill="#a3d9b1"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 42" stroke="#6aa87c" stroke-width="4" stroke-linecap="round"/><path d="M50 60 Q33 55 37 43" stroke="#6aa87c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="38" r="9" fill="#ffd88a"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 38" stroke="#569368" stroke-width="5" stroke-linecap="round"/><path d="M50 65 Q28 58 33 44" stroke="#569368" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 72 Q72 65 67 50" stroke="#569368" stroke-width="4" fill="none" stroke-linecap="round"/><g transform="translate(50,28)"><circle cx="0" cy="0" r="16" fill="#ffcf5c"/><circle cx="0" cy="0" r="8" fill="#8a5a2b"/></g></svg>`
  ],
  arvore: [
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 68" stroke="#8a6a45" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="63" r="6" fill="#a3d9b1"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 48" stroke="#8a6a45" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="42" r="16" fill="#8fd1ab"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 55" stroke="#7a5a35" stroke-width="8" stroke-linecap="round"/><circle cx="38" cy="42" r="16" fill="#7cb996"/><circle cx="62" cy="42" r="16" fill="#7cb996"/><circle cx="50" cy="28" r="18" fill="#8fd1ab"/></svg>`
  ],
  trevo: [
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 70" stroke="#7cb996" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="65" r="5" fill="#a3d9b1"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 55" stroke="#6aa87c" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="48" r="9" fill="#8fd1ab"/><circle cx="58" cy="48" r="9" fill="#8fd1ab"/><circle cx="50" cy="38" r="9" fill="#8fd1ab"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 55" stroke="#569368" stroke-width="5" stroke-linecap="round"/><circle cx="38" cy="46" r="11" fill="#7cb996"/><circle cx="62" cy="46" r="11" fill="#7cb996"/><circle cx="50" cy="34" r="11" fill="#7cb996"/><circle cx="50" cy="52" r="8" fill="#7cb996"/></svg>`
  ],
  margarida: [
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 68" stroke="#7cb996" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="63" r="6" fill="#a3d9b1"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 45" stroke="#6aa87c" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="40" r="7" fill="#ffffff" stroke="#ffd88a" stroke-width="2"/></svg>`,
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 38" stroke="#569368" stroke-width="5" stroke-linecap="round"/><g transform="translate(50,28)"><ellipse cx="0" cy="-11" rx="4" ry="10" fill="#ffffff"/><ellipse cx="8" cy="-5" rx="4" ry="10" fill="#ffffff" transform="rotate(60 8 -5)"/><ellipse cx="8" cy="5" rx="4" ry="10" fill="#ffffff" transform="rotate(120 8 5)"/><ellipse cx="0" cy="11" rx="4" ry="10" fill="#ffffff" transform="rotate(180 0 11)"/><ellipse cx="-8" cy="5" rx="4" ry="10" fill="#ffffff" transform="rotate(240 -8 5)"/><ellipse cx="-8" cy="-5" rx="4" ry="10" fill="#ffffff" transform="rotate(300 -8 -5)"/><circle cx="0" cy="0" r="7" fill="#ffd88a"/></g></svg>`
  ],
  cacto: [
    `<svg viewBox="0 0 100 100"><path d="M50 90 L50 72" stroke="#7cb996" stroke-width="5" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 100 100"><rect x="42" y="45" width="16" height="45" rx="8" fill="#7cb996"/></svg>`,
    `<svg viewBox="0 0 100 100"><rect x="42" y="35" width="16" height="55" rx="8" fill="#569368"/><rect x="25" y="45" width="14" height="10" rx="6" fill="#569368"/><rect x="61" y="55" width="14" height="10" rx="6" fill="#569368"/><circle cx="50" cy="30" r="5" fill="#f6b8c4"/></svg>`
  ]
};

const nomesPlanta = {
  flor: 'Flor',
  girassol: 'Girassol',
  arvore: 'Árvore',
  trevo: 'Trevo',
  margarida: 'Margarida',
  cacto: 'Cacto'
};
