const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "decisions.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

ensureDataFile();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return sendJson(response, 200, { ok: true });
    }

    if (url.pathname === "/api/session" && request.method === "POST") {
      return handleCreateSession(request, response);
    }

    if (url.pathname.startsWith("/api/participant/") && request.method === "GET") {
      return handleParticipant(url, response);
    }

    if (url.pathname === "/api/decision" && request.method === "POST") {
      return handleDecision(request, response);
    }

    if (url.pathname === "/api/results" && request.method === "GET") {
      return handleResults(response);
    }

    if (url.pathname === "/api/export.csv" && request.method === "GET") {
      return handleExport(response);
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Summer School Games running on http://localhost:${PORT}`);
});

function handleCreateSession(request, response) {
  readJsonBody(request, (error, body) => {
    if (error) return sendJson(response, 400, { error: "Invalid JSON" });

    const name = String(body.name || "").trim();
    if (!name) return sendJson(response, 400, { error: "Participant name is required" });

    const data = readData();
    const participant = {
      id: crypto.randomUUID(),
      label: name.slice(0, 80),
      createdAt: new Date().toISOString()
    };
    data.participants.push(participant);
    writeData(data);
    return sendJson(response, 201, participant);
  });
}

function handleParticipant(url, response) {
  const participantId = decodeURIComponent(url.pathname.replace("/api/participant/", ""));
  const data = readData();
  const participant = data.participants.find((item) => item.id === participantId);
  if (!participant) return sendJson(response, 404, { error: "Participant not found" });

  const decisions = decisionsForParticipant(data, participantId);
  return sendJson(response, 200, {
    ...participant,
    decisions,
    total: totalPayoff(decisions)
  });
}

function handleDecision(request, response) {
  readJsonBody(request, (error, body) => {
    if (error) return sendJson(response, 400, { error: "Invalid JSON" });

    const data = readData();
    const participant = data.participants.find((item) => item.id === body.participantId);
    if (!participant) return sendJson(response, 404, { error: "Participant not found" });

    const result = calculateDecision(body.game, body.values || {});
    if (!result) return sendJson(response, 400, { error: "Unknown or invalid game decision" });

    data.decisions = data.decisions.filter((decision) => {
      return !(decision.participantId === participant.id && decision.game === body.game);
    });

    const decision = {
      id: crypto.randomUUID(),
      participantId: participant.id,
      participantLabel: participant.label,
      game: body.game,
      values: result.values,
      outcome: result.outcome,
      payoff: result.payoff,
      createdAt: new Date().toISOString()
    };

    data.decisions.push(decision);
    writeData(data);

    const decisions = decisionsForParticipant(data, participant.id);
    return sendJson(response, 200, {
      decision,
      total: totalPayoff(decisions),
      message: result.message
    });
  });
}

function handleResults(response) {
  const data = readData();
  return sendJson(response, 200, buildResults(data));
}

