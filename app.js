// ============================================================
// 語彙クイズ — Vocabulary Quiz App (v3)
//   - Listas de kanji
//   - Múltiplos significados
//   - SRS leve (peso por acertos/erros)
//   - Direção inversa (significado→kanji)
//   - Export/import
// ============================================================

const STORAGE_KEY = "vocab_jmdict_v2";  // mantido pra preservar dados existentes

let DATA = { words: [], index: {} };

let state = {
  lists: [],          // [{ id, name, kanji: [chars], selected: [wordIdx], created, _ts }]
  stats: {},          // { wordIdx: { c, w, ts } }
  deletedLists: {},   // tombstones: { listId: ts_of_deletion }
  history: [],        // últimas sessões: [{ts, total, correct, mode, direction, source}]
  config: {
    mode: "meaning",
    direction: "k2m",
    length: 10,
    source: "all",
    srs: true,
    practice: "all",
    autoMark: 15,            // quantas palavras marcar automaticamente ao adicionar kanji (0 = nenhuma)
    theme: "light"           // light | dark
  },
  cloud: {            // configuração de sincronização (GitHub PAT)
    user: "",
    repo: "",
    token: "",
    lastSync: 0,
    lastError: null
  },
  lastView: { view: "lists", listId: null, kanji: null },
  currentListId: null,
  activeKanji: null,
  quiz: null
};

// ---------- STORAGE ----------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lists: state.lists,
      stats: state.stats,
      deletedLists: state.deletedLists,
      history: state.history,
      config: state.config,
      cloud: state.cloud,
      lastView: state.lastView,
      quiz: state.quiz
    }));
  } catch (e) { toast("Não foi possível salvar", true); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { tryMigrateV1(); return; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.lists)) state.lists = parsed.lists;
    if (parsed.stats && typeof parsed.stats === 'object') state.stats = parsed.stats;
    if (parsed.deletedLists && typeof parsed.deletedLists === 'object') state.deletedLists = parsed.deletedLists;
    if (Array.isArray(parsed.history)) state.history = parsed.history;
    if (parsed.config) state.config = { ...state.config, ...parsed.config };
    if (parsed.cloud) state.cloud = { ...state.cloud, ...parsed.cloud };
    if (parsed.lastView && typeof parsed.lastView === 'object') {
      state.lastView = { ...state.lastView, ...parsed.lastView };
    }
    if (parsed.quiz && parsed.quiz.questionIds && Array.isArray(parsed.quiz.questionIds)) {
      if (parsed.quiz.index < parsed.quiz.questionIds.length) {
        state._pendingQuiz = parsed.quiz;
      }
    }
  } catch (e) { console.warn(e); }
}

function tryMigrateV1() {
  try {
    const v1 = localStorage.getItem("vocab_jmdict_v1");
    if (!v1) return;
    const parsed = JSON.parse(v1);
    if (Array.isArray(parsed.selected) && parsed.selected.length > 0) {
      state.lists.push({
        id: genId(),
        name: "Lista importada",
        kanji: [],
        selected: parsed.selected,
        created: Date.now()
      });
      saveState();
      setTimeout(() => toast(`${parsed.selected.length} palavras importadas`), 800);
    }
  } catch (e) {}
}

function genId() {
  return "L" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ---------- DATA LOADING ----------
async function loadData() {
  const progressEl = document.getElementById("loading-progress");
  try {
    const [wResp, iResp] = await Promise.all([fetch("words.json"), fetch("index.json")]);
    if (!wResp.ok || !iResp.ok) throw new Error("Falha");
    progressEl.textContent = "Processando…";
    const [w, i] = await Promise.all([wResp.json(), iResp.json()]);
    DATA.words = w;
    DATA.index = i;
    progressEl.textContent = "100%";
    setTimeout(() => document.getElementById("loading").classList.add("hidden"), 250);
  } catch (e) {
    progressEl.textContent = "Erro ao carregar. Recarregue.";
    console.error(e);
  }
}

// ---------- HELPERS ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function toast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- CUSTOM MODAL ----------
// Substitui confirm() do browser por um modal com o visual do app.
// Retorna Promise<boolean>.
function customConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const msgEl = document.getElementById("modal-message");
    const okBtn = document.getElementById("modal-ok");
    const cancelBtn = document.getElementById("modal-cancel");
    msgEl.textContent = message;
    okBtn.textContent = options.okLabel || "OK";
    cancelBtn.textContent = options.cancelLabel || "Cancelar";
    overlay.style.display = "flex";

    const cleanup = (result) => {
      overlay.style.display = "none";
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      overlay.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") cleanup(false);
      if (e.key === "Enter") cleanup(true);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    // Clicar no overlay (fora do modal) cancela
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    document.addEventListener("keydown", onKey);
    setTimeout(() => okBtn.focus(), 50);
  });
}

// Pede texto ao usuário (substitui prompt() do browser). Retorna Promise<string|null>.
function customPrompt(message, defaultValue = "") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const msgEl = document.getElementById("modal-message");
    const okBtn = document.getElementById("modal-ok");
    const cancelBtn = document.getElementById("modal-cancel");
    msgEl.textContent = message;
    okBtn.textContent = "OK";
    cancelBtn.textContent = "Cancelar";
    // Insere um input depois da mensagem
    let input = document.getElementById("modal-input");
    if (!input) {
      input = document.createElement("input");
      input.id = "modal-input";
      input.type = "text";
      input.className = "modal-input";
      msgEl.parentNode.insertBefore(input, msgEl.nextSibling);
    }
    input.value = defaultValue;
    input.style.display = "block";
    overlay.style.display = "flex";

    const cleanup = (result) => {
      overlay.style.display = "none";
      input.style.display = "none";
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      overlay.onclick = null;
      input.onkeydown = null;
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") cleanup(null);
    };
    okBtn.onclick = () => cleanup(input.value);
    cancelBtn.onclick = () => cleanup(null);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        cleanup(input.value);
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

const KANJI_RE = /[\u4e00-\u9faf]/;
const isKanji = c => KANJI_RE.test(c);

