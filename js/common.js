export function money(n) {
  n = Math.round(Number(n || 0));
  if (n >= 100000000 && n % 100000000 === 0) {
    const v = n / 100000000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}억원`;
  }
  if (n >= 10000000 && n % 10000000 === 0) {
    const v = n / 10000000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}천만원`;
  }
  if (n >= 10000 && n % 10000 === 0) return `${(n / 10000).toLocaleString("ko-KR")}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

export function safeConfig(raw, fallback) {
  if (!raw) return structuredClone(fallback);

  const config = {
    ...structuredClone(fallback),
    ...raw,
    teamCounts: { ...fallback.teamCounts, ...(raw.teamCounts || {}) },
    teamPinHashes: { ...fallback.teamPinHashes, ...(raw.teamPinHashes || {}) }
  };

  const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];
  config.teams = fallback.teams.map((team, i) => ({
    ...team,
    ...(rawTeams[i] || {}),
    id: team.id,
    landingUrl: safeUrl(rawTeams[i]?.landingUrl, team.landingUrl),
    thumbnail: safeUrl(rawTeams[i]?.thumbnail, team.thumbnail)
  }));

  config.teamIds = config.teams.map((t) => t.id);
  return config;
}

export function getTeam(config, id) {
  return config.teams.find((t) => t.id === id);
}

export function normalizeInvestments(config, investments = {}) {
  const out = {};
  for (const id of config.teamIds) out[id] = Math.max(0, Number(investments[id] || 0));
  return out;
}

export function calculateRanking(config, submissions) {
  const list = Array.isArray(submissions) ? submissions : [];

  return config.teams
    .map((team) => {
      let total = 0;
      let eligible = 0;

      for (const submission of list) {
        if (submission.teamId !== team.id) {
          eligible += 1;
          total += Number((submission.investments || {})[team.id] || 0);
        }
      }

      return {
        team,
        total,
        eligible,
        avg: eligible ? total / eligible : 0
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.avg !== a.avg) return b.avg - a.avg;
      return a.team.name.localeCompare(b.team.name, "ko");
    });
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let audioContext;

// Called directly inside the result button's click handler (required on iOS).
export function prepareAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    return audioContext.resume().catch(() => {});
  } catch { /* Audio is optional; results still work. */ }
}

export function fanfare() {
  try {
    const ctx = audioContext;
    if (!ctx) return;
    const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    notes.forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = i < 4 ? "triangle" : "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.21);

      osc.start(start);
      osc.stop(start + 0.23);
    });
  } catch (error) {
    console.warn("Fanfare unavailable", error);
  }
}

export function confetti() {
  const chars = ["🎉", "✨", "🎊", "⭐", "◆", "●"];
  for (let i = 0; i < 90; i += 1) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.textContent = chars[i % chars.length];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDelay = `${Math.random() * 0.7}s`;
    piece.style.fontSize = `${12 + Math.random() * 15}px`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell ?? "");
          if (typeof cell === "string" && /^[\s]*[=+@-]/.test(value)) value = "'" + value;
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Relative paths stay relative to index.html/admin.html, including /repo/ on Pages.
export function safeUrl(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text || /[\x00-\x20\\]/.test(text) || text.startsWith("/")) return fallback;
  if (/^[a-z][a-z\d+.-]*:/i.test(text)) {
    try { return new URL(text).protocol === "https:" ? text : fallback; }
    catch { return fallback; }
  }
  return text;
}

export async function hashPin(sessionId, teamId, pin) {
  const data = new TextEncoder().encode(`${sessionId}:${teamId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateConfig(config, pins) {
  if (!Number.isSafeInteger(config.budget) || config.budget < 1 || config.budget > 1e12)
    throw new Error("투자 한도는 1원~1조원 사이의 정수로 입력해주세요.");
  if (!Number.isSafeInteger(config.unit) || config.unit < 1 || config.unit > config.budget)
    throw new Error("투자 단위는 1원 이상, 투자 한도 이하의 정수로 입력해주세요.");
  for (const team of config.teams) {
    const count = config.teamCounts[team.id];
    if (!Number.isInteger(count) || count < 1 || count > 99)
      throw new Error(`${team.name}: 인원수는 1~99명 사이의 정수로 입력해주세요.`);
    if (pins && !/^\d{4,12}$/.test(pins[team.id] || ""))
      throw new Error(`${team.name}: PIN은 숫자 4~12자리로 입력해주세요.`);
    if (!safeUrl(team.landingUrl) || !safeUrl(team.thumbnail))
      throw new Error(`${team.name}: 주소는 https://로 시작하거나 landing/team1.html 같은 상대경로여야 합니다.`);
  }
}

export function validInvestments(config, teamId, investments) {
  return config.teamIds.includes(teamId) && investments[teamId] === 0 &&
    Object.keys(investments).length === 4 && config.teamIds.every((id) =>
      Number.isSafeInteger(investments[id]) && investments[id] >= 0 && investments[id] % config.unit === 0) &&
    Object.values(investments).reduce((sum, value) => sum + value, 0) <= config.budget;
}
