const games = {
  dictator: {
    title: "Dictator Game",
    intro: "You receive 100 tokens. Decide how many tokens to give to an anonymous participant. They cannot respond.",
    render: renderDictator
  },
  ultimatum: {
    title: "Ultimatum Game",
    intro: "Propose a split of 100 tokens. If the responder accepts, both players are paid. If they reject, both receive zero.",
    render: renderUltimatum
  },
  public: {
    title: "Public Goods Game",
    intro: "Four participants receive 50 tokens. Contributions to the public account are multiplied and shared equally.",
    render: renderPublicGoods
  },
  trust: {
    title: "Trust Game",
    intro: "Send tokens to an anonymous partner. The sent amount is tripled, and the partner decides how much to return.",
    render: renderTrust
  },
  results: {
    title: "My Results",
    intro: "Review your saved decisions before the class discussion.",
    render: renderResults
  }
};

const state = {
  current: "dictator",
  participant: null,
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

init();

async function init() {
  const saved = localStorage.getItem("summerSchoolParticipant");
  if (saved) {
    state.participant = JSON.parse(saved);
    await loadParticipantResults();
  }
  bindNavigation();
  render();
}

function bindNavigation() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.current = button.dataset.game;
      render();
    });
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("summerSchoolParticipant");
    state.participant = null;
    state.total = 0;
    Object.keys(state.completed).forEach((key) => {
      state.completed[key] = null;
    });
    state.current = "dictator";
    render();
  });
}

async function loadParticipantResults() {
  if (!state.participant) return;
  try {
    const response = await fetch(`/api/participant/${state.participant.id}`);
    if (!response.ok) return;
    const data = await response.json();
    Object.keys(state.completed).forEach((key) => {
      state.completed[key] = data.decisions[key] || null;
    });
    state.total = data.total || 0;
    totalPayoff.textContent = state.total;
  } catch {
    showNetworkWarning();
  }
}

function render() {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.game === state.current);
  });
  totalPayoff.textContent = state.total;

  if (!state.participant) {
    renderJoin();
    return;
  }

  const game = games[state.current];
  stage.innerHTML = `
    <div class="game-header">
      <div>
        <span class="badge">${escapeHtml(state.participant.label)}</span>
        <h2>${game.title}</h2>
        <p>${game.intro}</p>
      </div>
      <div class="visual" aria-hidden="true">${coinStack(7)}</div>
    </div>
    <div id="gameBody"></div>
  `;
  game.render(document.querySelector("#gameBody"));
}

function renderJoin() {
  stage.innerHTML = `
    <div class="join-screen">
      <span class="badge">Live classroom session</span>
      <h2>Join the experiment</h2>
      <p>Enter a nickname or participant code. Your choices will be saved anonymously for the instructor's aggregate results.</p>
      <form id="joinForm" class="join-form">
        <label for="participantName">Participant name or code</label>
        <input id="participantName" name="participantName" type="text" autocomplete="name" maxlength="80" required placeholder="e.g. Student 12">
        <button class="primary-button" type="submit">Start</button>
      </form>
      <p class="small-note">Use one device per participant. If you refresh the page, your device will keep the same participant session.</p>
    </div>
  `;

  document.querySelector("#joinForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#participantName").value.trim();
    if (!name) return;
    const button = event.submitter;
    button.disabled = true;
    button.textContent = "Joining...";
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Could not create session");
      state.participant = await response.json();
      localStorage.setItem("summerSchoolParticipant", JSON.stringify(state.participant));
      await loadParticipantResults();
      render();
    } catch {
      button.disabled = false;
      button.textContent = "Start";
      stage.querySelector(".join-screen").insertAdjacentHTML("beforeend", `<div class="feedback error">Could not connect to the classroom server. Please try again.</div>`);
    }
  });
}

function coinStack(count) {
  return `<div class="coin-stack">${Array.from({ length: count }, () => '<span class="coin"></span>').join("")}</div>`;
}

async function saveDecision(game, values, feedbackNode) {
  if (!state.participant) return;
  feedbackNode.textContent = "Saving decision...";
  feedbackNode.classList.remove("error");

  try {
    const response = await fetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: state.participant.id,
        game,
        values
      })
    });
    if (!response.ok) throw new Error("Save failed");
    const data = await response.json();
    state.completed[game] = data.decision;
    state.total = data.total;
    totalPayoff.textContent = state.total;
    feedbackNode.textContent = data.message;
  } catch {
    feedbackNode.classList.add("error");
    feedbackNode.textContent = "The decision could not be saved. Please check the connection and try again.";
  }
}

function renderDictator(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Your decision</h3>
        <div class="slider-row">
          <label for="dictatorGive">
            <span>Give to the other participant</span>
            <strong><span id="dictatorValue">30</span> tokens</strong>
          </label>
          <input id="dictatorGive" type="range" min="0" max="100" step="5" value="${state.completed.dictator?.values.give ?? 30}">
        </div>
        <div class="split-view">
          <div class="person">
            <strong>Your payoff</strong>
            <div class="meter"><span id="dictatorYou"></span></div>
            <p><span id="dictatorYouText">70</span> tokens</p>
          </div>
          <div class="person">
            <strong>Other participant</strong>
            <div class="meter"><span id="dictatorOther"></span></div>
            <p><span id="dictatorOtherText">30</span> tokens</p>
          </div>
        </div>
        <button class="primary-button" id="dictatorSubmit">Save decision</button>
        <div class="feedback" id="dictatorFeedback">${savedText("dictator")}</div>
      </div>
      <div class="panel">
        <h3>Discussion prompt</h3>
        <p>With no punishment or reputation, this game measures social preferences: altruism, fairness, and inequality aversion.</p>
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
    saveDecision("dictator", { give: Number(slider.value) }, feedback);
  });
  update();
}