function extractKanji(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const c of text) {
    if (isKanji(c) && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

// ---------- MEANINGS ----------
// Retorna array com TODOS os significados da palavra (1 a 3)
function getMeanings(word) {
  if (word.ms && word.ms.length) return word.ms;
  return word.m ? [word.m] : [];
}
// Junta significados num display string
function meaningDisplay(word) {
  return getMeanings(word).join('; ');
}

// ---------- SRS LEVE ----------
// Cada palavra tem stats: { c: certas, w: erradas, ts: timestamp }
// Peso de sorteio: novas > erradas recentemente > acertos antigos > dominadas
function getWordStats(idx) {
  return state.stats[idx] || { c: 0, w: 0, ts: 0 };
}

function recordAnswer(wordIdx, correct) {
  const s = getWordStats(wordIdx);
  if (correct) s.c = (s.c || 0) + 1;
  else s.w = (s.w || 0) + 1;
  s.ts = Date.now();
  state.stats[wordIdx] = s;
}

// Nível de domínio: "new" | "wrong" | "shaky" | "mastered"
function getMasteryLevel(idx) {
  const s = getWordStats(idx);
  const total = s.c + s.w;
  if (total === 0) return "new";
  const ratio = s.c / total;
  if (s.w > 0 && ratio < 0.5) return "wrong";       // erra mais do que acerta
  if (s.c >= 3 && ratio >= 0.8) return "mastered";  // acertos consistentes
  return "shaky";                                    // entre os dois
}

// Bolinha de status (HTML)
function getMasteryDot(idx) {
  const level = getMasteryLevel(idx);
  if (level === "new") return `<span class="mastery-dot mastery-new" title="Nunca vista"></span>`;
  const s = getWordStats(idx);
  const title = `${s.c} acertos · ${s.w} erros`;
  return `<span class="mastery-dot mastery-${level}" title="${title}"></span>`;
}

// Peso: maior = mais provável de aparecer
function srsWeight(idx) {
  const s = getWordStats(idx);
  const total = s.c + s.w;
  if (total === 0) return 5;                 // nova: alta prioridade
  const ratio = s.c / total;                 // taxa de acerto
  // Erros recentes pesam mais
  let weight = 1 + (1 - ratio) * 4;          // 1..5 com base em taxa
  // Penaliza palavras vistas há muito tempo? Não — vamos manter simples.
  // Se acertou ≥3 vezes seguidas (proxy: muito alta taxa + total alto), reduz peso
  if (s.c >= 3 && ratio >= 0.8) weight *= 0.5;
  return weight;
}

// Sorteia n palavras de um pool, ponderado por SRS
function srsPickN(poolIds, n) {
  if (!state.config.srs) {
    return shuffle(poolIds).slice(0, n);
  }
  const weighted = poolIds.map(id => ({ id, w: srsWeight(id) }));
  const result = [];
  for (let i = 0; i < n && weighted.length > 0; i++) {
    const totalW = weighted.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * totalW;
    let chosenIdx = 0;
    for (let j = 0; j < weighted.length; j++) {
      r -= weighted[j].w;
      if (r <= 0) { chosenIdx = j; break; }
    }
    result.push(weighted[chosenIdx].id);
    weighted.splice(chosenIdx, 1);
  }
  return result;
}

// Pick único ponderado (para modo infinito)
function srsPickOne(poolIds) {
  if (!state.config.srs) return pick(poolIds);
  const weighted = poolIds.map(id => ({ id, w: srsWeight(id) }));
  const totalW = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * totalW;
  for (const w of weighted) {
    r -= w.w;
    if (r <= 0) return w.id;
  }
  return weighted[weighted.length - 1].id;
}

// ---------- CLOUD SYNC (GitHub via PAT) ----------
// Sincroniza estado com um repositório privado no GitHub, usando Personal Access Token.
// Estratégia: last-write-wins por entidade (listas por _ts, stats por ts).
// Arquivo no repo: vocab-quiz-backup.json (sempre na branch padrão).

const SYNC_FILE = "vocab-quiz-backup.json";
const SYNC_COMMIT_MSG = "Backup vocab-quiz";

function cloudConfigured() {
  return !!(state.cloud.user && state.cloud.repo && state.cloud.token);
}

// Monta o payload a ser persistido remotamente
function buildSyncPayload() {
  return {
    app: "vocab-jmdict",
    version: 6,
    syncedAt: Date.now(),
    lists: state.lists,
    stats: state.stats,
    deletedLists: state.deletedLists || {},
    history: state.history || []
  };
}

// Resposta da API do GitHub para GET de file: { content, sha, ... } (content é base64)
// Para PUT, precisamos passar o "sha" do arquivo existente (ou nada se for criação)
async function ghApiGetFile() {
  const { user, repo, token } = state.cloud;
  const url = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${SYNC_FILE}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (resp.status === 404) return null; // arquivo ainda não existe
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub GET falhou (${resp.status}): ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  // content vem em base64 (com quebras de linha)
  const decoded = atob(data.content.replace(/\n/g, ''));
  // Pode conter UTF-8 multi-byte; decodifica corretamente
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  const text = new TextDecoder('utf-8').decode(bytes);
  return { json: JSON.parse(text), sha: data.sha };
}

async function ghApiPutFile(payloadObj, sha) {
  const { user, repo, token } = state.cloud;
  const url = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${SYNC_FILE}`;
  // base64 com UTF-8 correto
  const jsonStr = JSON.stringify(payloadObj, null, 2);
  const bytes = new TextEncoder().encode(jsonStr);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const content = btoa(bin);
  const body = {
    message: SYNC_COMMIT_MSG + " - " + new Date().toISOString().slice(0, 19),
    content
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub PUT falhou (${resp.status}): ${err.slice(0, 200)}`);
  }
  return await resp.json();
}

// Merge entre estado LOCAL (atual) e estado REMOTO (vindo do GitHub).
// Regras:
//   - listas: vence a versão com maior _ts.
//     · se uma lista existe só localmente: mantida (foi criada depois do último sync).
//     · se existe só no remoto: adicionada (criada noutro dispositivo).
//     · se existe nos dois: vence maior _ts.
//   - tombstones: se uma lista está marcada como deletada num lado COM ts > _ts do outro lado,
//     ela permanece deletada. Caso contrário, ressurge (ou seja, foi recriada depois).
//   - stats: por palavra, soma de c/w não é apropriada — usamos last-write-wins por word index.
//     Mantém a versão com maior ts.
function mergeRemote(remote) {
  const merged = {
    lists: [],
    stats: {},
    deletedLists: { ...(state.deletedLists || {}) }
  };
  // Junta tombstones (deletedLists): mantém o ts mais alto pra cada id
  const remoteDeleted = remote.deletedLists || {};
  for (const [id, ts] of Object.entries(remoteDeleted)) {
    const local = merged.deletedLists[id] || 0;
    if (ts > local) merged.deletedLists[id] = ts;
  }

  // Junta listas por id
  const byId = {};
  for (const l of state.lists) byId[l.id] = { local: l };
  for (const l of (remote.lists || [])) {
    byId[l.id] = byId[l.id] || {};
    byId[l.id].remote = l;
  }
  for (const [id, pair] of Object.entries(byId)) {
    const localTs = pair.local ? (pair.local._ts || 0) : 0;
    const remoteTs = pair.remote ? (pair.remote._ts || 0) : 0;
    const deletedTs = merged.deletedLists[id] || 0;
    // Se deletada com ts > ambos, mantém deletada
    if (deletedTs > localTs && deletedTs > remoteTs) continue;
    // Se foi recriada/modificada após a deleção, remove tombstone
    if (Math.max(localTs, remoteTs) > deletedTs) {
      delete merged.deletedLists[id];
    }
    // Escolhe a versão mais recente
    if (localTs >= remoteTs) {
      if (pair.local) merged.lists.push(pair.local);
    } else {
      merged.lists.push(pair.remote);
    }
  }

  // Stats: por wordIdx, vence maior ts
  const allStatKeys = new Set([
    ...Object.keys(state.stats || {}),
    ...Object.keys(remote.stats || {})
  ]);
  for (const k of allStatKeys) {
    const l = (state.stats || {})[k];
    const r = (remote.stats || {})[k];
    if (!l) { merged.stats[k] = r; continue; }
    if (!r) { merged.stats[k] = l; continue; }
    merged.stats[k] = (l.ts || 0) >= (r.ts || 0) ? l : r;
  }

  // History: união (cada sessão tem ts único). Dedup por ts.
  const localHistory = state.history || [];
  const remoteHistory = remote.history || [];
  const histByTs = {};
  for (const h of localHistory) histByTs[h.ts] = h;
  for (const h of remoteHistory) {
    if (!histByTs[h.ts]) histByTs[h.ts] = h;
  }
  merged.history = Object.values(histByTs)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50);  // mantém os 50 mais recentes

  return merged;
}

