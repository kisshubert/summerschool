const participantCount = document.querySelector("#participantCount");
const adminContent = document.querySelector("#adminContent");
const refreshButton = document.querySelector("#refreshButton");

refreshButton.addEventListener("click", loadResults);
loadResults();
setInterval(loadResults, 10000);

async function loadResults() {
  adminContent.innerHTML = `<div class="feedback">Loading class results...</div>`;
  try {
    const response = await fetch("/api/results");
    if (!response.ok) throw new Error("Could not load results");
    const data = await response.json();
    participantCount.textContent = data.participantCount;
    renderResults(data);
  } catch {
    adminContent.innerHTML = `<div class="feedback error">Could not load results. Check whether the server is running.</div>`;
  }
}

function renderResults(data) {
  adminContent.innerHTML = `
    <div class="results-grid">
      ${metricCard("Dictator Game", data.summary.dictator.count, `Average gift: ${format(data.summary.dictator.averageGive)} tokens`)}
      ${metricCard("Ultimatum Game", data.summary.ultimatum.count, `Average offer: ${format(data.summary.ultimatum.averageOffer)} tokens; acceptance rate: ${formatPercent(data.summary.ultimatum.acceptanceRate)}`)}
      ${metricCard("Public Goods", data.summary.public.count, `Average contribution: ${format(data.summary.public.averageContribution)} tokens`)}
      ${metricCard("Trust Game", data.summary.trust.count, `Average sent: ${format(data.summary.trust.averageSent)} tokens; average returned: ${format(data.summary.trust.averageReturned)} tokens`)}
    </div>

    <div class="panel" style="margin-top:16px">
      <h3>Participant-level decisions</h3>
      <div class="table-wrap">
        <table class="matrix">
          <tr>
            <th>Participant</th>
            <th>Dictator gift</th>
            <th>Ultimatum offer</th>
            <th>Public contribution</th>
            <th>Trust sent</th>
            <th>Total payoff</th>
          </tr>
          ${data.participants.map((participant) => `
            <tr>
              <td>${escapeHtml(participant.label)}</td>
              <td>${valueOrDash(participant.decisions.dictator?.values.give)}</td>
              <td>${valueOrDash(participant.decisions.ultimatum?.values.offer)}</td>
              <td>${valueOrDash(participant.decisions.public?.values.contribution)}</td>
              <td>${valueOrDash(participant.decisions.trust?.values.sent)}</td>
              <td>${participant.total}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    </div>
  `;
}

function metricCard(title, count, detail) {
  return `
    <div class="result-card">
      <strong>${title}</strong>
      <p>${detail}</p>
      <span class="badge">${count} saved decisions</span>
    </div>
  `;
}

function format(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(1);
}

function formatPercent(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function valueOrDash(value) {
  return value === undefined || value === null ? "-" : value;
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
