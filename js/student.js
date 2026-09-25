import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { db, firebaseConfigured } from "./firebase.js";
import { SESSION_ID, DEFAULT_CONFIG } from "./default-config.js";
import { money, safeConfig, getTeam, normalizeInvestments, escapeHtml, hashPin, validInvestments } from "./common.js";

const el = (id) => document.getElementById(id);

let config = structuredClone(DEFAULT_CONFIG);
let selectedTeamId = null;
let selectedPersonNo = null;
let basket = {};
let entered = false;
let enteredPin = "";
let submitting = false;
let submitted = false;
let sessionReady = false;
let entering = false;

function setupError(message) {
  el("setupWarning").textContent = message;
  el("setupWarning").classList.remove("hidden");
}

function applyHeader() {
  el("projectTitle").textContent = config.title;
  document.title = `${config.title} — 모의투자`;
  el("enterButton").disabled = !sessionReady || !config.isOpen || entering;
  el("heroTitle").textContent = config.subtitle || "어떤 사업에 투자하시겠습니까?";
  el("heroDescription").textContent = config.description || "";
  el("budgetText").textContent = money(config.budget);
  el("unitText").textContent = money(config.unit);

  if (!sessionReady && firebaseConfigured()) {
    el("openBadge").textContent = "● 연결 확인 중…";
  } else if (config.isOpen) {
    el("openBadge").textContent = "● 투자 접수 중";
    el("openBadge").style.color = "#087752";
  } else {
    el("openBadge").textContent = "● 현재 접수 마감";
    el("openBadge").style.color = "#b42328";
  }
}

function renderEntryOptions() {
  const currentTeam = el("teamSelect").value;
  el("teamSelect").innerHTML = config.teams
    .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
    .join("");

  if (config.teamIds.includes(currentTeam)) el("teamSelect").value = currentTeam;
  renderPersonOptions();
}

function renderPersonOptions() {
  const previous = el("personSelect").value;
  const teamId = el("teamSelect").value || config.teamIds[0];
  const count = Number(config.teamCounts[teamId] || 1);
  el("personSelect").innerHTML = Array.from({ length: count }, (_, i) =>
    `<option value="${i + 1}">${i + 1}번 투자자</option>`
  ).join("");
  if (Number(previous) >= 1 && Number(previous) <= count) el("personSelect").value = previous;
}