// Roda o ciclo completo: GET → merge → PUT.
// Atualiza state e localStorage. Retorna { ok, msg }.
async function cloudSync() {
  if (!cloudConfigured()) {
    return { ok: false, msg: "Configure a sincronização primeiro" };
  }
  try {
    setSyncStatus("Buscando remoto…");
    const remoteFile = await ghApiGetFile();
    let remote = null;
    let sha = null;
    if (remoteFile) {
      remote = remoteFile.json;
      sha = remoteFile.sha;
      // Validação básica
      if (remote.app !== "vocab-jmdict") {
        throw new Error("Arquivo remoto não é um backup deste app");
      }
    }

    if (remote) {
      setSyncStatus("Mesclando…");
      const merged = mergeRemote(remote);
      state.lists = merged.lists;
      state.stats = merged.stats;
      state.deletedLists = merged.deletedLists;
      state.history = merged.history || state.history || [];
    }

    setSyncStatus("Enviando…");
    const payload = buildSyncPayload();
    await ghApiPutFile(payload, sha);

    state.cloud.lastSync = Date.now();
    state.cloud.lastError = null;
    saveState();
    setSyncStatus(null);
    return { ok: true, msg: "Sincronizado" };
  } catch (err) {
    console.error(err);
    state.cloud.lastError = String(err.message || err);
    saveState();
    setSyncStatus(null);
    return { ok: false, msg: state.cloud.lastError };
  }
}

function setSyncStatus(text) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}

function applyTheme() {
  const theme = state.config.theme || "light";
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  state.config.theme = (state.config.theme === "dark") ? "light" : "dark";
  saveState();
  applyTheme();
  // Atualiza ícone do botão
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = state.config.theme === "dark" ? "☀" : "☾";
}

function formatRelativeTime(ts) {
  if (!ts) return "nunca";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} d atrás`;
}

function renderCloudConfig() {
  document.getElementById("cloud-user").value = state.cloud.user || "";
  document.getElementById("cloud-repo").value = state.cloud.repo || "";
  document.getElementById("cloud-token").value = state.cloud.token || "";
  const status = document.getElementById("cloud-status");
  if (status) {
    if (cloudConfigured()) {
      const ts = state.cloud.lastSync;
      const last = ts ? `Última sincronização: ${formatRelativeTime(ts)}` : "Ainda não sincronizou";
      const err = state.cloud.lastError ? `<br><span class="hint-error">Último erro: ${escapeHtml(state.cloud.lastError)}</span>` : "";
      status.innerHTML = `<span class="hint-ok">Configurado</span> · ${last}${err}`;
    } else {
      status.innerHTML = `<span class="hint-soft">Não configurado</span>`;
    }
  }
}

function saveCloudConfig() {
  state.cloud.user = document.getElementById("cloud-user").value.trim();
  state.cloud.repo = document.getElementById("cloud-repo").value.trim();
  state.cloud.token = document.getElementById("cloud-token").value.trim();
  if (!state.cloud.user || !state.cloud.repo || !state.cloud.token) {
    toast("Preencha usuário, repositório e token", true);
    return;
  }
  saveState();
  toast("Configuração salva");
  renderCloudConfig();
}

async function disconnectCloud() {
  const ok = await customConfirm(
    "Desconectar da sincronização?\n\nO token será removido deste navegador. Você pode reconectar a qualquer momento.",
    { okLabel: "Desconectar" }
  );
  if (!ok) return;
  state.cloud.user = "";
  state.cloud.repo = "";
  state.cloud.token = "";
  state.cloud.lastSync = 0;
  state.cloud.lastError = null;
  saveState();
  renderCloudConfig();
  toast("Desconectado");
}

async function triggerSync() {
  if (!cloudConfigured()) {
    toast("Configure a sincronização primeiro", true);
    return;
  }
  const btn = document.getElementById("sync-now-btn");
  if (btn) btn.disabled = true;
  const result = await cloudSync();
  if (btn) btn.disabled = false;
  toast(result.msg, !result.ok);
  if (result.ok) {
    renderLists();
    renderCloudConfig();
  } else {
    renderCloudConfig();
  }
}


function exportData() {
  const payload = {
    app: "vocab-jmdict",
    version: 3,
    exported: new Date().toISOString(),
    lists: state.lists,
    stats: state.stats,
    config: state.config
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `vocab-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Backup baixado");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.app !== "vocab-jmdict") {
        toast("Arquivo não é um backup válido", true);
        return;
      }
      const incomingLists = Array.isArray(parsed.lists) ? parsed.lists : [];
      const incomingStats = (parsed.stats && typeof parsed.stats === 'object') ? parsed.stats : {};
      if (incomingLists.length === 0) {
        toast("Backup vazio", true);
        return;
      }

      const hasExistingData = state.lists.length > 0 || Object.keys(state.stats).length > 0;
      let mode = "replace";
      if (hasExistingData) {
        const choice = await customConfirm(
          `Importar ${incomingLists.length} listas?\n\nMESCLAR adiciona às listas existentes.\nSUBSTITUIR apaga tudo e importa.`,
          { okLabel: "Mesclar", cancelLabel: "Substituir" }
        );
        mode = choice ? "merge" : "replace";
      }

      if (mode === "replace") {
        if (hasExistingData) {
          const ok = await customConfirm(
            "Tem certeza? Isso apaga TODAS as listas e estatísticas atuais.",
            { okLabel: "Apagar e importar" }
          );
          if (!ok) return;
        }
        state.lists = incomingLists;
        state.stats = incomingStats;
      } else {
        // mesclar: cada lista vira nova (com sufixo se nome igual existe)
        const existingNames = new Set(state.lists.map(l => l.name));
        for (const l of incomingLists) {
          let name = l.name;
          if (existingNames.has(name)) name += " (importada)";
          state.lists.push({
            ...l,
            id: genId(),        // novo ID pra não colidir
            name
          });
        }
        // mesclar stats: soma acertos/erros, mantém maior timestamp
        for (const [idx, s] of Object.entries(incomingStats)) {
          const existing = state.stats[idx] || { c: 0, w: 0, ts: 0 };
          state.stats[idx] = {
            c: (existing.c || 0) + (s.c || 0),
            w: (existing.w || 0) + (s.w || 0),
            ts: Math.max(existing.ts || 0, s.ts || 0)
          };
        }
      }
      if (parsed.config) {
        // Importa só preferências de modo, não o currentListId etc.
        const safeConfig = ["mode", "direction", "length", "srs"];
        for (const k of safeConfig) {
          if (parsed.config[k] !== undefined) state.config[k] = parsed.config[k];
        }
      }
      saveState();
      renderLists();
      switchView("lists");
      toast(`${incomingLists.length} listas importadas (${mode === "merge" ? "mescladas" : "substituídas"})`);
    } catch (err) {
      console.error(err);
      toast("Arquivo inválido ou corrompido", true);
    }
  };
  reader.onerror = () => toast("Erro ao ler arquivo", true);
  reader.readAsText(file);
}

function getCurrentList() {
  return state.lists.find(l => l.id === state.currentListId);
}

// ---------- TIMESTAMPS (para merge por entidade) ----------
// Marca uma lista como modificada AGORA. Chame depois de qualquer mudança.
function touchList(list) {
  if (list) list._ts = Date.now();
}

