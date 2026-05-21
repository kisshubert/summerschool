const games = {
  dictator: {
    title: "Dictator Game",
    intro: "Tienes 100 tokens. Decide cuantos das a otra persona anonima. La otra persona no puede responder.",
    render: renderDictator
  },
  ultimatum: {
    title: "Ultimatum Game",
    intro: "Propone un reparto de 100 tokens. Si la otra persona acepta, ambos cobran. Si rechaza, ambos reciben 0.",
    render: renderUltimatum
  },
  public: {
    title: "Public Goods Game",
    intro: "Cuatro estudiantes reciben 50 tokens. Cada contribucion al fondo comun se multiplica y se reparte por igual.",
    render: renderPublicGoods
  },
  trust: {
    title: "Trust Game",
    intro: "Envia tokens a una pareja anonima. Lo enviado se triplica, y luego la pareja decide cuanto devuelve.",
    render: renderTrust
  },
  results: {
    title: "Resultados",
    intro: "Compara tus decisiones y prepara preguntas para debatir en la Summer School.",
    render: renderResults
  }
};

const state = {
  current: "dictator",
  total: 0,
  completed: {
    dictator: null,
    ultimatum: null,
    public: null,
    trust: null
  }
};

const stage = document.querySelector("#stage");
const totalPayoff = document.querySelector("#totalPayoff");
const navButtons = [...document.querySelectorAll(".nav-button")];
const resetButton = document.querySelector("#resetButton");

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.current = button.dataset.game;
    render();
  });
});

resetButton.addEventListener("click", () => {
  state.total = 0;
  Object.keys(state.completed).forEach((key) => {
    state.completed[key] = null;
  });
  state.current = "dictator";
  render();
});

function render() {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.game === state.current);
  });
  totalPayoff.textContent = state.total;
  const game = games[state.current];
  stage.innerHTML = `
    <div class="game-header">
      <div>
        <span class="badge">Interactive session</span>
        <h2>${game.title}</h2>
        <p>${game.intro}</p>
      </div>
      <div class="visual" aria-hidden="true">${coinStack(7)}</div>
    </div>
    <div id="gameBody"></div>
  `;
  game.render(document.querySelector("#gameBody"));
}

function coinStack(count) {
  return `<div class="coin-stack">${Array.from({ length: count }, () => '<span class="coin"></span>').join("")}</div>`;
}

function setResult(game, payoff, data) {
  const previous = state.completed[game];
  if (previous) {
    state.total -= previous.payoff;
  }
  state.completed[game] = { payoff, ...data };
  state.total += payoff;
  totalPayoff.textContent = state.total;
}

