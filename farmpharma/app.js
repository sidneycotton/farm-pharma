// Lista de desafios em memória (carrega do localStorage se existir)
let desafios = JSON.parse(localStorage.getItem('farmpharma-desafios')) || [];
let jardimSalvo = JSON.parse(localStorage.getItem('farmpharma-jardim')) || [];

const form = document.getElementById('form-desafio');
const listaDesafios = document.getElementById('lista-desafios');

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const nomeInput = document.getElementById('nome-desafio');
  const horarioInput = document.getElementById('horario-desafio');

  const novoDesafio = {
    id: Date.now(),
    nome: nomeInput.value,
    horario: horarioInput.value,
    concluido: false
  };

  desafios.push(novoDesafio);
  renderizarDesafios();

  form.reset();
});

function renderizarDesafios() {
  localStorage.setItem('farmpharma-desafios', JSON.stringify(desafios));
  listaDesafios.innerHTML = '';

  desafios.forEach(function (desafio) {
    const item = document.createElement('li');

    const texto = document.createElement('span');
    texto.textContent = desafio.nome + ' - ' + desafio.horario;

    const botao = document.createElement('button');
    botao.textContent = desafio.concluido ? '✔️ Feito' : 'Cumprir';
    botao.addEventListener('click', function () {
      if (!desafio.concluido) {
        desafio.concluido = true;
        plantarNoJardim();
      }
      renderizarDesafios();
    });

    item.appendChild(texto);
    item.appendChild(botao);
    listaDesafios.appendChild(item);
  });
}

// Jardim
const jardim = document.getElementById('jardim');

const tiposDePlanta = [
  { emoji: '🌱', nome: 'Broto' },
  { emoji: '🌷', nome: 'Flor' },
  { emoji: '🌻', nome: 'Girassol' },
  { emoji: '🌳', nome: 'Árvore' },
  { emoji: '🍀', nome: 'Trevo' },
  { emoji: '🌼', nome: 'Margarida' },
  { emoji: '🌵', nome: 'Cacto' }
];

function plantarNoJardim(sorteioForcado) {
  const sorteio = sorteioForcado || tiposDePlanta[Math.floor(Math.random() * tiposDePlanta.length)];

  const planta = document.createElement('div');
  planta.className = 'planta';
  planta.innerHTML = sorteio.emoji + '<span>' + sorteio.nome + '</span>';

  jardim.appendChild(planta);

  if (!sorteioForcado) {
    jardimSalvo.push(sorteio);
    localStorage.setItem('farmpharma-jardim', JSON.stringify(jardimSalvo));
  }
}

// Recarrega o que já existia salvo
jardimSalvo.forEach(function (sorteio) {
  plantarNoJardim(sorteio);
});
renderizarDesafios();