// Idem para stat de uma palavra
function touchStat(wordIdx) {
  if (state.stats[wordIdx]) {
    state.stats[wordIdx].ts = Date.now();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}

// ---------- LISTS VIEW ----------
function renderLists() {
  const ul = document.getElementById("list-of-lists");
  ul.innerHTML = "";

  if (state.lists.length === 0) {
    document.getElementById("lists-empty").style.display = "block";
    return;
  }
  document.getElementById("lists-empty").style.display = "none";

  for (const list of state.lists) {
    const li = document.createElement("li");
    li.className = "list-card";
    const preview = list.kanji.slice(0, 12).join(" ") + (list.kanji.length > 12 ? "…" : "");
    li.innerHTML = `
      <div>
        <div class="list-name">${escapeHtml(list.name)}</div>
        <div class="list-stats">${list.kanji.length} kanji · ${list.selected.length} palavras marcadas</div>
        ${list.kanji.length ? `<div class="list-kanji-preview">${preview}</div>` : ""}
      </div>
      <span class="list-card-arrow">→</span>
    `;
    li.onclick = () => openList(list.id);
    ul.appendChild(li);
  }
}

function createList() {
  const input = document.getElementById("new-list-name");
  const name = input.value.trim();
  if (!name) { toast("Dê um nome à lista", true); return; }
  const list = {
    id: genId(),
    name,
    kanji: [],
    selected: [],
    created: Date.now(),
    _ts: Date.now()
  };
  state.lists.push(list);
  saveState();
  input.value = "";
  renderLists();
  openList(list.id);
}

// ---------- LIST DETAIL ----------
function openList(listId) {
  state.currentListId = listId;
  state.activeKanji = null;
  const list = getCurrentList();
  if (!list) return switchView("lists");
  document.getElementById("list-detail-title").textContent = list.name;
  renderListDetail();
  switchView("list-detail");
}

function renderListDetail() {
  const list = getCurrentList();
  if (!list) return;

  // Breakdown de domínio nessa lista
  let mastered = 0, shaky = 0, wrong = 0, neverSeen = 0;
  for (const i of list.selected) {
    const level = getMasteryLevel(i);
    if (level === "mastered") mastered++;
    else if (level === "shaky") shaky++;
    else if (level === "wrong") wrong++;
    else neverSeen++;
  }

  const metaEl = document.getElementById("list-detail-meta");
  let metaHtml = `— ${list.kanji.length} kanji · ${list.selected.length} palavras`;
  if (list.selected.length > 0) {
    const parts = [];
    if (mastered > 0) parts.push(`<span class="meta-mastered">●</span> ${mastered}`);
    if (shaky > 0) parts.push(`<span class="meta-shaky">●</span> ${shaky}`);
    if (wrong > 0) parts.push(`<span class="meta-wrong">●</span> ${wrong}`);
    if (neverSeen > 0) parts.push(`<span class="meta-new">○</span> ${neverSeen}`);
    if (parts.length > 0) {
      metaHtml += ` · ${parts.join(' · ')}`;
    }
  }
  metaEl.innerHTML = metaHtml;

  renderKanjiChips();
  document.getElementById("danger-zone").style.display = "block";
  renderListResults();
}

function renderKanjiChips() {
  const list = getCurrentList();
  if (!list) return;
  const chipsBlock = document.getElementById("kanji-chips-block");
  const chipsEl = document.getElementById("kanji-chips");

  if (list.kanji.length === 0) {
    chipsBlock.style.display = "none";
    return;
  }
  chipsBlock.style.display = "block";

  chipsEl.innerHTML = list.kanji.map(k => {
    const all = DATA.index[k] || [];
    const sel = all.filter(i => list.selected.includes(i)).length;
    return `<button class="kanji-chip${state.activeKanji === k ? ' active' : ''}" data-k="${k}">${k}${sel > 0 ? `<span class="chip-count">${sel}</span>` : ''}<span class="chip-remove" data-remove="${k}">×</span></button>`;
  }).join('');

  chipsEl.querySelectorAll(".kanji-chip").forEach(c => {
    c.onclick = (e) => {
      if (e.target.dataset.remove) {
        e.stopPropagation();
        removeKanjiFromList(e.target.dataset.remove);
        return;
      }
      selectKanjiInList(c.dataset.k);
    };
  });
}

// Marca automaticamente as TOP_N palavras mais frequentes do kanji na lista.
// Só adiciona palavras que ainda não estão em selected. Retorna quantas foram adicionadas.
// Score combinado JLPT+frequência para ordenar palavras.
// Menor = melhor (mais útil pedagogicamente).
// - Palavras com nível JLPT vencem todas as outras.
// - Entre as JLPT, vence o nível mais básico (N5 antes de N4 antes de N3...).
// - Dentro do mesmo nível, vence a frequência menor (mais comum no corpus).
function wordScore(word) {
  const j = word.j;
  const f = word.f ?? 99;
  if (j !== undefined && j !== null) {
    // N5 (j=5) → 0, N4 → 10, N3 → 20, N2 → 30, N1 → 40
    return (5 - j) * 10 + Math.min(f, 50) * 0.01;
  }
  // sem JLPT: começa em 100 + f (sempre depois de qualquer JLPT)
  return 100 + f;
}

function autoMarkTopWords(list, kanji, n) {
  if (n === undefined) n = state.config.autoMark || 15;
  if (n === 0) return 0;  // "0" = não auto-marcar
  const indices = DATA.index[kanji] || [];
  if (indices.length === 0) return 0;
  // ordena: JLPT primeiro (mais básico antes), depois frequência
  const sorted = [...indices].sort((a, b) => {
    const sa = wordScore(DATA.words[a]);
    const sb = wordScore(DATA.words[b]);
    if (sa !== sb) return sa - sb;
    return DATA.words[a].k.length - DATA.words[b].k.length;
  });
  const topIds = n >= sorted.length ? sorted : sorted.slice(0, n);
  const selectedSet = new Set(list.selected);
  let added = 0;
  for (const id of topIds) {
    if (!selectedSet.has(id)) {
      list.selected.push(id);
      added++;
    }
  }
  return added;
}

// Atualiza o texto do botão de aplicar em massa
function updateBulkMarkLabel() {
  const btn = document.getElementById("bulk-mark-btn");
  if (!btn) return;
  const n = state.config.autoMark || 15;
  if (n === 0) {
    btn.textContent = "Aplicar top N em todos (selecione N acima)";
  } else {
    btn.textContent = `Aplicar top ${n} em todos os kanji`;
  }
}

// Aplica autoMarkTopWords pra todos os kanji da lista atual
async function bulkMarkAllKanji() {
  const list = getCurrentList();
  if (!list || list.kanji.length === 0) return;
  const n = state.config.autoMark || 15;
  if (n === 0) {
    toast('Auto-marcação está desligada (escolha "+10/+15/etc")', true);
    return;
  }
  const ok = await customConfirm(
    `Marcar as ${n} palavras mais frequentes de cada um dos ${list.kanji.length} kanji da lista?\n\nPalavras já marcadas permanecem. Só adiciona as que faltam.`,
    { okLabel: "Aplicar" }
  );
  if (!ok) return;
  let total = 0;
  for (const k of list.kanji) {
    total += autoMarkTopWords(list, k, n);
  }
  if (total > 0) {
    touchList(list);
    saveState();
    renderListDetail();
    toast(`${total} novas palavras marcadas`);
  } else {
    toast(`Nenhuma nova: já tinha as top ${n} de todos os kanji`);
  }
}

function addKanjiToList() {
  const list = getCurrentList();
  if (!list) return;
  const input = document.getElementById("add-kanji-input");
  const extracted = extractKanji(input.value);
  if (extracted.length === 0) {
    toast("Nenhum kanji válido encontrado", true);
    return;
  }
  let added = 0;
  let totalMarked = 0;
  const newOnes = [];
  for (const k of extracted) {
    if (!list.kanji.includes(k)) {
      list.kanji.push(k);
      newOnes.push(k);
      added++;
      // Marca automaticamente as 15 mais frequentes
      totalMarked += autoMarkTopWords(list, k);
    }
  }
  if (added > 0) touchList(list);
  saveState();
  input.value = "";
  if (added === 0) {
    toast("Esses kanji já estão na lista");
  } else if (added === 1) {
    toast(`${newOnes[0]} adicionado · ${totalMarked} palavras marcadas`);
    selectKanjiInList(newOnes[0]);
  } else {
    toast(`${added} kanji adicionados · ${totalMarked} palavras marcadas`);
    renderListDetail();
  }
}

async function removeKanjiFromList(kanji) {
  const list = getCurrentList();
  if (!list) return;
  const ok = await customConfirm(
    `Remover ${kanji} desta lista?\n\nAs palavras marcadas continuam na lista.`,
    { okLabel: "Remover" }
  );
  if (!ok) return;
  list.kanji = list.kanji.filter(k => k !== kanji);
  if (state.activeKanji === kanji) state.activeKanji = null;
  touchList(list);
  saveState();
  renderListDetail();
}

function selectKanjiInList(kanji) {
  state.activeKanji = kanji;
  renderListDetail();
  setTimeout(() => {
    const el = document.getElementById("explore-results");
    if (el && el.firstChild) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}

async function deleteList() {
  const list = getCurrentList();
  if (!list) return;
  const ok = await customConfirm(
    `Excluir a lista "${list.name}"?\n\n${list.kanji.length} kanji e ${list.selected.length} palavras marcadas serão perdidos.`,
    { okLabel: "Excluir" }
  );
  if (!ok) return;
  state.deletedLists = state.deletedLists || {};
  state.deletedLists[list.id] = Date.now();
  state.lists = state.lists.filter(l => l.id !== list.id);
  state.currentListId = null;
  state.activeKanji = null;
  saveState();
  renderLists();
  switchView("lists");
  toast("Lista excluída");
}

async function renameCurrentList() {
  const list = getCurrentList();
  if (!list) return;
  const newName = await customPrompt("Novo nome da lista:", list.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    toast("Nome não pode ser vazio", true);
    return;
  }
  if (trimmed === list.name) return;
  list.name = trimmed;
  touchList(list);
  saveState();
  document.getElementById("list-detail-title").textContent = trimmed;
  toast("Lista renomeada");
}

// ---------- RESULTS (palavras do kanji ativo) ----------
function renderListResults() {
  const resultsEl = document.getElementById("explore-results");
  const list = getCurrentList();
  if (!list || !state.activeKanji) {
    resultsEl.innerHTML = "";
    return;
  }
  const kanji = state.activeKanji;
  const indices = DATA.index[kanji];
  if (!indices || indices.length === 0) {
    resultsEl.innerHTML = `<div class="no-results">Nenhuma palavra comum com <strong style="font-family:'Shippori Mincho',serif;font-size:20px;color:var(--ink)">${kanji}</strong></div>`;
    return;
  }

  // Ordena: JLPT primeiro (N5 antes de N4 antes de N3...), depois frequência.
  // Palavras sem JLPT vão por último, ordenadas por frequência.
  const sorted = [...indices].sort((a, b) => {
    const sa = wordScore(DATA.words[a]);
    const sb = wordScore(DATA.words[b]);
    if (sa !== sb) return sa - sb;
    return DATA.words[a].k.length - DATA.words[b].k.length;
  });

  const selectedSet = new Set(list.selected);
  const allSelected = sorted.every(i => selectedSet.has(i));

  let html = `
    <div class="results-meta">
      <span><span class="count">${sorted.length}</span> palavras com <span style="font-family:'Shippori Mincho',serif;font-size:18px;color:var(--ink)">${kanji}</span></span>
      <div class="actions">
        <button id="mark-top-btn">Marcar ${state.config.autoMark || 15} top</button>
        <button id="select-all-btn">${allSelected ? "Desmarcar" : "Marcar"} todas</button>
      </div>
    </div>
  `;

  for (const i of sorted) {
    const w = DATA.words[i];
    const isSel = selectedSet.has(i);
    const highlighted = w.k.split('').map(c =>
      c === kanji ? `<span style="color:var(--hanko)">${c}</span>` : c
    ).join('');
    const meanings = getMeanings(w);
    const meaningHtml = meanings.length > 1
      ? `<span class="meaning-main">${escapeHtml(meanings[0])}</span><span class="meaning-extra"> · ${escapeHtml(meanings.slice(1).join(' · '))}</span>`
      : `${escapeHtml(meanings[0] || '')}`;
    const masteryHtml = getMasteryDot(i);
    html += `
      <div class="result-item" data-idx="${i}">
        <div>
          <div class="word">${masteryHtml}${highlighted}</div>
          <div class="sub"><span class="reading">${w.r || ''}</span>${w.r ? ' · ' : ''}${meaningHtml}</div>
        </div>
        <button class="heart-btn ${isSel ? 'selected' : ''}" data-idx="${i}" aria-label="Marcar">${isSel ? '♥' : '♡'}</button>
      </div>
    `;
  }

  resultsEl.innerHTML = html;

  resultsEl.querySelectorAll(".heart-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleWordInCurrentList(parseInt(btn.dataset.idx));
    };
  });

  const selBtn = document.getElementById("select-all-btn");
  if (selBtn) {
    selBtn.onclick = () => {
      const list2 = getCurrentList();
      const set2 = new Set(list2.selected);
      const allSel2 = sorted.every(i => set2.has(i));
      if (allSel2) {
        list2.selected = list2.selected.filter(i => !sorted.includes(i));
        toast(`${sorted.length} palavras desmarcadas`);
      } else {
        for (const i of sorted) {
          if (!set2.has(i)) list2.selected.push(i);
        }
        toast(`${sorted.length} palavras marcadas`);
      }
      saveState();
      touchList(list2);
      renderListDetail();
    };
  }

  const markTopBtn = document.getElementById("mark-top-btn");
  if (markTopBtn) {
    markTopBtn.onclick = () => {
      const list2 = getCurrentList();
      const n = state.config.autoMark || 15;
      const added = autoMarkTopWords(list2, state.activeKanji, n);
      if (added > 0) touchList(list2);
      saveState();
      renderListDetail();
      toast(added === 0
        ? `Já estavam todas as top ${n} marcadas`
        : `${added} novas palavras marcadas`);
    };
  }
}

function toggleWordInCurrentList(wordIdx) {
  const list = getCurrentList();
  if (!list) return;
  const i = list.selected.indexOf(wordIdx);
  if (i === -1) list.selected.push(wordIdx);
  else list.selected.splice(i, 1);
  touchList(list);
  saveState();

  // Atualiza UI sem re-renderizar tudo
  const btn = document.querySelector(`.heart-btn[data-idx="${wordIdx}"]`);
  if (btn) {
    const isSel = list.selected.includes(wordIdx);
    btn.classList.toggle("selected", isSel);
    btn.textContent = isSel ? "♥" : "♡";
  }

  // Re-renderiza meta com breakdown atualizado
  let mastered = 0, shaky = 0, wrong = 0, neverSeen = 0;
  for (const i of list.selected) {
    const level = getMasteryLevel(i);
    if (level === "mastered") mastered++;
    else if (level === "shaky") shaky++;
    else if (level === "wrong") wrong++;
    else neverSeen++;
  }
  const metaEl = document.getElementById("list-detail-meta");
  let metaHtml = `— ${list.kanji.length} kanji · ${list.selected.length} palavras`;
  if (list.selected.length > 0) {
    const parts = [];
    if (mastered > 0) parts.push(`<span class="meta-mastered">●</span> ${mastered}`);
    if (shaky > 0) parts.push(`<span class="meta-shaky">●</span> ${shaky}`);
    if (wrong > 0) parts.push(`<span class="meta-wrong">●</span> ${wrong}`);
    if (neverSeen > 0) parts.push(`<span class="meta-new">○</span> ${neverSeen}`);
    if (parts.length > 0) metaHtml += ` · ${parts.join(' · ')}`;
  }
  metaEl.innerHTML = metaHtml;

  renderKanjiChips();

  // Atualiza botão "marcar todas" se houver
  const kanji = state.activeKanji;
  if (kanji) {
    const indices = DATA.index[kanji] || [];
    const set = new Set(list.selected);
    const allSel = indices.every(i => set.has(i));
    const selBtn = document.getElementById("select-all-btn");
    if (selBtn) selBtn.textContent = (allSel ? "Desmarcar" : "Marcar") + " todas";
  }
}

// ---------- SETUP ----------
function renderSetupSelect() {
  const sel = document.getElementById("source-select");
  sel.innerHTML = "";

  const unionSet = new Set();
  for (const l of state.lists) for (const i of l.selected) unionSet.add(i);
  const totalUnion = unionSet.size;

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = `Todas as listas (${totalUnion} palavras)`;
  sel.appendChild(optAll);

  for (const l of state.lists) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = `${l.name} (${l.selected.length} palavras)`;
    sel.appendChild(opt);
  }

  const wanted = state.config.source;
  if (wanted === "all" || state.lists.find(l => l.id === wanted)) {
    sel.value = wanted;
  } else {
    sel.value = "all";
    state.config.source = "all";
  }

  updateSetupStats();
}