function renderDictator(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Tu decision</h3>
        <div class="slider-row">
          <label for="dictatorGive">
            <span>Dar a la otra persona</span>
            <strong><span id="dictatorValue">30</span> tokens</strong>
          </label>
          <input id="dictatorGive" type="range" min="0" max="100" step="5" value="30">
        </div>
        <div class="split-view">
          <div class="person">
            <strong>Tu pago</strong>
            <div class="meter"><span id="dictatorYou"></span></div>
            <p><span id="dictatorYouText">70</span> tokens</p>
          </div>
          <div class="person">
            <strong>Otra persona</strong>
            <div class="meter"><span id="dictatorOther"></span></div>
            <p><span id="dictatorOtherText">30</span> tokens</p>
          </div>
        </div>
        <button class="primary-button" id="dictatorSubmit">Confirmar decision</button>
        <div class="feedback" id="dictatorFeedback">Observa como cambia el reparto antes de confirmar.</div>
      </div>
      <div class="panel">
        <h3>Pregunta de clase</h3>
        <p>Sin castigo ni reputacion, este juego mide preferencias sociales: altruismo, equidad y aversion a la desigualdad.</p>
      </div>
    </div>
  `;

  const slider = root.querySelector("#dictatorGive");
  const feedback = root.querySelector("#dictatorFeedback");
  const update = () => {
    const give = Number(slider.value);
    const keep = 100 - give;
    root.querySelector("#dictatorValue").textContent = give;
    root.querySelector("#dictatorYouText").textContent = keep;
    root.querySelector("#dictatorOtherText").textContent = give;
    root.querySelector("#dictatorYou").style.width = `${keep}%`;
    root.querySelector("#dictatorOther").style.width = `${give}%`;
  };
  slider.addEventListener("input", update);
  root.querySelector("#dictatorSubmit").addEventListener("click", () => {
    const give = Number(slider.value);
    const keep = 100 - give;
    setResult("dictator", keep, { give });
    feedback.textContent = `Confirmado: conservas ${keep} y das ${give}. En clase podemos comparar si el promedio se acerca a 0, 50 o algo intermedio.`;
  });
  update();
}

function renderUltimatum(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Haz una oferta</h3>
        <div class="slider-row">
          <label for="ultimatumOffer">
            <span>Oferta para la otra persona</span>
            <strong><span id="ultimatumValue">40</span> tokens</strong>
          </label>
          <input id="ultimatumOffer" type="range" min="0" max="100" step="5" value="40">
        </div>
        <button class="primary-button" id="ultimatumSubmit">Enviar oferta</button>
        <div class="feedback" id="ultimatumFeedback">La probabilidad de rechazo sube cuando la oferta parece injusta.</div>
      </div>
      <div class="panel">
        <h3>Regla de respuesta</h3>
        <table class="matrix">
          <tr><th>Oferta</th><th>Respuesta probable</th></tr>
          <tr><td>0-15</td><td>Rechazo casi seguro</td></tr>
          <tr><td>20-35</td><td>Riesgo de rechazo</td></tr>
          <tr><td>40-100</td><td>Aceptacion probable</td></tr>
        </table>
      </div>
    </div>
  `;

  const slider = root.querySelector("#ultimatumOffer");
  slider.addEventListener("input", () => {
    root.querySelector("#ultimatumValue").textContent = slider.value;
  });
  root.querySelector("#ultimatumSubmit").addEventListener("click", () => {
    const offer = Number(slider.value);
    const acceptanceChance = offer < 20 ? 0.15 : offer < 40 ? 0.55 : 0.92;
    const accepted = Math.random() < acceptanceChance;
    const payoff = accepted ? 100 - offer : 0;
    setResult("ultimatum", payoff, { offer, accepted });
    root.querySelector("#ultimatumFeedback").textContent = accepted
      ? `Aceptada. Tu pago es ${payoff}; la otra persona recibe ${offer}. La equidad compro silencio al conflicto.`
      : `Rechazada. Ambos reciben 0. Aqui aparece el coste real de castigar una oferta percibida como injusta.`;
  });
}

