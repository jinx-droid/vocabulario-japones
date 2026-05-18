// ============================================================
// 語彙クイズ — Vocabulary Quiz App
// Dados: JMdict (eng-common), processado em words.json + index.json
// ============================================================

// ---------- ESTADO ----------
const STORAGE_KEY = "vocab_jmdict_v1";

let DATA = {
  words: [],        // [{k, r, m}]
  index: {}         // { kanji_char: [indices] }
};

let state = {
  selected: [],     // Set de IDs (índices) de palavras escolhidas pelo usuário
  config: { mode: "meaning", length: 10 },
  quiz: null,
  currentSearch: null
};

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selected: state.selected,
      config: state.config
    }));
  } catch (e) {
    toast("Não foi possível salvar", true);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.selected)) state.selected = parsed.selected;
    if (parsed.config) state.config = { ...state.config, ...parsed.config };
  } catch (e) {
    console.warn("Falha ao carregar:", e);
  }
}

// ---------- LOADING ----------
async function loadData() {
  const progressEl = document.getElementById("loading-progress");
  try {
    const [wordsResp, indexResp] = await Promise.all([
      fetch("words.json"),
      fetch("index.json")
    ]);
    if (!wordsResp.ok || !indexResp.ok) throw new Error("Falha ao carregar dicionário");

    progressEl.textContent = "Processando…";
    const [words, index] = await Promise.all([wordsResp.json(), indexResp.json()]);

    DATA.words = words;
    DATA.index = index;

    progressEl.textContent = "100%";
    setTimeout(() => {
      document.getElementById("loading").classList.add("hidden");
    }, 250);
  } catch (e) {
    progressEl.textContent = "Erro ao carregar. Recarregue a página.";
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

// ---------- EXPLORE ----------
function searchByKanji(input) {
  const text = (input || "").trim();
  const resultsEl = document.getElementById("explore-results");

  if (!text) {
    resultsEl.innerHTML = "";
    state.currentSearch = null;
    return;
  }

  // Pega o primeiro kanji digitado/colado
  let kanjiChar = null;
  for (const c of text) {
    if (isKanji(c)) { kanjiChar = c; break; }
  }

  if (!kanjiChar) {
    resultsEl.innerHTML = `<div class="no-results">Digite um kanji válido</div>`;
    return;
  }

  const indices = DATA.index[kanjiChar];
  if (!indices || indices.length === 0) {
    resultsEl.innerHTML = `<div class="no-results">Nenhuma palavra comum encontrada com <strong style="font-family:'Shippori Mincho',serif;font-size:20px;color:var(--ink)">${kanjiChar}</strong></div>`;
    state.currentSearch = null;
    return;
  }

  state.currentSearch = { kanji: kanjiChar, indices };
  renderResults();
}

function renderResults() {
  if (!state.currentSearch) return;
  const { kanji, indices } = state.currentSearch;
  const resultsEl = document.getElementById("explore-results");

  // Sort: palavras mais "centrais" primeiro (onde o kanji aparece no início)
  const sorted = [...indices].sort((a, b) => {
    const wa = DATA.words[a].k;
    const wb = DATA.words[b].k;
    const ia = wa.indexOf(kanji);
    const ib = wb.indexOf(kanji);
    if (ia !== ib) return ia - ib;
    return wa.length - wb.length;
  });

  const selectedSet = new Set(state.selected);
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
    // Destaca o kanji buscado na palavra
    const highlighted = w.k.split('').map(c =>
      c === kanji
        ? `<span style="color:var(--hanko)">${c}</span>`
        : c
    ).join('');
    html += `
      <div class="result-item" data-idx="${i}">
        <div>
          <div class="word">${highlighted}</div>
          <div class="sub"><span class="reading">${w.r || ''}</span>${w.r ? ' · ' : ''}${w.m}</div>
        </div>
        <button class="heart-btn ${isSel ? 'selected' : ''}" data-idx="${i}" aria-label="Marcar para estudo">${isSel ? '♥' : '♡'}</button>
      </div>
    `;
  }

  resultsEl.innerHTML = html;

  // Wire heart buttons
  resultsEl.querySelectorAll(".heart-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleSelected(parseInt(btn.dataset.idx));
    };
  });

  // Select-all button
  const selBtn = document.getElementById("select-all-btn");
  if (selBtn) {
    selBtn.onclick = () => {
      const selectedSet2 = new Set(state.selected);
      const allSel2 = sorted.every(i => selectedSet2.has(i));
      if (allSel2) {
        // desmarca todas essas
        state.selected = state.selected.filter(i => !sorted.includes(i));
        toast(`${sorted.length} palavras removidas`);
      } else {
        // marca todas
        for (const i of sorted) {
          if (!selectedSet2.has(i)) state.selected.push(i);
        }
        toast(`${sorted.length} palavras na lista`);
      }
      saveState();
      renderResults();
      renderSetupStats();
    };
  }
}

function toggleSelected(idx) {
  const i = state.selected.indexOf(idx);
  if (i === -1) {
    state.selected.push(idx);
  } else {
    state.selected.splice(i, 1);
  }
  saveState();
  // Atualiza só o coração desse item, evita re-renderizar tudo
  const btn = document.querySelector(`.heart-btn[data-idx="${idx}"]`);
  if (btn) {
    const isSel = state.selected.includes(idx);
    btn.classList.toggle("selected", isSel);
    btn.textContent = isSel ? "♥" : "♡";
  }
  renderSetupStats();
  // Atualiza botão "marcar todas" se necessário
  if (state.currentSearch) {
    const selectedSet = new Set(state.selected);
    const allSelected = state.currentSearch.indices.every(i => selectedSet.has(i));
    const selBtn = document.getElementById("select-all-btn");
    if (selBtn) selBtn.textContent = (allSelected ? "Desmarcar" : "Marcar") + " todas";
  }
}