function getQuizPool() {
  let ids;
  if (state.config.source === "all") {
    const set = new Set();
    for (const l of state.lists) for (const i of l.selected) set.add(i);
    ids = [...set];
  } else {
    const list = state.lists.find(l => l.id === state.config.source);
    ids = list ? [...list.selected] : [];
  }
  // Aplica filtro de prática
  if (state.config.practice === "wrong-only") {
    ids = ids.filter(i => {
      const s = state.stats[i];
      return s && s.w > 0;
    });
  } else if (state.config.practice === "skip-mastered") {
    ids = ids.filter(i => getMasteryLevel(i) !== "mastered");
  }
  return ids;
}

// Retorna { total, neverSeen, wrong, mastered } pra exibir no setup
function getPoolBreakdown() {
  // Base sem filtro de prática (precisamos do total real)
  let baseIds;
  if (state.config.source === "all") {
    const set = new Set();
    for (const l of state.lists) for (const i of l.selected) set.add(i);
    baseIds = [...set];
  } else {
    const list = state.lists.find(l => l.id === state.config.source);
    baseIds = list ? [...list.selected] : [];
  }
  let neverSeen = 0, wrong = 0, mastered = 0;
  for (const i of baseIds) {
    const s = state.stats[i];
    if (!s || (s.c === 0 && s.w === 0)) neverSeen++;
    else if (s.w > 0) wrong++;
    else mastered++;
  }
  return { total: baseIds.length, neverSeen, wrong, mastered, filtered: getQuizPool().length };
}