function renderUltimatum(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Make an offer</h3>
        <div class="slider-row">
          <label for="ultimatumOffer">
            <span>Offer to the responder</span>
            <strong><span id="ultimatumValue">40</span> tokens</strong>
          </label>
          <input id="ultimatumOffer" type="range" min="0" max="100" step="5" value="${state.completed.ultimatum?.values.offer ?? 40}">
        </div>
        <button class="primary-button" id="ultimatumSubmit">Save offer</button>
        <div class="feedback" id="ultimatumFeedback">${savedText("ultimatum")}</div>
      </div>
      <div class="panel">
        <h3>Responder rule</h3>
        <table class="matrix">
          <tr><th>Offer</th><th>Likely response</th></tr>
          <tr><td>0-15</td><td>Very likely rejection</td></tr>
          <tr><td>20-35</td><td>Risk of rejection</td></tr>
          <tr><td>40-100</td><td>Likely acceptance</td></tr>
        </table>
      </div>
    </div>
  `;

  const slider = root.querySelector("#ultimatumOffer");
  const feedback = root.querySelector("#ultimatumFeedback");
  const update = () => {
    root.querySelector("#ultimatumValue").textContent = slider.value;
  };
  slider.addEventListener("input", update);
  root.querySelector("#ultimatumSubmit").addEventListener("click", () => {
    saveDecision("ultimatum", { offer: Number(slider.value) }, feedback);
  });
  update();
}

function renderPublicGoods(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Your contribution</h3>
        <div class="slider-row">
          <label for="publicContribution">
            <span>Contribute to the public account</span>
            <strong><span id="publicValue">20</span> tokens</strong>
          </label>
          <input id="publicContribution" type="range" min="0" max="50" step="5" value="${state.completed.public?.values.contribution ?? 20}">
        </div>
        <button class="primary-button" id="publicSubmit">Save contribution</button>
        <div class="feedback" id="publicFeedback">${savedText("public")}</div>
      </div>
      <div class="panel">
        <h3>Mechanism</h3>
        <p>Each participant keeps what they do not contribute. The public account is multiplied by 1.6 and shared equally among the four participants.</p>
      </div>
    </div>
  `;

  const slider = root.querySelector("#publicContribution");
  const feedback = root.querySelector("#publicFeedback");
  const update = () => {
    root.querySelector("#publicValue").textContent = slider.value;
  };
  slider.addEventListener("input", update);
  root.querySelector("#publicSubmit").addEventListener("click", () => {
    saveDecision("public", { contribution: Number(slider.value) }, feedback);
  });
  update();
}

function renderTrust(root) {
  root.innerHTML = `
    <div class="decision-grid">
      <div class="panel">
        <h3>Send trust</h3>
        <div class="slider-row">
          <label for="trustSend">
            <span>Send to the partner</span>
            <strong><span id="trustValue">30</span> tokens</strong>
          </label>
          <input id="trustSend" type="range" min="0" max="100" step="5" value="${state.completed.trust?.values.sent ?? 30}">
        </div>
        <button class="primary-button" id="trustSubmit">Save transfer</button>
        <div class="feedback" id="trustFeedback">${savedText("trust")}</div>
      </div>
      <div class="panel">
        <h3>Mechanism</h3>
        <p>The amount sent is tripled. The partner may return part of it. The dilemma: more trust creates more value, but also more exposure.</p>
      </div>
    </div>
  `;

  const slider = root.querySelector("#trustSend");
  const feedback = root.querySelector("#trustFeedback");
  const update = () => {
    root.querySelector("#trustValue").textContent = slider.value;
  };
  slider.addEventListener("input", update);
  root.querySelector("#trustSubmit").addEventListener("click", () => {
    saveDecision("trust", { sent: Number(slider.value) }, feedback);
  });
  update();
}

function renderResults(root) {
  const entries = [
    ["Dictator Game", state.completed.dictator, (r) => `You gave ${r.values.give} and kept ${r.payoff}.`],
    ["Ultimatum Game", state.completed.ultimatum, (r) => `You offered ${r.values.offer}. Outcome: ${r.outcome.accepted ? "accepted" : "rejected"}.`],
    ["Public Goods", state.completed.public, (r) => `You contributed ${r.values.contribution}. Your simulated group return was ${r.outcome.sharedReturn}.`],
    ["Trust Game", state.completed.trust, (r) => `You sent ${r.values.sent}; the partner returned ${r.outcome.returned}.`]
  ];

  root.innerHTML = `
    <div class="panel">
      <h3>Saved decisions</h3>
      <div class="results-grid">
        ${entries.map(([name, result, describe]) => `
          <div class="result-card">
            <strong>${name}</strong>
            <p>${result ? describe(result) : "Pending. Play this round to save a result."}</p>
            <span class="badge">${result ? `${result.payoff} tokens` : "Not saved"}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>Class discussion</h3>
      <table class="matrix">
        <tr><th>Theme</th><th>Question</th></tr>
        <tr><td>Fairness</td><td>When a low offer is rejected, is it irrational, or does it express a social norm?</td></tr>
        <tr><td>Cooperation</td><td>Which institutions would increase contributions to the public good?</td></tr>
        <tr><td>Trust</td><td>What information would make you send more tokens?</td></tr>
      </table>
    </div>
  `;
}

function savedText(game) {
  const result = state.completed[game];
  if (!result) return "Move the control, then save your decision.";
  return `Saved. Your payoff for this game is ${result.payoff} tokens. You can update the decision before the instructor closes the activity.`;
}

function showNetworkWarning() {
  stage.innerHTML = `<div class="feedback error">The classroom server is not available. Please reload the page or ask the instructor for the correct link.</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