// ---------- QUIZ ----------
function startQuiz() {
  if (state.selected.length < 4) {
    toast(`Precisa de ao menos 4 palavras na lista (tem ${state.selected.length})`, true);
    return;
  }

  const pool = state.selected.map(i => ({ ...DATA.words[i], _id: i }));
  const length = state.config.length === 0
    ? Infinity
    : Math.min(state.config.length, pool.length);
  const questions = state.config.length === 0 ? pool : shuffle(pool).slice(0, length);

  state.quiz = {
    pool,
    questions,
    index: 0,
    correct: 0,
    total: state.config.length === 0 ? Infinity : length,
    answered: false
  };

  switchView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.quiz;
  const target = state.config.length === 0
    ? pick(q.pool)
    : q.questions[q.index];

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

  // Gera distratores. Estratégia:
  //   1. Primeiro tenta distratores DA PRÓPRIA LISTA SELECIONADA (mais relevante)
  //   2. Se não houver suficientes (pool pequeno), usa distratores do dicionário inteiro
  const answerField = mode === "meaning" ? "m" : "r";
  const correctAnswer = target[answerField];

  const seen = new Set([correctAnswer]);
  const distractors = [];

  // 1ª tentativa: do pool selecionado
  for (const w of shuffle(q.pool)) {
    if (w._id === target._id) continue;
    const val = w[answerField];
    if (!val || seen.has(val)) continue;
    seen.add(val);
    distractors.push(val);
    if (distractors.length >= 3) break;
  }

  // 2ª tentativa: do dicionário inteiro (se faltou)
  if (distractors.length < 3) {
    const allIndices = [];
    for (let i = 0; i < DATA.words.length; i++) allIndices.push(i);
    // Amostragem rápida (300 aleatórios em vez de embaralhar tudo)
    const sample = [];
    for (let i = 0; i < 300; i++) {
      sample.push(DATA.words[Math.floor(Math.random() * DATA.words.length)]);
    }
    for (const w of sample) {
      const val = w[answerField];
      if (!val || seen.has(val)) continue;
      seen.add(val);
      distractors.push(val);
      if (distractors.length >= 3) break;
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
    btn.innerHTML = `<span class="option-num">${numLabel}</span><span>${opt.text}</span>`;
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
  if (t.m) html += ` · <strong>${t.m}</strong>`;
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

// ---------- LIST ----------
function renderWordList() {
  const ul = document.getElementById("word-list");
  ul.innerHTML = "";

  if (state.selected.length === 0) {
    document.getElementById("list-empty").style.display = "block";
    return;
  }
  document.getElementById("list-empty").style.display = "none";

  state.selected.forEach(idx => {
    const w = DATA.words[idx];
    if (!w) return;
    const li = document.createElement("li");
    li.className = "word-item";
    li.innerHTML = `
      <div>
        <div class="word-main">${w.k}</div>
        <div class="word-sub">
          ${w.r ? `<span class="reading">${w.r}</span>` : ""}
          ${w.r && w.m ? " · " : ""}
          ${w.m || ""}
        </div>
      </div>
      <button class="word-delete" data-idx="${idx}">Remover</button>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll(".word-delete").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx);
      const i = state.selected.indexOf(idx);
      if (i !== -1) {
        state.selected.splice(i, 1);
        saveState();
        renderWordList();
        renderSetupStats();
      }
    };
  });
}

function clearList() {
  if (state.selected.length === 0) return;
  if (!confirm(`Remover todas as ${state.selected.length} palavras da lista?`)) return;
  state.selected = [];
  saveState();
  renderWordList();
  renderSetupStats();
  toast("Lista limpa");
}

function exportList() {
  if (state.selected.length === 0) {
    toast("Lista vazia", true);
    return;
  }
  const lines = state.selected.map(i => {
    const w = DATA.words[i];
    return `${w.k}\t${w.r || ''}\t${w.m || ''}`;
  });
  const text = "kanji\tleitura\tsignificado\n" + lines.join("\n");
  navigator.clipboard.writeText(text).then(
    () => toast(`${state.selected.length} palavras copiadas (TSV)`),
    () => toast("Erro ao copiar", true)
  );
}

function renderSetupStats() {
  document.getElementById("stat-selected").textContent = state.selected.length;
}

// ---------- VIEW SWITCHING ----------
function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(name + "-view").classList.add("active");

  if (["explore", "setup", "list"].includes(name)) {
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t.dataset.view === name);
    });
  } else {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  }

  if (name === "list") renderWordList();
  if (name === "setup") renderSetupStats();
}

// ---------- INIT ----------
async function init() {
  loadState();
  await loadData();

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => switchView(tab.dataset.view);
  });

  // Explore
  const kanjiInput = document.getElementById("kanji-input");
  kanjiInput.addEventListener("input", (e) => searchByKanji(e.target.value));
  kanjiInput.addEventListener("paste", (e) => {
    setTimeout(() => searchByKanji(e.target.value), 10);
  });

  // Setup choices
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

  // Quiz buttons
  document.getElementById("start-btn").onclick = startQuiz;
  document.getElementById("next-btn").onclick = nextQuestion;
  document.getElementById("quit-btn").onclick = quitQuiz;
  document.getElementById("restart-btn").onclick = () => switchView("setup");

  // List buttons
  document.getElementById("clear-list-btn").onclick = clearList;
  document.getElementById("export-btn").onclick = exportList;

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

  renderSetupStats();
}

document.addEventListener("DOMContentLoaded", init);
