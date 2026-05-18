// ============================================================
// 語彙クイズ — Vocabulary Quiz App (v2: kanji lists)
// ============================================================

const STORAGE_KEY = "vocab_jmdict_v2";

let DATA = { words: [], index: {} };

let state = {
  lists: [],         // [{ id, name, kanji: [chars], selected: [wordIdx], created }]
  config: { mode: "meaning", length: 10, source: "all" },
  currentListId: null,
  activeKanji: null,
  quiz: null
};

// ---------- STORAGE ----------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lists: state.lists,
      config: state.config
    }));
  } catch (e) { toast("Não foi possível salvar", true); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { tryMigrateV1(); return; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.lists)) state.lists = parsed.lists;
    if (parsed.config) state.config = { ...state.config, ...parsed.config };
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

function getCurrentList() {
  return state.lists.find(l => l.id === state.currentListId);
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
    created: Date.now()
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

  document.getElementById("list-detail-meta").textContent =
    `— ${list.kanji.length} kanji · ${list.selected.length} palavras marcadas`;

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
  const newOnes = [];
  for (const k of extracted) {
    if (!list.kanji.includes(k)) {
      list.kanji.push(k);
      newOnes.push(k);
      added++;
    }
  }
  saveState();
  input.value = "";
  if (added === 0) {
    toast("Esses kanji já estão na lista");
  } else if (added === 1) {
    toast(`${newOnes[0]} adicionado`);
    selectKanjiInList(newOnes[0]);
  } else {
    toast(`${added} kanji adicionados`);
    renderListDetail();
  }
}

function removeKanjiFromList(kanji) {
  const list = getCurrentList();
  if (!list) return;
  if (!confirm(`Remover ${kanji} desta lista?\n(As palavras marcadas continuam na lista.)`)) return;
  list.kanji = list.kanji.filter(k => k !== kanji);
  if (state.activeKanji === kanji) state.activeKanji = null;
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

function deleteList() {
  const list = getCurrentList();
  if (!list) return;
  if (!confirm(`Excluir a lista "${list.name}"?\n${list.kanji.length} kanji e ${list.selected.length} palavras marcadas serão perdidos.`)) return;
  state.lists = state.lists.filter(l => l.id !== list.id);
  state.currentListId = null;
  state.activeKanji = null;
  saveState();
  renderLists();
  switchView("lists");
  toast("Lista excluída");
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

  const sorted = [...indices].sort((a, b) => {
    const wa = DATA.words[a].k;
    const wb = DATA.words[b].k;
    const ia = wa.indexOf(kanji);
    const ib = wb.indexOf(kanji);
    if (ia !== ib) return ia - ib;
    return wa.length - wb.length;
  });

  const selectedSet = new Set(list.selected);
  const allSelected = sorted.every(i => selectedSet.has(i));

  let html = `
    <div class="results-meta">
      <span><span class="count">${sorted.length}</span> palavras com <span style="font-family:'Shippori Mincho',serif;font-size:18px;color:var(--ink)">${kanji}</span></span>
      <div class="actions">
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
    html += `
      <div class="result-item" data-idx="${i}">
        <div>
          <div class="word">${highlighted}</div>
          <div class="sub"><span class="reading">${w.r || ''}</span>${w.r ? ' · ' : ''}${escapeHtml(w.m)}</div>
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
      renderListDetail();
    };
  }
}

function toggleWordInCurrentList(wordIdx) {
  const list = getCurrentList();
  if (!list) return;
  const i = list.selected.indexOf(wordIdx);
  if (i === -1) list.selected.push(wordIdx);
  else list.selected.splice(i, 1);
  saveState();

  // Atualiza UI sem re-renderizar tudo
  const btn = document.querySelector(`.heart-btn[data-idx="${wordIdx}"]`);
  if (btn) {
    const isSel = list.selected.includes(wordIdx);
    btn.classList.toggle("selected", isSel);
    btn.textContent = isSel ? "♥" : "♡";
  }

  document.getElementById("list-detail-meta").textContent =
    `— ${list.kanji.length} kanji · ${list.selected.length} palavras marcadas`;

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
  if (state.config.source === "all") {
    const set = new Set();
    for (const l of state.lists) for (const i of l.selected) set.add(i);
    return [...set];
  }
  const list = state.lists.find(l => l.id === state.config.source);
  return list ? [...list.selected] : [];
}