function updateSetupStats() {
  const b = getPoolBreakdown();
  const el = document.getElementById("stat-selected");
  if (!el) return;
  if (state.config.practice === "wrong-only") {
    el.textContent = `${b.filtered} / ${b.total}`;
    el.title = `${b.wrong} erradas · ${b.neverSeen} nunca vistas · ${b.mastered} dominadas`;
  } else {
    el.textContent = b.total;
    el.title = `${b.wrong} erradas · ${b.neverSeen} nunca vistas · ${b.mastered} dominadas`;
  }
  // Atualiza a linha extra de breakdown se existir
  const extra = document.getElementById("stat-breakdown");
  if (extra) {
    extra.textContent = `· ${b.wrong} erradas · ${b.neverSeen} nunca vistas · ${b.mastered} dominadas`;
  }
}

// ---------- QUIZ ----------
function startQuiz() {
  const poolIds = getQuizPool();
  if (poolIds.length < 4) {
    if (state.config.practice === "wrong-only") {
      toast(`Só ${poolIds.length} erradas. Mude o filtro para "Todas" ou pratique mais.`, true);
    } else if (state.config.practice === "skip-mastered") {
      toast(`Só ${poolIds.length} não-dominadas. Mude o filtro para "Todas".`, true);
    } else {
      toast(`Precisa de pelo menos 4 palavras (tem ${poolIds.length})`, true);
    }
    return;
  }

  // Aplica SRS no sorteio das perguntas (se ativo)
  const length = state.config.length === 0 ? Infinity : Math.min(state.config.length, poolIds.length);
  const selectedIds = state.config.length === 0
    ? poolIds  // infinito: usa o pool inteiro, srsPickOne escolhe a cada turno
    : srsPickN(poolIds, length);

  const pool = poolIds.map(i => ({ ...DATA.words[i], _id: i }));
  const questions = selectedIds.map(i => ({ ...DATA.words[i], _id: i }));

  state.quiz = {
    pool, questions,
    poolIds,             // mantém pra modo infinito
    index: 0, correct: 0,
    total: state.config.length === 0 ? Infinity : length,
    answered: false,
    // pra persistência: guarda só IDs (pool e questions são reidratados de DATA.words)
    questionIds: selectedIds,
    config: { mode: state.config.mode, direction: state.config.direction, srs: state.config.srs }
  };
  saveState();
  switchView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.quiz;
  let target;
  if (state.config.length === 0) {
    // Modo infinito: sorteia novo cada vez com SRS
    const id = srsPickOne(q.poolIds);
    target = { ...DATA.words[id], _id: id };
  } else {
    target = q.questions[q.index];
  }

  // Decide modo (significado/leitura)
  let mode = state.config.mode;
  if (mode === "mixed") mode = Math.random() < 0.5 ? "meaning" : "reading";
  if (mode === "reading" && !target.r) mode = "meaning";
  if (mode === "meaning" && !target.m) mode = "reading";

  // Decide direção (k2m = kanji→sig/leitura, m2k = sig/leitura→kanji)
  const direction = state.config.direction || "k2m";

  q.current = { target, mode, direction };
  q.answered = false;

  if (state.config.length === 0) {
    document.getElementById("quiz-progress").textContent = `${q.index + 1}`;
  } else {
    document.getElementById("quiz-progress").textContent = `${q.index + 1}/${q.total}`;
  }
  document.getElementById("quiz-score").textContent = q.correct;

  // Renderiza prompt baseado na direção
  const answerField = mode === "meaning" ? "m" : "r";

  if (direction === "k2m") {
    // Mostra kanji → escolhe sig/leitura
    document.getElementById("prompt-word").textContent = target.k;
    document.getElementById("prompt-word").classList.remove("prompt-meaning");
    document.getElementById("prompt-label").textContent = "Palavra";
    document.getElementById("prompt-mode").textContent =
      mode === "meaning" ? "qual o significado?" : "qual a leitura?";
  } else {
    // Mostra sig/leitura → escolhe kanji
    document.getElementById("prompt-word").textContent = target[answerField];
    document.getElementById("prompt-word").classList.add("prompt-meaning");
    document.getElementById("prompt-label").textContent =
      mode === "meaning" ? "Significado" : "Leitura";
    document.getElementById("prompt-mode").textContent = "qual a palavra?";
  }

  // Geração de opções
  const seen = new Set();
  const distractors = [];

  if (direction === "k2m") {
    // Distratores = sig/leitura de outras palavras do pool
    const correctAnswer = target[answerField];
    seen.add(correctAnswer);
    for (const w of shuffle(q.pool)) {
      if (w._id === target._id) continue;
      const val = w[answerField];
      if (!val || seen.has(val)) continue;
      seen.add(val);
      distractors.push(val);
      if (distractors.length >= 3) break;
    }
    if (distractors.length < 3) {
      for (let i = 0; i < 300 && distractors.length < 3; i++) {
        const w = DATA.words[Math.floor(Math.random() * DATA.words.length)];
        const val = w[answerField];
        if (!val || seen.has(val)) continue;
        seen.add(val);
        distractors.push(val);
      }
    }
    const options = shuffle([
      { text: correctAnswer, correct: true },
      ...distractors.map(d => ({ text: d, correct: false }))
    ]);
    renderOptions(options);
  } else {
    // direction === "m2k"
    // Distratores = kanji de outras palavras do pool
    const correctKanji = target.k;
    seen.add(correctKanji);
    for (const w of shuffle(q.pool)) {
      if (w._id === target._id) continue;
      if (seen.has(w.k)) continue;
      seen.add(w.k);
      distractors.push(w.k);
      if (distractors.length >= 3) break;
    }
    if (distractors.length < 3) {
      for (let i = 0; i < 300 && distractors.length < 3; i++) {
        const w = DATA.words[Math.floor(Math.random() * DATA.words.length)];
        if (seen.has(w.k)) continue;
        seen.add(w.k);
        distractors.push(w.k);
      }
    }
    const options = shuffle([
      { text: correctKanji, correct: true, isKanji: true },
      ...distractors.map(d => ({ text: d, correct: false, isKanji: true }))
    ]);
    renderOptions(options);
  }

  document.getElementById("feedback").classList.remove("show");
  document.getElementById("next-btn").style.display = "none";
}