function renderCards() {
  const myTeamId = selectedTeamId;
  el("teamCards").innerHTML = config.teams.map((team) => {
    const mine = team.id === myTeamId;
    return `
      <article class="biz-card ${mine ? "mine" : ""}">
        <div class="biz-cover">
          <span class="badge">${mine ? "MY TEAM" : "INVESTMENT CANDIDATE"}</span>
          <img src="${escapeHtml(team.thumbnail)}" alt="${escapeHtml(team.biz)} 썸네일"
               onerror="this.style.display='none'"/>
        </div>
        <div class="biz-body">
          <div class="small">${escapeHtml(team.name)}</div>
          <h3>${escapeHtml(team.biz)}</h3>
          <div class="desc">${escapeHtml(team.desc)}</div>
          <div class="biz-actions">
            <a class="btn btn-soft" href="${escapeHtml(team.landingUrl)}" target="_blank" rel="noopener"
               style="text-decoration:none">사업 보기</a>
            <button class="btn btn-dark" data-invest-scroll="${escapeHtml(team.id)}" ${mine ? "disabled" : ""}>
              ${mine ? "투자 불가" : "투자하기"}
            </button>
          </div>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-invest-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.investScroll;
      document.getElementById(`invest-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function renderInvestmentRows() {
  el("investArea").innerHTML = config.teams.map((team) => {
    if (team.id === selectedTeamId) return "";
    return `
      <div class="invest-item" id="invest-${escapeHtml(team.id)}">
        <div>
          <div class="invest-name">${escapeHtml(team.name)} · ${escapeHtml(team.biz)}</div>
          <div class="invest-sub">${escapeHtml(team.desc)}</div>
        </div>
        <div class="invest-controls">
          <button class="circle" data-minus="${escapeHtml(team.id)}">−</button>
          <div class="amount-pill" id="amount-${escapeHtml(team.id)}">${money(basket[team.id] || 0)}</div>
          <button class="circle" data-plus="${escapeHtml(team.id)}">＋</button>
        </div>
      </div>`;
  }).join("");

  document.querySelectorAll("[data-minus]").forEach((button) => {
    button.addEventListener("click", () => changeInvestment(button.dataset.minus, -config.unit));
  });
  document.querySelectorAll("[data-plus]").forEach((button) => {
    button.addEventListener("click", () => changeInvestment(button.dataset.plus, config.unit));
  });
}

function changeInvestment(teamId, delta) {
  if (!entered || submitting || submitted || !sessionReady || !config.isOpen || teamId === selectedTeamId) return;
  const used = Object.values(basket).reduce((sum, value) => sum + Number(value || 0), 0);
  const current = Number(basket[teamId] || 0);

  if (delta > 0 && used + delta > config.budget) return;
  basket[teamId] = Math.max(0, current + delta);

  el(`amount-${teamId}`).textContent = money(basket[teamId]);
  updateBudget();
}

function updateBudget() {
  const used = Object.values(basket).reduce((sum, value) => sum + Number(value || 0), 0);
  const remaining = config.budget - used;

  el("usedText").textContent = money(used);
  el("remainingText").textContent = money(remaining);
  el("budgetBar").style.width = `${Math.min(100, (used / config.budget) * 100)}%`;
  document.querySelectorAll("[data-minus]").forEach((button) => {
    button.disabled = submitting || submitted || !sessionReady || !config.isOpen || !basket[button.dataset.minus];
  });
  document.querySelectorAll("[data-plus]").forEach((button) => {
    button.disabled = submitting || submitted || !sessionReady || !config.isOpen || used + config.unit > config.budget;
  });
  el("changeInvestorButton").disabled = submitting;
  el("submitButton").disabled = submitting || submitted || !sessionReady || !config.isOpen;
  el("submitButton").textContent = submitting ? "제출 중…" : submitted ? "제출 완료" : "최종 투자하기";
}

async function enterInvestment() {
  if (entering) return;
  if (!sessionReady || !config.isOpen) {
    el("entryMsg").innerHTML = `<div class="notice error">현재 투자 접수가 마감되어 있습니다.</div>`;
    return;
  }

  const teamId = el("teamSelect").value;
  const personNo = Number(el("personSelect").value);
  const pin = el("pinInput").value.trim();

  if (!config.teamIds.includes(teamId) || !Number.isInteger(personNo) || personNo < 1 || personNo > config.teamCounts[teamId]) return;
  const revision = config.revision;
  entering = true;
  applyHeader();
  let matches = false;
  try {
    matches = /^\d{4,12}$/.test(pin) && await hashPin(SESSION_ID, teamId, pin) === config.teamPinHashes[teamId];
  } catch {
    el("entryMsg").innerHTML = '<div class="notice error">HTTPS 주소로 접속해주세요. PIN 확인을 시작하지 못했습니다.</div>';
    return;
  } finally {
    entering = false;
    applyHeader();
  }
  if (!sessionReady || !config.isOpen || revision !== config.revision) return;
  if (!matches) {
    el("entryMsg").innerHTML = `<div class="notice error">조 PIN이 맞지 않습니다.</div>`;
    return;
  }

  enteredPin = pin;
  submitted = false;
  selectedTeamId = teamId;
  selectedPersonNo = personNo;
  basket = normalizeInvestments(config, {});
  entered = true;

  const team = getTeam(config, teamId);
  el("investorLabel").textContent = `${team.name} · ${personNo}번 투자자 — 자기 조 사업에는 투자할 수 없습니다.`;
  el("entrySection").classList.add("hidden");
  el("investmentApp").classList.remove("hidden");
  el("studentMsg").innerHTML = "";

  renderCards();
  renderInvestmentRows();
  updateBudget();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function leaveInvestment() {
  if (submitting) return;
  entered = false;
  submitted = false;
  enteredPin = "";
  selectedTeamId = null;
  selectedPersonNo = null;
  basket = {};
  el("pinInput").value = "";
  el("investmentApp").classList.add("hidden");
  el("entrySection").classList.remove("hidden");
  el("entryMsg").innerHTML = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitInvestment() {
  if (!db || !entered || submitting || submitted || !sessionReady) return;

  if (!config.isOpen) {
    el("studentMsg").innerHTML = `<div class="notice error">투자 접수가 마감되었습니다.</div>`;
    return;
  }

  const investments = normalizeInvestments(config, basket);
  investments[selectedTeamId] = 0;

  if (!validInvestments(config, selectedTeamId, investments)) {
    el("studentMsg").innerHTML = '<div class="notice error">설정이 변경되었거나 투자 금액이 올바르지 않습니다. 다시 입장해주세요.</div>';
    return;
  }
  const usedAmount = Object.values(investments).reduce((sum, value) => sum + Number(value || 0), 0);
  const remaining = config.budget - usedAmount;

  if (remaining > 0) {
    const ok = confirm(`${money(remaining)}이 남아 있습니다.\n남은 금액을 투자하지 않고 제출할까요?`);
    if (!ok) return;
  }

  submitting = true;
  updateBudget();
  const submitButton = el("submitButton");
  submitButton.disabled = true;
  submitButton.textContent = "제출 중…";
  el("studentMsg").innerHTML = "";

  const submissionId = `${selectedTeamId}-${String(selectedPersonNo).padStart(2, "0")}`;
  const submissionRef = doc(db, "sessions", SESSION_ID, "submissions", submissionId);

  try {
    await setDoc(submissionRef, {
      sessionId: SESSION_ID,
      revision: config.revision,
      pin: enteredPin,
      teamId: selectedTeamId,
      personNo: selectedPersonNo,
      investments,
      usedAmount,
      remainingAmount: remaining,
      createdAt: serverTimestamp()
    });

    submitted = true;
    el("studentMsg").innerHTML =
      `<div class="notice ok">✓ 투자 제출이 완료되었습니다. 결과 발표를 기다려주세요.</div>`;
    submitButton.textContent = "제출 완료";
  } catch (error) {
    console.error(error);
    submitButton.disabled = false;
    submitButton.textContent = "최종 투자하기";

    if (error?.code === "permission-denied") {
      el("studentMsg").innerHTML =
        `<div class="notice error">제출할 수 없습니다. 이미 제출한 번호이거나 접수 마감·PIN/설정 변경으로 제출이 거절되었습니다. 관리자에게 확인해주세요.</div>`;
    } else {
      el("studentMsg").innerHTML =
        `<div class="notice error">제출 중 오류가 발생했습니다. 인터넷 연결과 Firebase 설정을 확인해주세요.</div>`;
    }
  } finally {
    submitting = false;
    updateBudget();
    if (!submitted && (!sessionReady || !config.isOpen)) {
      leaveInvestment();
      el("entryMsg").innerHTML = '<div class="notice error">접수 상태를 확인하고 다시 입장해주세요.</div>';
    }
  }
}

function start() {
  el("teamSelect").addEventListener("change", renderPersonOptions);
  el("enterButton").addEventListener("click", enterInvestment);
  el("changeInvestorButton").addEventListener("click", leaveInvestment);
  el("submitButton").addEventListener("click", submitInvestment);

  if (!firebaseConfigured()) {
    setupError("Firebase 설정이 아직 입력되지 않았습니다. js/firebase-config.js에 Firebase 웹 앱 설정값을 붙여 넣으세요.");
    config = safeConfig(DEFAULT_CONFIG, DEFAULT_CONFIG);
    applyHeader();
    renderEntryOptions();
    return;
  }

  const sessionRef = doc(db, "sessions", SESSION_ID);

  onSnapshot(sessionRef, { includeMetadataChanges: true }, (snapshot) => {
    const previousRevision = config.revision;
    sessionReady = snapshot.exists() && !snapshot.metadata.fromCache;
    if (!snapshot.exists()) {
      setupError("관리자가 아직 세션을 생성하지 않았습니다. admin.html에서 로그인 후 ‘기본 세션 만들기’를 눌러주세요.");
      config = safeConfig(DEFAULT_CONFIG, DEFAULT_CONFIG);
    } else {
      el("setupWarning").classList.add("hidden");
      config = safeConfig(snapshot.data(), DEFAULT_CONFIG);
    }

    applyHeader();
    renderEntryOptions();

    if (entered) {
      const maxPerson = Number(config.teamCounts[selectedTeamId] || 0);
      if (!submitted && (!config.teamIds.includes(selectedTeamId) || selectedPersonNo > maxPerson || !config.isOpen || previousRevision !== config.revision)) {
        leaveInvestment();
        el("entryMsg").innerHTML = '<div class="notice info">프로젝트 설정 또는 접수 상태가 변경되었습니다. 다시 입장해주세요.</div>';
      } else {
        renderCards();
        renderInvestmentRows();
        updateBudget();
      }
    }
  }, (error) => {
    console.error(error);
    sessionReady = false;
    config.isOpen = false;
    applyHeader();
    leaveInvestment();
    setupError("Firebase 세션 설정을 읽지 못했습니다. Firestore 생성 여부와 보안 규칙을 확인해주세요.");
  });
}

start();