function updateSetupStats() {
  document.getElementById("stat-selected").textContent = getQuizPool().length;
}

// ---------- QUIZ ----------
function startQuiz() {
  const poolIds = getQuizPool();
  if (poolIds.length < 4) {
    toast(`Precisa de pelo menos 4 palavras (tem ${poolIds.length})`, true);
    return;
  }

  const pool = poolIds.map(i => ({ ...DATA.words[i], _id: i }));
  const length = state.config.length === 0 ? Infinity : Math.min(state.config.length, pool.length);
  const questions = state.config.length === 0 ? pool : shuffle(pool).slice(0, length);

  state.quiz = {
    pool, questions,
    index: 0, correct: 0,
    total: state.config.length === 0 ? Infinity : length,
    answered: false
  };
  switchView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.quiz;
  const target = state.config.length === 0 ? pick(q.pool) : q.questions[q.index];

  let mode = state.config.mode;
  if (mode === "mixed") mode = Math.random() < 0.5 ? "meaning" : "reading";
  if (mode === "reading" && !target.r) mode = "meaning";
  if (mode === "meaning" && !target.m) mode = "reading";

  q.current = { target, mode };
  q.answered = false;

  if (state.config.length === 0) {
    document.getElementById("quiz-progress").textContent = `${q.index + 1}`;
  } else {
    document.getElementById("quiz-progress").textContent = `${q.index + 1}/${q.total}`;
  }
  document.getElementById("quiz-score").textContent = q.correct;

  document.getElementById("prompt-word").textContent = target.k;
  document.getElementById("prompt-label").textContent = "Palavra";
  document.getElementById("prompt-mode").textContent =
    mode === "meaning" ? "qual o significado?" : "qual a leitura?";

  const answerField = mode === "meaning" ? "m" : "r";
  const correctAnswer = target[answerField];

  const seen = new Set([correctAnswer]);
  const distractors = [];

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

  const optsEl = document.getElementById("options");
  optsEl.innerHTML = "";
  options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option";
    const numLabel = ["①", "②", "③", "④"][idx];
    btn.innerHTML = `<span class="option-num">${numLabel}</span><span>${escapeHtml(opt.text)}</span>`;
    btn.onclick = () => answerQuestion(btn, opt, options);
    optsEl.appendChild(btn);
  });

  document.getElementById("feedback").classList.remove("show");
  document.getElementById("next-btn").style.display = "none";
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

  const t = state.quiz.current.target;
  const fb = document.getElementById("feedback");
  let html = `<span class="jp">${t.k}</span>`;
  if (t.r) html += ` · <span class="jp">${t.r}</span>`;
  if (t.m) html += ` · <strong>${escapeHtml(t.m)}</strong>`;
  fb.innerHTML = html;
  fb.classList.add("show");

  document.getElementById("quiz-score").textContent = state.quiz.correct;
  document.getElementById("next-btn").style.display = "block";
}

function nextQuestion() {
  state.quiz.index++;
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

  switchView("result");
}

function quitQuiz() {
  if (state.quiz && state.quiz.index > 0) {
    if (!confirm("Encerrar a sessão agora?")) return;
  }
  state.quiz = null;
  switchView("setup");
}

// ---------- VIEW SWITCHING ----------
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
}

// ---------- INIT ----------
async function init() {
  loadState();
  await loadData();

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => switchView(tab.dataset.view);
  });

  // Lists view
  document.getElementById("create-list-btn").onclick = createList;
  document.getElementById("new-list-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") createList();
  });

  // List detail
  document.getElementById("back-to-lists").onclick = () => switchView("lists");
  document.getElementById("add-kanji-btn").onclick = addKanjiToList;
  document.getElementById("add-kanji-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addKanjiToList();
  });
  document.getElementById("delete-list-btn").onclick = deleteList;

  // Setup
  document.getElementById("source-select").addEventListener("change", (e) => {
    state.config.source = e.target.value;
    saveState();
    updateSetupStats();
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
}

document.addEventListener("DOMContentLoaded", init);