function handleExport(response) {
  const data = buildResults(readData());
  const rows = [
    ["participant", "dictator_give", "ultimatum_offer", "ultimatum_accepted", "public_contribution", "trust_sent", "trust_returned", "total_payoff"]
  ];

  data.participants.forEach((participant) => {
    rows.push([
      participant.label,
      participant.decisions.dictator?.values.give ?? "",
      participant.decisions.ultimatum?.values.offer ?? "",
      participant.decisions.ultimatum?.outcome.accepted ?? "",
      participant.decisions.public?.values.contribution ?? "",
      participant.decisions.trust?.values.sent ?? "",
      participant.decisions.trust?.outcome.returned ?? "",
      participant.total
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"summer-school-results.csv\""
  });
  response.end(csv);
}

function calculateDecision(game, values) {
  if (game === "dictator") {
    const give = boundedStep(values.give, 0, 100, 5);
    if (give === null) return null;
    const payoff = 100 - give;
    return {
      values: { give },
      outcome: { otherReceives: give },
      payoff,
      message: `Saved: you kept ${payoff} tokens and gave ${give} tokens to the other participant.`
    };
  }

  if (game === "ultimatum") {
    const offer = boundedStep(values.offer, 0, 100, 5);
    if (offer === null) return null;
    const acceptanceChance = offer < 20 ? 0.15 : offer < 40 ? 0.55 : 0.92;
    const accepted = Math.random() < acceptanceChance;
    const payoff = accepted ? 100 - offer : 0;
    return {
      values: { offer },
      outcome: { accepted, responderReceives: accepted ? offer : 0 },
      payoff,
      message: accepted
        ? `Accepted. You receive ${payoff} tokens and the responder receives ${offer}.`
        : "Rejected. Both players receive 0 tokens."
    };
  }

  if (game === "public") {
    const contribution = boundedStep(values.contribution, 0, 50, 5);
    if (contribution === null) return null;
    const others = [randomStep(0, 50, 5), randomStep(0, 50, 5), randomStep(0, 50, 5)];
    const totalContribution = contribution + others.reduce((sum, value) => sum + value, 0);
    const sharedReturn = Math.round((totalContribution * 1.6) / 4);
    const payoff = 50 - contribution + sharedReturn;
    return {
      values: { contribution },
      outcome: { others, totalContribution, sharedReturn },
      payoff,
      message: `Saved. The group contributed ${totalContribution}; your final payoff is ${payoff} tokens.`
    };
  }

  if (game === "trust") {
    const sent = boundedStep(values.sent, 0, 100, 5);
    if (sent === null) return null;
    const tripled = sent * 3;
    const returned = Math.round(tripled * (0.15 + Math.random() * 0.4));
    const payoff = 100 - sent + returned;
    return {
      values: { sent },
      outcome: { tripled, returned },
      payoff,
      message: `Saved. You sent ${sent}, it became ${tripled}, and the partner returned ${returned}. Your payoff is ${payoff}.`
    };
  }

  return null;
}

function buildResults(data) {
  const participants = data.participants.map((participant) => {
    const decisions = decisionsForParticipant(data, participant.id);
    return {
      ...participant,
      decisions,
      total: totalPayoff(decisions)
    };
  });

  return {
    participantCount: participants.length,
    participants,
    summary: {
      dictator: summarize(participants, "dictator", "give"),
      ultimatum: summarizeUltimatum(participants),
      public: summarize(participants, "public", "contribution"),
      trust: summarizeTrust(participants)
    }
  };
}

function summarize(participants, game, valueKey) {
  const values = participants
    .map((participant) => participant.decisions[game]?.values[valueKey])
    .filter((value) => typeof value === "number");
  return {
    count: values.length,
    [`average${capitalize(valueKey)}`]: average(values)
  };
}

function summarizeUltimatum(participants) {
  const decisions = participants.map((participant) => participant.decisions.ultimatum).filter(Boolean);
  return {
    count: decisions.length,
    averageOffer: average(decisions.map((decision) => decision.values.offer)),
    acceptanceRate: average(decisions.map((decision) => decision.outcome.accepted ? 1 : 0))
  };
}

function summarizeTrust(participants) {
  const decisions = participants.map((participant) => participant.decisions.trust).filter(Boolean);
  return {
    count: decisions.length,
    averageSent: average(decisions.map((decision) => decision.values.sent)),
    averageReturned: average(decisions.map((decision) => decision.outcome.returned))
  };
}

function decisionsForParticipant(data, participantId) {
  return data.decisions
    .filter((decision) => decision.participantId === participantId)
    .reduce((memo, decision) => {
      memo[decision.game] = decision;
      return memo;
    }, {});
}

function totalPayoff(decisions) {
  return Object.values(decisions).reduce((sum, decision) => sum + Number(decision.payoff || 0), 0);
}

function serveStatic(urlPath, response) {
  const safePath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      return response.end("Not found");
    }
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, callback) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) request.destroy();
  });
  request.on("end", () => {
    try {
      callback(null, JSON.parse(body || "{}"));
    } catch (error) {
      callback(error);
    }
  });
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ participants: [], decisions: [] }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function boundedStep(value, min, max, step) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < min || number > max) return null;
  if ((number - min) % step !== 0) return null;
  return number;
}

function randomStep(min, max, step) {
  const slots = (max - min) / step;
  return min + Math.round(Math.random() * slots) * step;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function csvCell(value) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