function renderOptions(options) {
  const optsEl = document.getElementById("options");
  optsEl.innerHTML = "";
  options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option" + (opt.isKanji ? " option-kanji" : "");
    const numLabel = ["①", "②", "③", "④"][idx];
    btn.innerHTML = `<span class="option-num">${numLabel}</span><span>${escapeHtml(opt.text)}</span>`;
    btn.onclick = () => answerQuestion(btn, opt, options);
    optsEl.appendChild(btn);
  });
}

function answerQuestion(btnEl, opt, options) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;

  const allButtons = document.querySelectorAll(".option");
  allButtons.forEach((b, i) => {
    b.classList.add("locked");
    if (options[i].correct) b.classList.add("correct");
    else if (b === btnEl) b.classList.add("wrong");
    else b.classList.add("fade");
  });

  if (opt.correct) state.quiz.correct++;

  // Grava no SRS
  recordAnswer(state.quiz.current.target._id, opt.correct);
  saveState();

  // Feedback: mostra tudo da palavra (incluindo TODOS os significados)
  const t = state.quiz.current.target;
  const fb = document.getElementById("feedback");
  let html = `<span class="jp">${t.k}</span>`;
  if (t.r) html += ` · <span class="jp">${t.r}</span>`;
  const meanings = getMeanings(t);
  if (meanings.length > 0) {
    html += ` · <strong>${escapeHtml(meanings.join('; '))}</strong>`;
  }
  fb.innerHTML = html;
  fb.classList.add("show");

  document.getElementById("quiz-score").textContent = state.quiz.correct;
  document.getElementById("next-btn").style.display = "block";
}

function nextQuestion() {
  state.quiz.index++;
  saveState();  // persiste progresso
  if (state.config.length !== 0 && state.quiz.index >= state.quiz.questions.length) {
    endQuiz();
    return;
  }
  renderQuestion();
}

function endQuiz() {
  const total = state.quiz.index;
  const correct = state.quiz.correct;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);

  document.getElementById("result-correct").textContent = correct;
  document.getElementById("result-total").textContent = total;
  document.getElementById("result-percent").textContent = pct + "%";

  const stamp = document.getElementById("result-stamp");
  const label = document.getElementById("result-label");
  if (pct >= 90) { stamp.textContent = "優"; label.textContent = "Excelente"; }
  else if (pct >= 75) { stamp.textContent = "良"; label.textContent = "Muito bom"; }
  else if (pct >= 60) { stamp.textContent = "可"; label.textContent = "Aprovado"; }
  else { stamp.textContent = "再"; label.textContent = "Refaça"; }

  // Registra no histórico (limita a 50 mais recentes)
  if (total > 0) {
    const sourceLabel = state.config.source === "all"
      ? "Todas as listas"
      : (state.lists.find(l => l.id === state.config.source)?.name || "Lista");
    state.history.unshift({
      ts: Date.now(),
      total, correct,
      mode: state.config.mode,
      direction: state.config.direction,
      source: sourceLabel
    });
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
  }

  state.quiz = null;
  saveState();
  switchView("result");
}

async function quitQuiz() {
  if (state.quiz && state.quiz.index > 0) {
    const ok = await customConfirm(
      "Encerrar a sessão agora?\n\nO progresso será salvo e você poderá retomar depois.",
      { okLabel: "Encerrar" }
    );
    if (!ok) return;
  }
  // Mantém state.quiz salvo, pra oferecer retomar ao reabrir
  if (state.quiz && state.quiz.index === 0) {
    state.quiz = null;
    saveState();
  }
  switchView("setup");
}