function renderPublicGoods(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Tu contribucion</h3>
        <div class="slider-row">
          <label for="publicContribution">
            <span>Aportar al fondo comun</span>
            <strong><span id="publicValue">20</span> tokens</strong>
          </label>
          <input id="publicContribution" type="range" min="0" max="50" step="5" value="20">
        </div>
        <button class="primary-button" id="publicSubmit">Jugar ronda</button>
        <div class="feedback" id="publicFeedback">Los otros tres participantes toman decisiones simuladas.</div>
      </div>
      <div class="panel">
        <h3>Formula</h3>
        <p>Cada participante conserva lo no aportado. El fondo comun se multiplica por 1.6 y se reparte entre los cuatro.</p>
        <table class="matrix" id="publicTable">
          <tr><th>Jugador</th><th>Aporta</th></tr>
          <tr><td>Tu</td><td>20</td></tr>
          <tr><td>A</td><td>-</td></tr>
          <tr><td>B</td><td>-</td></tr>
          <tr><td>C</td><td>-</td></tr>
        </table>
      </div>
    </div>
  `;

  const slider = root.querySelector("#publicContribution");
  slider.addEventListener("input", () => {
    root.querySelector("#publicValue").textContent = slider.value;
    root.querySelector("#publicTable").rows[1].cells[1].textContent = slider.value;
  });
  root.querySelector("#publicSubmit").addEventListener("click", () => {
    const mine = Number(slider.value);
    const others = [randomStep(0, 50, 5), randomStep(0, 50, 5), randomStep(0, 50, 5)];
    const totalContribution = mine + others.reduce((sum, value) => sum + value, 0);
    const sharedReturn = Math.round((totalContribution * 1.6) / 4);
    const payoff = 50 - mine + sharedReturn;
    setResult("public", payoff, { mine, others, sharedReturn });
    const rows = root.querySelector("#publicTable").rows;
    rows[2].cells[1].textContent = others[0];
    rows[3].cells[1].textContent = others[1];
    rows[4].cells[1].textContent = others[2];
    root.querySelector("#publicFeedback").textContent = `El grupo aporto ${totalContribution}. Tu retorno comun fue ${sharedReturn}, asi que tu pago final es ${payoff}.`;
  });
}

function renderTrust(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Enviar confianza</h3>
        <div class="slider-row">
          <label for="trustSend">
            <span>Enviar a la pareja</span>
            <strong><span id="trustValue">30</span> tokens</strong>
          </label>
          <input id="trustSend" type="range" min="0" max="100" step="5" value="30">
        </div>
        <div class="choice-row" aria-label="Tipo de pareja simulada">
          <button class="choice-button selected" data-type="fair">Justa</button>
          <button class="choice-button" data-type="selfish">Egoista</button>
          <button class="choice-button" data-type="random">Incierta</button>
        </div>
        <button class="primary-button" id="trustSubmit">Enviar</button>
        <div class="feedback" id="trustFeedback">Elige tambien que tipo de pareja quieres simular.</div>
      </div>
      <div class="panel">
        <h3>Mecanica</h3>
        <p>La cantidad enviada se triplica. La pareja puede devolver una parte. El dilema: mas confianza crea mas valor, pero tambien mas exposicion.</p>
      </div>
    </div>
  `;

  let partnerType = "fair";
  const slider = root.querySelector("#trustSend");
  slider.addEventListener("input", () => {
    root.querySelector("#trustValue").textContent = slider.value;
  });
  root.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      partnerType = button.dataset.type;
      root.querySelectorAll(".choice-button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
  root.querySelector("#trustSubmit").addEventListener("click", () => {
    const sent = Number(slider.value);
    const tripled = sent * 3;
    const returned = calculateReturn(tripled, partnerType);
    const payoff = 100 - sent + returned;
    setResult("trust", payoff, { sent, returned, partnerType });
    root.querySelector("#trustFeedback").textContent = `Enviaste ${sent}; se convirtio en ${tripled}. La pareja devolvio ${returned}. Tu pago final es ${payoff}.`;
  });
}

function renderResults(root) {
  const entries = [
    ["Dictator Game", state.completed.dictator, (r) => `Diste ${r.give} y conservaste ${r.payoff}.`],
    ["Ultimatum Game", state.completed.ultimatum, (r) => `Ofreciste ${r.offer}. Resultado: ${r.accepted ? "aceptado" : "rechazado"}.`],
    ["Public Goods", state.completed.public, (r) => `Aportaste ${r.mine}; retorno comun: ${r.sharedReturn}.`],
    ["Trust Game", state.completed.trust, (r) => `Enviaste ${r.sent}; recibiste ${r.returned} de vuelta.`]
  ];

  root.innerHTML = `
    <div class="panel">
      <h3>Resumen de decisiones</h3>
      <div class="results-grid">
        ${entries.map(([name, result, describe]) => `
          <div class="result-card">
            <strong>${name}</strong>
            <p>${result ? describe(result) : "Pendiente. Juega esta ronda para ver el resultado."}</p>
            <span class="badge">${result ? `${result.payoff} tokens` : "Sin jugar"}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>Preguntas para discusion</h3>
      <table class="matrix">
        <tr><th>Tema</th><th>Pregunta</th></tr>
        <tr><td>Equidad</td><td>Cuando una oferta baja se rechaza, es irracional o expresa una norma social?</td></tr>
        <tr><td>Cooperacion</td><td>Que instituciones aumentarian la contribucion al bien publico?</td></tr>
        <tr><td>Confianza</td><td>Que informacion necesitarias para enviar mas tokens?</td></tr>
      </table>
    </div>
  `;
}

function randomStep(min, max, step) {
  const slots = (max - min) / step;
  return min + Math.round(Math.random() * slots) * step;
}

function calculateReturn(amount, type) {
  if (type === "fair") return Math.round(amount * 0.45);
  if (type === "selfish") return Math.round(amount * 0.12);
  return Math.round(amount * (0.1 + Math.random() * 0.5));
}

render();
