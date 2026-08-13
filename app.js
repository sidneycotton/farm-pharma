// Navegação entre telas
const botoesNav = document.querySelectorAll('.nav-btn');
const telas = document.querySelectorAll('.tela');

botoesNav.forEach(function (botao) {
  botao.addEventListener('click', function () {
    botoesNav.forEach(function (b) { b.classList.remove('ativo'); });
    telas.forEach(function (t) { t.classList.remove('ativa'); });

    botao.classList.add('ativo');
    document.getElementById(botao.dataset.tela).classList.add('ativa');
  });
});

// Dados
let desafios = JSON.parse(localStorage.getItem('farmpharma-desafios')) || [];

// Remove registros de versões antigas que não têm tipoPlanta/estagio
desafios = desafios.filter(function (d) {
  return d.tipoPlanta && typeof d.estagio === 'number';
});

const tiposDePlanta = Object.keys(estagiosPlanta);

const form = document.getElementById('form-desafio');
const listaDesafios = document.getElementById('lista-desafios');
const jardim = document.getElementById('jardim');

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const nomeInput = document.getElementById('nome-desafio');
  const horarioInput = document.getElementById('horario-desafio');
  const tipo = tiposDePlanta[Math.floor(Math.random() * tiposDePlanta.length)];

  desafios.push({
    id: Date.now(),
    nome: nomeInput.value,
    horario: horarioInput.value,
    tipoPlanta: tipo,
    estagio: 0
  });

  salvarERenderizar();
  form.reset();
});

function salvarERenderizar() {
  localStorage.setItem('farmpharma-desafios', JSON.stringify(desafios));
  renderizarDesafios();
  renderizarJardim();
}

function renderizarDesafios() {
  listaDesafios.innerHTML = '';

  desafios.forEach(function (desafio) {
    const item = document.createElement('li');

    const texto = document.createElement('span');
    texto.textContent = desafio.nome + ' - ' + desafio.horario;

    const botao = document.createElement('button');
    const maduro = desafio.estagio >= 2;
    botao.textContent = maduro ? '🌟 Completo' : 'Cumprir';
    botao.disabled = maduro;

    botao.addEventListener('click', function () {
      if (desafio.estagio < 2) {
        desafio.estagio++;
        salvarERenderizar();
      }
    });

    item.appendChild(texto);
    item.appendChild(botao);
    listaDesafios.appendChild(item);
  });
}

function renderizarJardim() {
  jardim.innerHTML = '';

  desafios.forEach(function (desafio) {
    const svgMarkup = estagiosPlanta[desafio.tipoPlanta][desafio.estagio];

    const planta = document.createElement('div');
    planta.className = 'planta';
    planta.innerHTML = svgMarkup + '<span>' + nomesPlanta[desafio.tipoPlanta] + '</span>';

salvarERenderizar();

// Resetar progresso
document.getElementById('btn-reset').addEventListener('click', function () {
  if (confirm('Isso vai apagar todos os desafios e o jardim. Tem certeza?')) {
    localStorage.removeItem('farmpharma-desafios');
    desafios = [];
    salvarERenderizar();
  }
});