// ---------- VIEW SWITCHING ----------
// ---------- HISTORY ----------
function renderHistory() {
  const list = state.history || [];
  const listEl = document.getElementById("history-list");
  const emptyEl = document.getElementById("history-empty");
  const statsBlock = document.getElementById("history-stats");
  const summaryEl = document.getElementById("history-summary");
  const dangerEl = document.getElementById("history-danger");

  if (list.length === 0) {
    emptyEl.style.display = "block";
    statsBlock.style.display = "none";
    dangerEl.style.display = "none";
    listEl.innerHTML = "";
    return;
  }
  emptyEl.style.display = "none";
  statsBlock.style.display = "block";
  dangerEl.style.display = "block";

  // Resumo geral
  const totalQ = list.reduce((s, r) => s + r.total, 0);
  const totalC = list.reduce((s, r) => s + r.correct, 0);
  const avgPct = totalQ > 0 ? Math.round(totalC / totalQ * 100) : 0;
  // Hoje
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = list.filter(r => r.ts >= todayStart.getTime());
  const todayQ = today.reduce((s, r) => s + r.total, 0);
  const todayC = today.reduce((s, r) => s + r.correct, 0);
  // 7 dias
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const week = list.filter(r => r.ts >= weekAgo);
  summaryEl.innerHTML = `
    <span>Total: <strong>${list.length}</strong> sessões, ${totalQ} perguntas, <strong>${avgPct}%</strong></span>
    <span>Hoje: <strong>${today.length}</strong> sessões, ${todayQ} perguntas${todayQ > 0 ? `, <strong>${Math.round(todayC/todayQ*100)}%</strong>` : ""}</span>
    <span>7 dias: <strong>${week.length}</strong> sessões</span>
  `;

  // Lista detalhada
  listEl.innerHTML = "";
  for (const rec of list) {
    const pct = rec.total > 0 ? Math.round(rec.correct / rec.total * 100) : 0;
    const modeLabels = {
      meaning: "significado", reading: "leitura", mixed: "misto"
    };
    const dirLabels = {
      k2m: "kanji → resp.", m2k: "resp. → kanji"
    };
    const modeText = modeLabels[rec.mode] || rec.mode;
    const dirText = dirLabels[rec.direction] || rec.direction;
    let pctClass = "shaky";
    if (pct >= 80) pctClass = "good";
    else if (pct < 50) pctClass = "bad";

    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div class="history-when">${formatRelativeTime(rec.ts)}</div>
      <div class="history-body">
        <div class="history-score history-score-${pctClass}">${rec.correct}/${rec.total} · ${pct}%</div>
        <div class="history-meta">${escapeHtml(rec.source)} · ${modeText} · ${dirText}</div>
      </div>
    `;
    listEl.appendChild(li);
  }
}

async function clearHistory() {
  if ((state.history || []).length === 0) return;
  const ok = await customConfirm(
    `Apagar o histórico de ${state.history.length} sessões?\n\nAs estatísticas por palavra (acertos/erros) continuam preservadas.`,
    { okLabel: "Apagar" }
  );
  if (!ok) return;
  state.history = [];
  saveState();
  renderHistory();
  toast("Histórico apagado");
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(name + "-view").classList.add("active");

  document.querySelectorAll(".tab").forEach(t => {
    if (name === "list-detail") {
      t.classList.toggle("active", t.dataset.view === "lists");
    } else if (["quiz", "result"].includes(name)) {
      t.classList.remove("active");
    } else {
      t.classList.toggle("active", t.dataset.view === name);
    }
  });

  if (name === "lists") renderLists();
  if (name === "setup") renderSetupSelect();
  if (name === "history") renderHistory();

  // Persiste só views "retomáveis" (não retoma em quiz/result, que são transitórias)
  if (["lists", "list-detail", "setup", "history"].includes(name)) {
    state.lastView = {
      view: name,
      listId: name === "list-detail" ? state.currentListId : null,
      kanji: name === "list-detail" ? state.activeKanji : null
    };
    saveState();
  }
}

// Retorna à última view que estava aberta antes de fechar o app
async function restoreLastView() {
  // Se há quiz pendente, oferece retomar antes de ir pra lastView
  if (state._pendingQuiz) {
    const pending = state._pendingQuiz;
    delete state._pendingQuiz;
    const progress = `${pending.index} de ${pending.questionIds.length}`;
    const resume = await customConfirm(
      `Você tem um quiz em andamento (${progress} respondidas).\n\nDeseja retomá-lo?`,
      { okLabel: "Retomar", cancelLabel: "Descartar" }
    );
    if (resume) {
      state.quiz = {
        ...pending,
        questions: pending.questionIds.map(i => ({ ...DATA.words[i], _id: i })),
        poolIds: pending.poolIds || pending.questionIds,
        pool: (pending.poolIds || pending.questionIds).map(i => ({ ...DATA.words[i], _id: i })),
        answered: false
      };
      switchView("quiz");
      renderQuestion();
      return;
    } else {
      state.quiz = null;
      saveState();
    }
  }
  const lv = state.lastView || { view: "lists" };
  if (lv.view === "list-detail" && lv.listId) {
    const list = state.lists.find(l => l.id === lv.listId);
    if (!list) {
      switchView("lists");
      return;
    }
    state.currentListId = lv.listId;
    state.activeKanji = (lv.kanji && list.kanji.includes(lv.kanji)) ? lv.kanji : null;
    document.getElementById("list-detail-title").textContent = list.name;
    renderListDetail();
    switchView("list-detail");
  } else {
    switchView(lv.view || "lists");
  }
}

// ---------- INIT ----------
async function init() {
  loadState();
  applyTheme();
  // Atualiza ícone inicial
  setTimeout(() => {
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = state.config.theme === "dark" ? "☀" : "☾";
  }, 0);
  await loadData();

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => switchView(tab.dataset.view);
  });

  // Theme toggle
  document.getElementById("theme-toggle").onclick = toggleTheme;

  // Lists view
  document.getElementById("create-list-btn").onclick = createList;
  document.getElementById("new-list-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") createList();
  });

  // Export/import
  document.getElementById("export-btn").onclick = exportData;
  document.getElementById("import-btn").onclick = () => {
    document.getElementById("import-file").click();
  };
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";  // permite re-importar mesmo arquivo
  });

  // Cloud sync
  document.getElementById("cloud-save-btn").onclick = saveCloudConfig;
  document.getElementById("cloud-disconnect-btn").onclick = disconnectCloud;
  document.getElementById("sync-now-btn").onclick = triggerSync;
  renderCloudConfig();

  // List detail
  document.getElementById("back-to-lists").onclick = () => switchView("lists");
  document.getElementById("add-kanji-btn").onclick = addKanjiToList;
  document.getElementById("add-kanji-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addKanjiToList();
  });
  document.getElementById("delete-list-btn").onclick = deleteList;
  document.getElementById("rename-list-btn").onclick = renameCurrentList;

  // Auto-mark selector
  const autoMarkSel = document.getElementById("automark-select");
  autoMarkSel.value = String(state.config.autoMark ?? 15);
  autoMarkSel.addEventListener("change", (e) => {
    state.config.autoMark = parseInt(e.target.value) || 0;
    saveState();
    // Re-renderiza se houver kanji ativo, pra atualizar texto do "Marcar N top"
    if (state.activeKanji) renderListResults();
    updateBulkMarkLabel();
  });

  // Bulk mark all kanji button
  document.getElementById("bulk-mark-btn").onclick = bulkMarkAllKanji;
  updateBulkMarkLabel();

  // Clear history button
  document.getElementById("clear-history-btn").onclick = clearHistory;

  // Setup
  document.getElementById("source-select").addEventListener("change", (e) => {
    state.config.source = e.target.value;
    saveState();
    updateSetupStats();
  });
  // Direção
  document.getElementById("direction-choices").querySelectorAll(".choice").forEach(c => {
    if (c.dataset.direction === state.config.direction) {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
    }
    c.onclick = () => {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      state.config.direction = c.dataset.direction;
      saveState();
    };
  });
  // SRS toggle
  document.getElementById("srs-choices").querySelectorAll(".choice").forEach(c => {
    const isOn = c.dataset.srs === "true";
    if (isOn === !!state.config.srs) {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
    }
    c.onclick = () => {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      state.config.srs = c.dataset.srs === "true";
      saveState();
    };
  });
  document.getElementById("practice-choices").querySelectorAll(".choice").forEach(c => {
    if (c.dataset.practice === (state.config.practice || "all")) {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
    }
    c.onclick = () => {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      state.config.practice = c.dataset.practice;
      saveState();
      updateSetupStats();
    };
  });
  document.getElementById("mode-choices").querySelectorAll(".choice").forEach(c => {
    if (c.dataset.mode === state.config.mode) {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
    }
    c.onclick = () => {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      state.config.mode = c.dataset.mode;
      saveState();
    };
  });
  document.getElementById("length-choices").querySelectorAll(".choice").forEach(c => {
    if (parseInt(c.dataset.length) === state.config.length) {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
    }
    c.onclick = () => {
      c.parentElement.querySelectorAll(".choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      state.config.length = parseInt(c.dataset.length);
      saveState();
    };
  });

  // Quiz
  document.getElementById("start-btn").onclick = startQuiz;
  document.getElementById("next-btn").onclick = nextQuestion;
  document.getElementById("quit-btn").onclick = quitQuiz;
  document.getElementById("restart-btn").onclick = () => switchView("setup");

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("quiz-view").classList.contains("active")) return;
    if (state.quiz && state.quiz.answered && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      nextQuestion();
      return;
    }
    if (!state.quiz || state.quiz.answered) return;
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx <= 3) {
      const btns = document.querySelectorAll(".option");
      if (btns[idx]) btns[idx].click();
    }
  });

  renderLists();
  await restoreLastView();
}

document.addEventListener("DOMContentLoaded", init);
