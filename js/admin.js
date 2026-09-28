import {
  doc,
  collection,
  onSnapshot,
  updateDoc,
  getDocsFromServer,
  getDocFromServer,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { db, auth, firebaseConfigured } from "./firebase.js";
import { SESSION_ID, DEFAULT_CONFIG } from "./default-config.js";
import {
  money,
  safeConfig,
  calculateRanking,
  escapeHtml,
  fanfare,
  prepareAudio,
  hashPin,
  validateConfig,
  confetti,
  downloadCsv
} from "./common.js";

const el = (id) => document.getElementById(id);

let config = structuredClone(DEFAULT_CONFIG);
let submissions = [];
let sessionExists = false;
let unsubscribeSession = null;
let unsubscribeSubmissions = null;
let teamPins = {};
let busy = false;
let formDirty = false;
let submissionsReady = false;
let configReady = false;
let authGeneration = 0;
let sessionGeneration = 0;
let revealTimers = [];

function clearResults() {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  el("resultArea").innerHTML = "";
}

function setBusy(value) {
  busy = value;
  for (const id of ["saveAllButton", "toggleOpenButton", "resetButton", "exportButton", "revealButton", "createSessionButton", "logoutButton"]) {
    el(id).disabled = value;
  }
  el("saveAllButton").disabled = value || config.isOpen || !configReady;
  el("saveAllButton").disabled ||= !submissionsReady;
  el("toggleOpenButton").disabled = value || !configReady;
  for (const id of ["resetButton", "exportButton", "revealButton"]) {
    el(id).disabled = value || !configReady || !submissionsReady;
  }
}

function reportError(error, fallback) {
  console.error(error);
  message("adminMsg", error?.code ? fallback : error.message || fallback, "error");
}


function message(target, text, type = "info") {
  el(target).innerHTML = `<div class="notice ${type}">${escapeHtml(text)}</div>`;
}

function setupError(text) {
  el("setupWarning").textContent = text;
  el("setupWarning").classList.remove("hidden");
}

function renderTeamEditors() {
  el("teamEditors").innerHTML = config.teams.map((team, index) => `
    <section class="team-editor-card" data-team-index="${index}">
      <h4>${escapeHtml(team.name)} · ${escapeHtml(team.biz)}</h4>
      <div class="field">
        <label>조 이름</label>
        <input data-field="name" value="${escapeHtml(team.name)}"/>
      </div>
      <div class="field">
        <label>인원수</label>
        <input data-field="people" type="number" min="1" max="99" value="${Number(config.teamCounts[team.id] || 1)}"/>
      </div>
      <div class="field">
        <label>조 PIN</label>
        <input data-field="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" value="${escapeHtml(teamPins[team.id] || "")}"/>
      </div>
      <div class="field">
        <label>사업명</label>
        <input data-field="biz" value="${escapeHtml(team.biz)}"/>
      </div>
      <div class="field">
        <label>사업 설명</label>
        <textarea data-field="desc">${escapeHtml(team.desc)}</textarea>
      </div>
      <div class="field">
        <label>랜딩페이지 주소</label>
        <input data-field="landingUrl" value="${escapeHtml(team.landingUrl)}"/>
      </div>
      <div class="field">
        <label>썸네일 주소</label>
        <input data-field="thumbnail" value="${escapeHtml(team.thumbnail)}"/>
      </div>
    </section>
  `).join("");
}

function renderConfigForm() {
  el("titleInput").value = config.title || "";
  el("subtitleInput").value = config.subtitle || "";
  el("descriptionInput").value = config.description || "";
  el("budgetInput").value = Number(config.budget || 0);
  el("unitInput").value = Number(config.unit || 0);
  el("sessionIdView").value = SESSION_ID;

  el("openStateText").textContent = config.isOpen
    ? "현재 학생 제출을 받고 있습니다."
    : "현재 학생 제출이 마감되어 있습니다.";

  el("toggleOpenButton").textContent = config.isOpen ? "투자 접수 마감" : "투자 접수 열기";
  el("toggleOpenButton").className = `btn ${config.isOpen ? "btn-danger" : "btn-success"}`;

  renderTeamEditors();
  document.querySelectorAll("#teamEditors input, #teamEditors textarea, #titleInput, #subtitleInput, #descriptionInput, #budgetInput, #unitInput").forEach((input) => {
    input.disabled = config.isOpen;
  });
  setBusy(busy);
}

function renderStatus() {
  el("statusCards").innerHTML = config.teams.map((team) => {
    const count = submissions.filter((s) => s.teamId === team.id).length;
    const total = Number(config.teamCounts[team.id] || 1);
    const pct = Math.min(100, (count / total) * 100);

    return `
      <div class="status-card">
        <div class="small">${escapeHtml(team.name)} · ${escapeHtml(team.biz)}</div>
        <div class="num">${count}<span style="font-size:15px;color:var(--muted)"> / ${total}명</span></div>
        <div class="bar"><div style="width:${pct}%"></div></div>
      </div>`;
  }).join("");
}

function renderSubmissions() {
  const teamName = (id) => config.teams.find((t) => t.id === id)?.name || id;

  const rows = [...submissions]
    .sort((a, b) => {
      if (a.teamId !== b.teamId) return a.teamId.localeCompare(b.teamId);
      return Number(a.personNo) - Number(b.personNo);
    })
    .map((s) => {
      const details = config.teams
        .filter((team) => team.id !== s.teamId)
        .map((team) => `${team.name} ${money((s.investments || {})[team.id] || 0)}`)
        .join(" / ");

      return `
        <tr>
          <td>${escapeHtml(teamName(s.teamId))}</td>
          <td>${Number(s.personNo)}번</td>
          <td>${money(s.usedAmount)}</td>
          <td>${money(s.remainingAmount)}</td>
          <td>${escapeHtml(details)}</td>
        </tr>`;
    })
    .join("");

  el("submissionsTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>소속</th>
          <th>투자자</th>
          <th>사용액</th>
          <th>미사용액</th>
          <th>투자 배분</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5">아직 제출이 없습니다.</td></tr>`}</tbody>
    </table>`;
}

function collectConfigFromForm() {
  const next = structuredClone(config);
  next.title = el("titleInput").value.trim() || "Venture Pick";
  next.subtitle = el("subtitleInput").value.trim() || "어떤 사업에 투자하시겠습니까?";
  next.description = el("descriptionInput").value.trim();
  next.budget = Number(el("budgetInput").value);
  next.unit = Number(el("unitInput").value);
  const pins = {};
  next.sessionId = SESSION_ID;

  document.querySelectorAll("[data-team-index]").forEach((card) => {
    const index = Number(card.dataset.teamIndex);
    const team = next.teams[index];
    const get = (field) => card.querySelector(`[data-field="${field}"]`);

    team.name = get("name").value.trim() || `조 ${index + 1}`;
    team.biz = get("biz").value.trim() || `사업 ${index + 1}`;
    team.desc = get("desc").value.trim();
    team.landingUrl = get("landingUrl").value.trim() || `landing/team${index + 1}.html`;
    team.thumbnail = get("thumbnail").value.trim() || `assets/team${index + 1}.svg`;

    next.teamCounts[team.id] = Number(get("people").value);
    pins[team.id] = get("pin").value.trim();
  });

  next.teamIds = next.teams.map((t) => t.id);
  validateConfig(next, pins);
  return { next, pins };
}

async function saveConfig() {
  if (busy || !configReady || !submissionsReady) return;
  if (config.isOpen) return message("adminMsg", "접수를 마감한 뒤 설정을 수정해주세요.", "error");
  setBusy(true);
  try {
    const { next, pins } = collectConfigFromForm();
    // Once voting has started, keep the financial conditions consistent for all voters.
    if (next.budget !== config.budget || next.unit !== config.unit ||
        JSON.stringify(next.teamCounts) !== JSON.stringify(config.teamCounts)) {
      const votes = await getDocsFromServer(collection(db, "sessions", SESSION_ID, "submissions"));
      if (!votes.empty) throw new Error("제출이 있습니다. 한도·투자 단위·인원수 변경은 CSV 저장 후 제출 초기화를 먼저 해주세요.");
    }
    next.revision = crypto.randomUUID();
    next.updatedAt = serverTimestamp();
    for (const team of next.teams) next.teamPinHashes[team.id] = await hashPin(SESSION_ID, team.id, pins[team.id]);
    delete next.teamPins; // Remove legacy publicly readable PINs when saving an older session.
    const batch = writeBatch(db);
    batch.set(doc(db, "sessions", SESSION_ID), next);
    batch.set(doc(db, "sessions", SESSION_ID, "private", "pins"), { teamPins: pins });
    await batch.commit();
    config = next;
    teamPins = pins;
    formDirty = false;
    renderConfigForm();
    clearResults();
    message("adminMsg", "설정이 저장되었습니다.", "ok");
  } catch (error) {
    reportError(error, "설정 저장에 실패했습니다. 연결 상태와 관리자 권한을 확인해주세요.");
  } finally { setBusy(false); }
}

async function toggleOpen() {
  if (busy || !configReady) return;
  if (formDirty) return message("adminMsg", "수정한 설정을 먼저 저장해주세요.", "error");
  setBusy(true);
  try {
    if (!config.isOpen) validateConfig(config, teamPins);
    await updateDoc(doc(db, "sessions", SESSION_ID), {
      isOpen: !config.isOpen, updatedAt: serverTimestamp()
    });
    message("adminMsg", "접수 상태를 변경했습니다.", "ok");
  } catch (error) {
    reportError(error, "접수 상태 변경에 실패했습니다.");
  } finally { setBusy(false); }
}

function podiumItem(result, rank, cssClass) {
  if (!result) return "";
  const team = result.team;
  return `
    <div class="podium-item ${cssClass}">
      <div class="podium-card">
        <div class="podium-thumb">
          <img src="${escapeHtml(team.thumbnail)}" alt="${escapeHtml(team.biz)}"/>
        </div>
        <div class="podium-name">${rank === 1 ? "👑 " : ""}${escapeHtml(team.name)} · ${escapeHtml(team.biz)}</div>
        <div class="podium-avg">총 투자액 ${money(result.total)}</div>
      </div>
      <div class="step">${rank}</div>
    </div>`;
}

function revealResults() {
  el("submissionDetails").open = false;
  if (busy || !submissionsReady || !configReady) return;
  if (config.isOpen) return message("adminMsg", "접수를 마감한 뒤 결과를 공개해주세요.", "error");
  if (!submissions.length) {
    alert("아직 제출된 투자가 없습니다.");
    return;
  }

  clearResults();
  prepareAudio();
  const ranking = calculateRanking(config, submissions);
  const [r1, r2, r3] = ranking;

  el("resultArea").innerHTML = `
    <section class="results-stage">
      <div class="stage-title">
        <div class="kicker">FINAL RESULT</div>
        <h2 style="font-size:30px;margin:8px 0 4px">투자 결과 발표</h2>
        <div class="small">총 투자유치액 기준</div>
      </div>
      <div class="podium-wrap">
        ${podiumItem(r2, 2, "second")}
        ${podiumItem(r1, 1, "first")}
        ${podiumItem(r3, 3, "third")}
      </div>
    </section>
    <div id="rankingTable" class="table-wrap hidden" style="margin-top:18px">
      <table>
        <thead><tr><th>순위</th><th>사업</th><th>총 투자액</th><th>외부 평가자</th><th>평균 투자액 (참고)</th></tr></thead>
        <tbody>
          ${ranking.map((r, i) => `
            <tr>
              <td><b>${i + 1}위</b></td>
              <td>${escapeHtml(r.team.name)} · ${escapeHtml(r.team.biz)}</td>
              <td><b>${money(r.total)}</b></td>
              <td>${r.eligible}명</td>
              <td>${money(r.avg)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  revealTimers.push(setTimeout(() => el("resultArea").querySelector(".second")?.classList.add("show"), 350));
  revealTimers.push(setTimeout(() => el("resultArea").querySelector(".third")?.classList.add("show"), 950));
  revealTimers.push(setTimeout(() => {
    el("resultArea").querySelector(".first")?.classList.add("show");
    fanfare();
    confetti();
    el("rankingTable")?.classList.remove("hidden");
  }, 1700));

  el("resultArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function resetSubmissions() {
  if (busy || !configReady || !submissionsReady) return;
  if (config.isOpen) return message("adminMsg", "접수를 먼저 마감해주세요. 초기화 후에도 마감 상태가 유지됩니다.", "error");
  if (!confirm("현재 세션의 모든 투자 제출을 삭제할까요?\n필요하면 먼저 CSV를 저장하세요. 삭제는 되돌릴 수 없습니다.")) return;
  setBusy(true);
  try {
    const snap = await getDocsFromServer(collection(db, "sessions", SESSION_ID, "submissions"));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
    clearResults();
    message("adminMsg", "모든 제출을 초기화했습니다. 다음 수업 준비 후 접수를 열어주세요.", "ok");
  } catch (error) {
    reportError(error, "초기화가 완료되지 않았습니다. 접수 마감·연결 상태를 확인하고 다시 실행해주세요.");
  } finally { setBusy(false); }
}

function exportCsv() {
  if (busy || !submissionsReady) return;
  const rows = [["소속 조", "투자자 번호", "사용액", "미사용액", ...config.teams.map((t) => `${t.name} 투자액`)]];
  const teamName = (id) => config.teams.find((t) => t.id === id)?.name || id;

  for (const s of submissions) {
    rows.push([
      teamName(s.teamId),
      s.personNo,
      s.usedAmount,
      s.remainingAmount,
      ...config.teams.map((t) => Number((s.investments || {})[t.id] || 0))
    ]);
  }

  downloadCsv(`${SESSION_ID}-submissions.csv`, rows);
}

async function createDefaultSession() {
  if (busy) return;
  setBusy(true);
  try {
    const ref = doc(db, "sessions", SESSION_ID);
    if ((await getDocFromServer(ref)).exists()) throw new Error("이미 세션이 있습니다. 화면을 새로고침해주세요.");
    const payload = structuredClone(DEFAULT_CONFIG);
    payload.revision = crypto.randomUUID();
    payload.createdAt = serverTimestamp();
    payload.updatedAt = serverTimestamp();
    const pins = Object.fromEntries(payload.teamIds.map((id) => [id, ""]));
    const batch = writeBatch(db);
    batch.set(ref, payload);
    batch.set(doc(db, "sessions", SESSION_ID, "private", "pins"), { teamPins: pins });
    await batch.commit();
    message("adminMsg", "기본 세션을 만들었습니다. 4개 조의 PIN을 입력하고 설정을 저장해주세요.", "ok");
  } catch (error) {
    setupError(error?.code ? "기본 세션 생성에 실패했습니다. 관리자 UID 등록과 보안 규칙을 확인해주세요." : error.message);
  } finally { setBusy(false); }
}

function bindAdminEvents() {
  el("saveAllButton").addEventListener("click", saveConfig);
  el("toggleOpenButton").addEventListener("click", toggleOpen);
  el("resetButton").addEventListener("click", resetSubmissions);
  el("exportButton").addEventListener("click", exportCsv);
  el("revealButton").addEventListener("click", revealResults);
  el("createSessionButton").addEventListener("click", createDefaultSession);
  el("logoutButton").addEventListener("click", () => signOut(auth).catch((error) => reportError(error, "로그아웃에 실패했습니다.")));
  el("adminContent").addEventListener("input", (event) => {
    if (event.target.matches("input, textarea")) formDirty = true;
  });
  window.addEventListener("beforeunload", (event) => {
    if (formDirty || busy) { event.preventDefault(); event.returnValue = ""; }
  });
}

function subscribeAdminData() {
  if (unsubscribeSession) unsubscribeSession();
  if (unsubscribeSubmissions) unsubscribeSubmissions();
  const generation = authGeneration;
  unsubscribeSession = onSnapshot(doc(db, "sessions", SESSION_ID), { includeMetadataChanges: true }, async (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;
    const currentSession = ++sessionGeneration;
    configReady = false;
    setBusy(busy);
    sessionExists = snapshot.exists();
    el("sessionMissing").classList.toggle("hidden", sessionExists);
    el("adminContent").classList.toggle("hidden", !sessionExists);
    if (!sessionExists) return;
    try {
      const pins = await getDocFromServer(doc(db, "sessions", SESSION_ID, "private", "pins"));
      if (generation !== authGeneration || currentSession !== sessionGeneration) return;
      config = safeConfig(snapshot.data(), DEFAULT_CONFIG);
      teamPins = pins.data()?.teamPins || snapshot.data().teamPins || {};
      configReady = !snapshot.metadata.fromCache;
      if (!formDirty || config.isOpen) {
        formDirty = false;
        renderConfigForm();
      }
      renderStatus();
      renderSubmissions();
      clearResults();
      setBusy(busy);
    } catch (error) {
      if (generation !== authGeneration) return;
      setupError("조 PIN 설정을 읽지 못했습니다. 인터넷 연결·관리자 UID·Firestore 규칙을 확인해주세요.");
      setBusy(busy);
    }
  }, (error) => {
    configReady = false;
    setBusy(busy);
    setupError("프로젝트 설정을 읽지 못했습니다. Firestore 규칙과 관리자 등록을 확인해주세요.");
    console.error(error);
  });
  unsubscribeSubmissions = onSnapshot(
    collection(db, "sessions", SESSION_ID, "submissions"), { includeMetadataChanges: true },
    (snapshot) => {
      submissionsReady = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      submissions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBusy(busy);
      if (sessionExists) { renderStatus(); renderSubmissions(); clearResults(); }
    },
    (error) => {
      submissionsReady = false;
      setBusy(busy);
      submissions = [];
      renderStatus(); renderSubmissions(); clearResults();
      console.error(error);
      message("adminMsg", "제출 목록을 읽지 못했습니다. 관리자 UID 등록과 Firestore 규칙을 확인해주세요.", "error");
    }
  );
}

function start() {
  if (!firebaseConfigured()) {
    setupError("Firebase 설정이 아직 입력되지 않았습니다. js/firebase-config.js에 Firebase 웹 앱 설정값을 붙여 넣으세요.");
    el("loginButton").disabled = true;
    return;
  }

  el("loginButton").disabled = false;
  bindAdminEvents();

  el("loginButton").addEventListener("click", async () => {
    const email = el("emailInput").value.trim();
    const password = el("passwordInput").value;
    el("loginButton").disabled = true;
    el("loginButton").textContent = "로그인 중…";

    try {
      el("loginMsg").innerHTML = "";
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      message("loginMsg", "로그인에 실패했습니다. Firebase Authentication 계정을 확인해주세요.", "error");
    } finally {
      el("loginButton").disabled = false;
      el("loginButton").textContent = "로그인";
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const generation = ++authGeneration;
    if (unsubscribeSession) unsubscribeSession();
    if (unsubscribeSubmissions) unsubscribeSubmissions();
    submissions = [];
    teamPins = {};
    configReady = false;
    submissionsReady = false;
    sessionExists = false;
    formDirty = false;
    clearResults();
    el("teamEditors").innerHTML = "";
    el("submissionsTable").innerHTML = "";
    el("statusCards").innerHTML = "";
    el("adminView").classList.add("hidden");
    el("adminContent").classList.add("hidden");
    el("sessionMissing").classList.add("hidden");
    el("loginView").classList.remove("hidden");
    if (!user) return;
    try {
      const access = await getDocFromServer(doc(db, "admins", user.uid));
      if (generation !== authGeneration) return;
      if (access.data()?.enabled !== true) {
        message("loginMsg", "관리자 권한이 없습니다. Firebase Console에서 admins 컬렉션에 이 계정의 UID와 enabled: true를 등록해주세요.", "error");
        await signOut(auth);
        return;
      }
      el("loginView").classList.add("hidden");
      el("adminView").classList.remove("hidden");
      el("adminIdentity").textContent = `${user.email} 로그인됨`;
      subscribeAdminData();
    } catch (error) {
      if (generation !== authGeneration) return;
      message("loginMsg", "관리자 권한을 확인하지 못했습니다. 인터넷 연결과 Firestore 규칙을 확인해주세요.", "error");
      console.error(error);
    }
  });
}

start();
