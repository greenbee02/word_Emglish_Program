import './style.css';
import './account.css';
import './theme.css';
import { loadState, saveState, syncInitialState, parseBackup, makeWord, classifyRows, gradeWord, todayQueue, weakWordQueue, wordsForDays, configureStore, flushPendingSaves, hasUnsavedChanges, getSyncStatus, getGuestState } from './store.js';
import { renderShell, updateSyncStatus, escapeHtml as esc } from './layout.js';
import { auth, getAuthSession } from './auth.js';
import { showAccount, closeAccount } from './account-view.js';
import { importSpreadsheet, importPdf } from './importers.js';
import { rankEnglishVoices, speakEnglish } from './speech.js';
import { gradeMeaningAnswer, meaningHint, representativeMeaning } from './meaning-answer.js';
import { englishHint, gradeEnglishAnswer } from './english-answer.js';
import { copyProgress, gradeCopyAnswer } from './copy-answer.js';

let state = loadState();
let route = 'home';
let pendingRows = [];
let pendingFile = null;
let queue = [];
let activeIndex = 0;
let revealed = false;
let sessionResults = [];
let quizQueue = [];
let quizIndex = 0;
let quizCorrect = 0;
let sessionKind = 'today';
let spokenStudyWordId = null;
let typingQueue = [];
let typingIndex = 0;
let typingAnswered = false;
let typingFeedback = null;
let typingHintLevel = 0;
let typingStartedAt = 0;
let typingAttempts = new Map();
let typingPreview = [];
let typingPreviewIndex = 0;
let typingDirection = 'meaning';
let studySetupKind = 'today';
let typingSetupScope = 'all';

const app = document.querySelector('#app');
let currentUser = null, activeUserId, accountEpoch = 0, syncInProgress = null;

function persist() { saveState(state); }
function pronounce(text) { return speakEnglish(text, globalThis.speechSynthesis, globalThis.SpeechSynthesisUtterance, { voiceName: state.settings.speechVoice || '', rate: state.settings.speechRate || 0.82 }); }

function shell(content) {
  const guest = getGuestState();
  renderShell({ app, route, content, user: currentUser, status: getSyncStatus(),
    onRoute: next => { route = next; render(); }, onAccount: handleAccount,
    onRetry: () => reloadAccount(false), onReload: () => reloadAccount(true),
    canImportGuest: Boolean(currentUser && !state.words.length && !state.sessions.length && (guest.words.length || guest.sessions.length)),
    onImportGuest: () => {
      if (!confirm('이 기기에 저장된 이전 학습 데이터를 현재 계정으로 가져올까요? 기존 기기 백업은 그대로 남습니다.')) return;
      state = parseBackup(JSON.stringify(getGuestState())); persist(); render();
    },
  });
}

function home() {
  const due = todayQueue(state);
  const weak = weakWordQueue(state);
  const learned = state.words.filter((w) => w.status !== 'new').length;
  const accuracy = state.sessions.length ? Math.round(state.sessions.reduce((a, s) => a + s.correct, 0) / Math.max(1, state.sessions.reduce((a, s) => a + s.total, 0)) * 100) : 0;
  shell(`<header><div><p class="eyebrow">GOOD TO SEE YOU</p><h1>오늘도 단어를<br><em>기억</em>해 볼까요?</h1><p class="sub">외우는 것보다 중요한 건, 잊기 전에 다시 만나는 것.</p></div><div class="date">${new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</div></header>
    <section class="hero-card"><div><span class="tag">TODAY'S SESSION</span><h2>${!state.words.length ? '첫 단어를 추가해 보세요' : due.length ? `${due.length}개의 단어가 기다리고 있어요` : '오늘 복습을 모두 마쳤어요'}</h2><p>${!state.words.length ? '직접 입력하거나 파일에서 단어장을 가져올 수 있어요.' : `복습 ${due.filter(w => w.status !== 'new').length}개 · 새 단어 ${due.filter(w => w.status === 'new').length}개`}</p></div><button class="primary" id="start" ${state.words.length && !due.length ? 'disabled' : ''}>${!state.words.length ? '단어 추가하기' : '학습 시작하기'}</button></section>
    <section class="metrics"><article><span>전체 단어</span><strong>${state.words.length}</strong><small>WORDS</small></article><article><span>학습한 단어</span><strong>${learned}</strong><small>LEARNED</small></article><article><span>누적 정답률</span><strong>${accuracy}%</strong><small>ACCURACY</small></article></section>
    <section class="split"><article class="panel"><div class="panel-head"><h3>빠른 시작</h3></div><button class="quick" data-action="typing" ${state.words.length ? '' : 'disabled'}><b>⌨</b><span><strong>타이핑 학습</strong><small>한글 뜻 또는 영어 단어 직접 입력</small></span><i>→</i></button><button class="quick" data-action="weak" ${weak.length ? '' : 'disabled'}><b>↻</b><span><strong>틀린 단어 복습</strong><small>${weak.length ? `${weak.length}개의 약점 단어만 공부` : '현재 복습할 틀린 단어가 없어요'}</small></span><i>→</i></button><button class="quick" data-route="import"><b>↥</b><span><strong>단어장 가져오기</strong><small>Excel, CSV, PDF, 스캔 PDF</small></span><i>→</i></button><button class="quick" data-action="manual"><b>＋</b><span><strong>단어 직접 추가</strong><small>단어와 뜻을 바로 등록</small></span><i>→</i></button></article><article class="quote"><span>“</span><p>Success is the sum of small efforts, repeated day in and day out.</p><small>— ROBERT COLLIER</small></article></section>`);
  app.querySelector('#start')?.addEventListener('click', () => state.words.length ? openStudySetup('today') : showManual());
  app.querySelector('[data-action="weak"]')?.addEventListener('click', () => openStudySetup('weak'));
  app.querySelector('[data-action="typing"]')?.addEventListener('click', () => openTypingSetup('all'));
  app.querySelector('[data-action="manual"]')?.addEventListener('click', showManual);
}

function showManual() {
  route = 'words';
  words(true);
}

function words(showForm = false) {
  shell(`<div class="page-head"><div><p class="eyebrow">MY COLLECTION</p><h1>나의 단어장</h1></div><button class="primary" id="add-word">＋ 단어 추가</button></div>
    <div id="manual-slot">${showForm ? manualForm() : ''}</div>
    <section class="panel table-panel"><div class="panel-head"><h3>전체 ${state.words.length}개</h3><input id="search" placeholder="단어 또는 뜻 검색" /></div><div id="word-list">${wordList(state.words)}</div></section>
    ${state.imports.length ? `<section class="panel import-history"><h3>최근 가져오기</h3>${state.imports.slice().reverse().map(item => `<div><span><b>${esc(item.name)}</b><small>${new Date(item.createdAt).toLocaleString('ko-KR')} · ${item.count}개</small></span><button class="secondary" data-undo-import="${esc(item.id)}">되돌리기</button></div>`).join('')}</section>` : ''}`);
  app.querySelector('#add-word').addEventListener('click', () => { app.querySelector('#manual-slot').innerHTML = manualForm(); bindManual(); });
  if (showForm) bindManual();
  app.querySelector('#search').addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); app.querySelector('#word-list').innerHTML = wordList(state.words.filter(w => `${w.english} ${w.meaning}`.toLowerCase().includes(q))); });
  bindDeletes();
  app.querySelectorAll('[data-undo-import]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.undoImport;
    state.words = state.words.filter(word => word.source?.importId !== id);
    state.imports = state.imports.filter(item => item.id !== id);
    persist(); words();
  }));
}

function manualForm() { return `<form class="panel manual" id="manual"><input name="english" aria-label="영어 단어·숙어" placeholder="영어 단어·숙어" required><input name="meaning" aria-label="한국어 뜻" placeholder="한국어 뜻" required><input name="partOfSpeech" aria-label="품사" placeholder="품사 (선택)"><input name="example" aria-label="예문" placeholder="예문 (선택)"><button class="primary">저장</button></form>`; }
function bindManual() { app.querySelector('#manual')?.addEventListener('submit', (e) => { e.preventDefault(); const row = Object.fromEntries(new FormData(e.target)); state.words.push(makeWord(row, { type: 'manual', label: '직접 입력' })); pronounce(row.english); persist(); words(); }); }
function wordList(list) { return list.length ? `<div class="word-table">${list.map(w => `<div><b>${esc(w.english)}</b><span>${esc(w.meaning)}</span><small>${esc([w.day ? `Day ${w.day}` : '', w.partOfSpeech, w.source?.label, w.source?.location].filter(Boolean).join(' · '))}</small><span class="word-actions"><button data-speak="${esc(w.id)}" aria-label="${esc(w.english)} 발음 듣기" title="발음 듣기">🔊</button><button data-delete="${esc(w.id)}" aria-label="삭제" title="삭제">×</button></span></div>`).join('')}</div>` : `<div class="empty"><b>아직 단어가 없어요</b><p>직접 추가하거나 파일에서 가져와 보세요.</p></div>`; }
function bindDeletes() { app.querySelectorAll('[data-speak]').forEach(btn => btn.addEventListener('click', () => { const word = state.words.find(w => w.id === btn.dataset.speak); if (word) pronounce(word.english); })); app.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => { state.words = state.words.filter(w => w.id !== btn.dataset.delete); persist(); words(); })); }

function mistakes() {
  const weak = weakWordQueue(state);
  const days = [...new Set(weak.map(word => word.day).filter(Boolean))].sort((a, b) => a - b);
  shell(`<div class="page-head mistake-head"><div><p class="eyebrow">WRONG ANSWER NOTE</p><h1>오답 단어장</h1><p class="sub">아직 해결하지 못한 단어만 모았습니다. 맞힌 횟수가 오답 횟수와 같아지면 자동으로 빠집니다.</p></div><div class="mistake-actions"><button class="secondary" id="mistake-typing" ${weak.length ? '' : 'disabled'}>뜻 타이핑 복습</button><button class="primary" id="mistake-cards" ${weak.length ? '' : 'disabled'}>오답 카드 학습</button></div></div>${weak.length ? `<section class="panel mistake-book"><div class="mistake-toolbar"><strong>전체 ${weak.length}개</strong><select id="mistake-day"><option value="">전체 Day</option>${days.map(day => `<option value="${day}">Day ${day}</option>`).join('')}</select><input id="mistake-search" placeholder="단어 또는 뜻 검색"></div><div id="mistake-list">${mistakeList(weak)}</div></section>` : `<section class="panel empty mistake-empty"><b>현재 오답 단어가 없어요</b><p>학습 중 틀린 단어가 생기면 이곳에 자동으로 모입니다.</p><button class="primary" data-route="home">오늘 학습 시작하기</button></section>`}`);
  app.querySelector('#mistake-cards')?.addEventListener('click', () => openStudySetup('weak'));
  app.querySelector('#mistake-typing')?.addEventListener('click', () => openTypingSetup('weak'));
  const update = () => {
    const query = (app.querySelector('#mistake-search')?.value || '').trim().toLowerCase();
    const day = Number(app.querySelector('#mistake-day')?.value || 0);
    const filtered = weak.filter(word => (!day || word.day === day) && (!query || `${word.english} ${word.meaning}`.toLowerCase().includes(query)));
    app.querySelector('#mistake-list').innerHTML = mistakeList(filtered);
    bindMistakeAudio();
  };
  app.querySelector('#mistake-search')?.addEventListener('input', update);
  app.querySelector('#mistake-day')?.addEventListener('change', update);
  bindMistakeAudio();
}

function mistakeList(list) {
  return list.length ? `<div class="mistake-table">${list.map(word => `<article><button class="mistake-speak" data-mistake-speak="${esc(word.id)}" aria-label="${esc(word.english)} 발음 듣기">🔊</button><div><b>${esc(word.english)}</b><small>${esc([word.day ? `Day ${word.day}` : '', word.partOfSpeech, word.number ? `No. ${word.number}` : ''].filter(Boolean).join(' · '))}</small></div><p>${esc(word.meaning)}</p><span><strong>${Math.max(1, (word.wrong || 0) - (word.correct || 0))}</strong><small>남은 오답</small><em>오답 ${word.wrong || 0} · 정답 ${word.correct || 0}</em></span></article>`).join('')}</div>` : '<div class="empty">조건에 맞는 오답 단어가 없어요.</div>';
}

function bindMistakeAudio() { app.querySelectorAll('[data-mistake-speak]').forEach(button => button.addEventListener('click', () => { const word = state.words.find(item => item.id === button.dataset.mistakeSpeak); if (word) pronounce(word.english); })); }

function imports() {
  shell(`<div class="page-head"><div><p class="eyebrow">IMPORT WORDS</p><h1>단어장 가져오기</h1><p class="sub">엑셀, CSV, 텍스트 PDF와 스캔 PDF를 읽을 수 있어요.</p></div></div>
    <section class="upload" id="drop"><div class="upload-icon">↥</div><h2>파일을 이곳에 놓으세요</h2><p>또는 눌러서 파일 선택 · XLSX, XLS, CSV, PDF</p><input type="file" id="file" accept=".xlsx,.xls,.csv,.pdf" hidden><button class="secondary" id="choose">파일 선택</button></section><p id="progress" class="progress"></p>
    ${pendingRows.length ? reviewTable() : `<section class="how"><h3>가져오기 과정</h3><div><span>01</span><p><b>파일 읽기</b><small>열과 페이지를 자동 분석합니다.</small></p><span>02</span><p><b>내용 검토</b><small>중복과 불확실한 항목을 표시합니다.</small></p><span>03</span><p><b>학습에 추가</b><small>원본 위치와 함께 안전하게 저장합니다.</small></p></div></section>`}`);
  const input = app.querySelector('#file');
  app.querySelector('#choose').addEventListener('click', () => input.click());
  app.querySelector('#drop').addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
  app.querySelector('#drop').addEventListener('dragover', (e) => e.preventDefault());
  app.querySelector('#drop').addEventListener('drop', (e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => processFile(input.files[0]));
  bindReview();
}

async function processFile(file) {
  if (!file) return;
  const epoch = accountEpoch;
  pendingFile = file;
  const progress = app.querySelector('#progress');
  progress.textContent = `${file.name} 분석을 시작합니다…`;
  try {
    const rows = file.name.toLowerCase().endsWith('.pdf') ? await importPdf(file, (text) => { progress.textContent = text; }) : await importSpreadsheet(file);
    if (epoch !== accountEpoch) return;
    pendingRows = classifyRows(rows, state.words);
    imports();
  } catch (error) {
    progress.textContent = `가져오지 못했습니다: ${error.message}`;
  }
}

function reviewTable() {
  const counts = pendingRows.reduce((a, r) => { a[r.reviewState] = (a[r.reviewState] || 0) + 1; return a; }, {});
  const days = [...new Set(pendingRows.map((row) => Number(row.day)).filter(Boolean))].sort((a, b) => a - b);
  const dayControls = days.length ? `<div class="day-range"><span>등록 범위</span><select id="day-from">${days.map(day => `<option value="${day}">Day ${day}</option>`).join('')}</select><span>~</span><select id="day-to">${days.map(day => `<option value="${day}" ${day === days.at(-1) ? 'selected' : ''}>Day ${day}</option>`).join('')}</select><button class="secondary" id="apply-days">선택</button></div>` : '';
  return `<section class="panel review"><div class="panel-head"><div><h3>추출 결과</h3><p>${esc(pendingFile?.name)} · 등록 가능 ${counts.ready || 0} · 확인 필요 ${counts['needs-review'] || 0} · 중복 ${counts.duplicate || 0}</p>${dayControls}</div><button class="primary" id="commit">선택 항목 추가</button></div><div class="review-list">${pendingRows.map((r, i) => `<div class="review-row ${r.reviewState}"><input type="checkbox" data-select="${i}" ${r.selected ? 'checked' : ''}><input data-field="english" data-index="${i}" value="${esc(r.english)}"><input data-field="meaning" data-index="${i}" value="${esc(r.meaning)}"><small>${esc(r.location || '')}<br>${esc(r.note || (r.ocr ? 'OCR 추출' : '정상'))}${r.raw ? `<br><span class="raw">원문: ${esc(r.raw)}</span>` : ''}</small></div>`).join('')}</div></section>`;
}

function bindReview() {
  app.querySelectorAll('[data-select]').forEach(el => el.addEventListener('change', () => { pendingRows[+el.dataset.select].selected = el.checked; }));
  app.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', () => { pendingRows[+el.dataset.index][el.dataset.field] = el.value; }));
  app.querySelector('#apply-days')?.addEventListener('click', () => {
    const from = Number(app.querySelector('#day-from').value); const to = Number(app.querySelector('#day-to').value);
    pendingRows.forEach(row => { row.selected = row.reviewState !== 'duplicate' && Number(row.day) >= Math.min(from, to) && Number(row.day) <= Math.max(from, to); });
    imports();
  });
  app.querySelector('#commit')?.addEventListener('click', () => {
    const importId = crypto.randomUUID();
    const selected = pendingRows.filter(r => r.selected && r.english.trim() && r.meaning.trim());
    selected.forEach(row => state.words.push(makeWord(row, { importId, type: pendingFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'sheet', label: pendingFile.name, location: row.location, sourcePage: row.sourcePage || '', day: row.day || '', raw: row.raw || '', ocr: !!row.ocr })));
    state.imports.push({ id: importId, name: pendingFile.name, count: selected.length, createdAt: new Date().toISOString() });
    persist(); pendingRows = []; pendingFile = null; route = 'words'; render();
  });
}

function startStudy(customQueue = todayQueue(state), kind = 'today') { queue = customQueue; sessionKind = kind; activeIndex = 0; revealed = false; sessionResults = []; quizQueue = []; quizIndex = 0; quizCorrect = 0; spokenStudyWordId = null; route = 'study'; render(); }
function startWeakStudy() { openStudySetup('weak'); }

function availableDays(words = state.words) { return [...new Set(words.map(word => word.day).filter(Boolean))].sort((a, b) => a - b); }
function dayChoices(words = state.words) {
  const days = availableDays(words);
  const hasUnsorted = words.some(word => !word.day);
  return `${days.map(day => `<label class="day-choice"><input type="checkbox" name="days" value="${day}" checked><span>Day ${day}</span></label>`).join('')}${hasUnsorted ? '<label class="day-choice"><input type="checkbox" name="days" value="none" checked><span>미분류</span></label>' : ''}`;
}
function bindDayChoiceControls(form) {
  form.querySelector('[data-days="all"]')?.addEventListener('click', () => form.querySelectorAll('input[name="days"]').forEach(input => { input.checked = true; }));
  form.querySelector('[data-days="none"]')?.addEventListener('click', () => form.querySelectorAll('input[name="days"]').forEach(input => { input.checked = false; }));
}

function openStudySetup(kind = 'today') { studySetupKind = kind; route = 'study-setup'; render(); }
function studySetup() {
  const source = studySetupKind === 'weak' ? weakWordQueue(state) : state.words;
  const title = studySetupKind === 'weak' ? '오답 복습 단원 선택' : '단어 학습 단원 선택';
  shell(`<div class="page-head"><div><p class="eyebrow">SELECT DAYS</p><h1>${title}</h1><p class="sub">여러 Day를 동시에 선택할 수 있습니다.</p></div></div><section class="panel study-setup"><form id="study-setup-form"><div class="day-select-head"><strong>학습할 단원</strong><span><button type="button" class="text-btn" data-days="all">전체 선택</button><button type="button" class="text-btn" data-days="none">전체 해제</button></span></div><div class="day-choices">${dayChoices(source)}</div><label class="count-choice">문제 수<select name="count"><option value="10">10개</option><option value="20" selected>20개</option><option value="30">30개</option><option value="0">선택 단원 전체</option></select></label><button class="primary">선택한 단원 학습하기</button></form></section>`);
  const form = app.querySelector('#study-setup-form');
  bindDayChoiceControls(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selectedDays = new FormData(form).getAll('days');
    if (!selectedDays.length) { alert('학습할 단원을 하나 이상 선택하세요.'); return; }
    const count = Number(new FormData(form).get('count'));
    let pool;
    if (studySetupKind === 'weak') {
      pool = wordsForDays(weakWordQueue(state), selectedDays);
    } else {
      const selectedWords = wordsForDays(state.words, selectedDays);
      const prioritized = [...todayQueue({ ...state, words: selectedWords }), ...selectedWords];
      pool = [...new Map(prioritized.map(word => [word.id, word])).values()];
    }
    if (count) pool = pool.slice(0, count);
    if (!pool.length) { alert('선택한 단원에 학습할 단어가 없습니다.'); return; }
    startStudy(pool, studySetupKind);
  });
}

function openTypingSetup(scope = 'all') { typingSetupScope = scope; route = 'typing-setup'; render(); }

function typingSetup() {
  const source = typingSetupScope === 'weak' ? weakWordQueue(state) : state.words;
  shell(`<div class="page-head"><div><p class="eyebrow">ACTIVE RECALL</p><h1>타이핑 학습 설정</h1><p class="sub">여러 단원과 문제 방향을 함께 선택하세요.</p></div></div><section class="panel typing-setup"><form id="typing-setup-form"><label>문제 방향<select name="direction"><option value="meaning">영어 한글 뜻 입력</option><option value="spelling">한글 뜻 영어 단어 입력</option><option value="copy-meaning">영어＋한글 뜻 한글 따라 치기</option></select></label><label>학습 범위<select name="scope"><option value="all" ${typingSetupScope === 'all' ? 'selected' : ''}>전체 단어</option><option value="due">오늘 학습할 단어</option><option value="weak" ${typingSetupScope === 'weak' ? 'selected' : ''}>틀린 단어만</option></select></label><label>문제 수<select name="count"><option value="10">10개</option><option value="20" selected>20개</option><option value="30">30개</option><option value="0">선택 단원 전체</option></select></label><div class="day-select-block"><div class="day-select-head"><strong>Day 다중 선택</strong><span><button type="button" class="text-btn" data-days="all">전체 선택</button><button type="button" class="text-btn" data-days="none">전체 해제</button></span></div><div class="day-choices">${dayChoices(source)}</div></div><button class="primary">학습 시작하기</button></form><p class="setup-note">Day 7·8·9처럼 원하는 단원을 여러 개 선택할 수 있습니다.</p></section>`);
  const form = app.querySelector('#typing-setup-form');
  bindDayChoiceControls(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const options = Object.fromEntries(data);
    options.days = data.getAll('days');
    if (!options.days.length) { alert('학습할 단원을 하나 이상 선택하세요.'); return; }
    startTypingStudy(options);
  });
}

function startTypingStudy({ direction = 'meaning', scope = 'all', days = [], count = '20' } = {}) {
  const weak = weakWordQueue(state);
  const today = todayQueue(state);
  let pool = scope === 'weak' ? weak : scope === 'due' ? today : [...weak, ...today, ...state.words];
  pool = [...new Map(pool.map(word => [word.id, word])).values()];
  if (days.length) pool = wordsForDays(pool, days);
  const prioritized = pool.sort((a, b) => ((b.wrong || 0) - (b.correct || 0)) - ((a.wrong || 0) - (a.correct || 0)) || Math.random() - 0.5);
  typingQueue = Number(count) ? prioritized.slice(0, Number(count)) : prioritized;
  if (!typingQueue.length) { alert('선택한 범위에 학습할 단어가 없습니다.'); return; }
  typingDirection = direction; typingPreview = direction === 'copy-meaning' ? [] : typingQueue.filter(word => word.status === 'new');
  typingPreviewIndex = 0; typingIndex = 0; typingAnswered = false; typingFeedback = null; typingHintLevel = 0; typingStartedAt = 0; typingAttempts = new Map(); sessionResults = []; sessionKind = 'typing'; spokenStudyWordId = null;
  route = typingPreview.length ? 'typing-preview' : 'typing'; render();
}

function typingPreviewPage() {
  const word = typingPreview[typingPreviewIndex];
  if (!word) { route = 'typing'; typingStartedAt = Date.now(); render(); return; }
  shell(`<div class="study-top"><button class="text-btn" data-route="home">← 나가기</button><span>새 단어 미리 보기 ${typingPreviewIndex + 1} / ${typingPreview.length}</span></div><div class="study-progress"><i style="width:${((typingPreviewIndex + 1) / typingPreview.length) * 100}%"></i></div><section class="flashcard preview-card"><span class="tag">PREVIEW NEW WORD</span><p>${esc(word.partOfSpeech)}</p><div class="study-word"><h1>${esc(word.english)}</h1><button id="speak-preview" class="speak-button" aria-label="발음 듣기">🔊</button></div><div class="answer"><strong>${esc(representativeMeaning(word.meaning))}</strong></div><button class="primary preview-next" id="preview-next">${typingPreviewIndex + 1 === typingPreview.length ? '문제 풀기' : '다음 단어'}</button></section>`);
  app.querySelector('#speak-preview').addEventListener('click', () => pronounce(word.english)); pronounce(word.english);
  app.querySelector('#preview-next').addEventListener('click', () => { typingPreviewIndex += 1; typingPreviewPage(); });
}

function finishTypingAttempt(word, correct) {
  const attempts = (typingAttempts.get(word.id) || 0) + 1;
  typingAttempts.set(word.id, attempts);
  const copyMode = typingDirection === 'copy-meaning';
  const grade = correct ? 'good' : 'again';
  if (!copyMode) state.words = state.words.map(item => item.id === word.id ? gradeWord(item, grade) : item);
  sessionResults.push({ id: word.id, grade, correct, accuracy: typingFeedback.accuracy, responseMs: typingFeedback.responseMs, hints: typingFeedback.hints, attempt: attempts });
  if (!correct && attempts < 3) typingQueue.push(word);
  persist(); typingIndex += 1; typingAnswered = false; typingFeedback = null; typingHintLevel = 0; typingStartedAt = Date.now(); typing();
}

function typing() {
  const word = typingQueue[typingIndex];
  if (!word) { saveSession(); return; }
  if (!typingStartedAt) typingStartedAt = Date.now();
  const spelling = typingDirection === 'spelling';
  const copyMode = typingDirection === 'copy-meaning';
  const conciseMeaning = representativeMeaning(word.meaning);
  const expected = spelling ? word.english : copyMode ? word.meaning : conciseMeaning;
  const distanceNote = spelling && typingFeedback && !typingFeedback.correct && typingFeedback.input ? `<p class="spelling-distance">철자 차이: ${typingFeedback.distance}글자</p>` : '';
  const accuracyNote = copyMode && typingFeedback ? `<p class="copy-accuracy-result">입력 정확도: ${typingFeedback.accuracy}%</p>` : '';
  const feedback = typingFeedback ? `<div class="typing-feedback ${typingFeedback.correct ? 'correct-box' : 'wrong-box'}"><b>${typingFeedback.correct ? '정확하게 입력했어요!' : '다른 글자가 있어요'}</b><p>입력: ${esc(typingFeedback.input || '(입력 없음)')}</p><p>정답: ${esc(expected)}</p>${distanceNote}${accuracyNote}${typingFeedback.correct || spelling || copyMode ? '' : '<button class="secondary" id="accept-answer">내 답도 정답으로 인정</button>'}<button class="primary" id="typing-next">${typingIndex + 1 === typingQueue.length ? '결과 보기' : '다음 단어'}</button><small>${(typingFeedback.responseMs / 1000).toFixed(1)}초${copyMode ? '' : ` · 힌트 ${typingFeedback.hints}단계 사용`}</small></div>` : '';
  const hintValue = spelling ? englishHint(word.english, typingHintLevel) : meaningHint(conciseMeaning, typingHintLevel);
  const hint = typingHintLevel ? `<p class="hint-output">힌트 ${typingHintLevel}: ${esc(hintValue)}</p>` : '';
  const prompt = spelling ? `<div class="meaning-prompt"><h2>${esc(conciseMeaning)}</h2><p>${esc(word.partOfSpeech)}</p></div>` : copyMode ? `<p>${esc(word.partOfSpeech)}</p><div class="study-word"><h1>${esc(word.english)}</h1><button id="speak-typing" class="speak-button" aria-label="발음 다시 듣기">🔊</button></div><div class="copy-target">${esc(word.meaning)}</div>` : `<p>${esc(word.partOfSpeech)}</p><div class="study-word"><h1>${esc(word.english)}</h1><button id="speak-typing" class="speak-button" aria-label="발음 다시 듣기">🔊</button></div>`;
  const guide = spelling ? '한글 뜻에 맞는 영어 단어 또는 숙어를 정확히 입력하세요.' : copyMode ? '화면의 한글 뜻을 그대로 따라 입력하세요.' : '기억나는 한글 뜻을 입력하세요. 여러 뜻 중 하나만 맞혀도 됩니다.';
  const placeholder = spelling ? '영어 단어 입력' : '한글 뜻 입력';
  const inputField = copyMode ? `<textarea id="meaning-input" autocomplete="off" spellcheck="false" placeholder="${placeholder}" required></textarea><div class="copy-meter"><i id="copy-meter-bar"></i><span id="copy-meter-text">0 / ${expected.length}자 · 정확도 100%</span></div>` : `<input id="meaning-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${placeholder}" required>`;
  const tools = copyMode ? '' : `<div class="typing-tools"><button class="secondary" id="typing-hint" ${typingHintLevel >= 3 ? 'disabled' : ''}>힌트 보기</button><button class="text-btn" id="typing-give-up">모르겠어요</button></div>`;
  shell(`<div class="study-top"><button class="text-btn" data-route="home">← 나가기</button><span>${spelling ? '영단어' : copyMode ? '한글 따라 치기' : '뜻'} ${typingIndex + 1} / ${typingQueue.length}</span></div><div class="study-progress"><i style="width:${(typingIndex / typingQueue.length) * 100}%"></i></div><section class="flashcard typing-card ${copyMode ? 'copy-card' : ''}"><span class="tag">${spelling ? 'TYPE THE ENGLISH WORD' : copyMode ? 'KOREAN TYPING PRACTICE' : 'TYPE THE MEANING'}</span>${prompt}${typingAnswered ? feedback : `<p class="typing-guide">${guide}</p>${copyMode ? '' : hint}<form id="typing-form">${inputField}<button class="primary">입력 확인</button></form>${tools}`}</section>`);
  app.querySelector('#speak-typing')?.addEventListener('click', () => pronounce(word.english));
  if (!spelling && spokenStudyWordId !== word.id) { spokenStudyWordId = word.id; pronounce(word.english); }
  const submit = (input) => {
    if (typingAnswered) return;
    const graded = spelling ? gradeEnglishAnswer(input, word.english) : copyMode ? gradeCopyAnswer(input, word.meaning) : gradeMeaningAnswer(input, conciseMeaning);
    typingAnswered = true; typingFeedback = { correct: graded.correct, input, distance: graded.distance, accuracy: graded.accuracy, responseMs: Date.now() - typingStartedAt, hints: typingHintLevel };
    if (spelling) pronounce(word.english);
    typing();
  };
  app.querySelector('#typing-form')?.addEventListener('submit', event => { event.preventDefault(); submit(app.querySelector('#meaning-input').value.trim()); });
  app.querySelector('#typing-give-up')?.addEventListener('click', () => submit(''));
  app.querySelector('#typing-hint')?.addEventListener('click', () => { typingHintLevel += 1; typing(); });
  app.querySelector('#accept-answer')?.addEventListener('click', () => finishTypingAttempt(word, true));
  app.querySelector('#typing-next')?.addEventListener('click', () => finishTypingAttempt(word, typingFeedback.correct));
  const typingInput = app.querySelector('#meaning-input');
  typingInput?.addEventListener('input', () => { if (!copyMode) return; const progress = copyProgress(typingInput.value, word.meaning); app.querySelector('#copy-meter-bar').style.width = `${Math.min(100, progress.typed / Math.max(1, progress.total) * 100)}%`; app.querySelector('#copy-meter-text').textContent = `${progress.typed} / ${progress.total}자 · 정확도 ${progress.accuracy}%`; });
  typingInput?.focus();
}
function study() {
  const word = queue[activeIndex];
  if (!word) return finishStudy();
  shell(`<div class="study-top"><button class="text-btn" data-route="home">← 나가기</button><span>${activeIndex + 1} / ${queue.length}</span></div><div class="study-progress"><i style="width:${(activeIndex / queue.length) * 100}%"></i></div><section class="flashcard"><span class="tag">${word.status === 'new' ? 'NEW WORD' : 'REVIEW'}</span><p>${esc(word.partOfSpeech)}</p><div class="study-word"><h1>${esc(word.english)}</h1><button id="speak-study" class="speak-button" aria-label="발음 다시 듣기" title="발음 다시 듣기">🔊</button></div>${revealed ? `<div class="answer"><strong>${esc(word.meaning)}</strong>${word.example ? `<p>${esc(word.example)}</p>` : ''}${word.exampleMeaning ? `<small>${esc(word.exampleMeaning)}</small>` : ''}</div><div class="grades"><button data-grade="again">모름<small>10분 후</small></button><button data-grade="hard">어려움<small>1일 후</small></button><button data-grade="good">알고 있음<small>${word.interval ? Math.max(3, Math.round(word.interval * 2.3)) : 1}일 후</small></button></div>` : `<button class="primary reveal" id="reveal">뜻 확인하기</button><small class="hint">먼저 머릿속으로 뜻을 떠올려 보세요.</small>`}</section>`);
  app.querySelector('#speak-study')?.addEventListener('click', () => pronounce(word.english));
  if (spokenStudyWordId !== word.id) { spokenStudyWordId = word.id; pronounce(word.english); }
  app.querySelector('#reveal')?.addEventListener('click', () => { revealed = true; study(); });
  app.querySelectorAll('[data-grade]').forEach(btn => btn.addEventListener('click', () => {
    const grade = btn.dataset.grade;
    state.words = state.words.map(w => w.id === word.id ? gradeWord(w, grade) : w);
    sessionResults.push({ id: word.id, grade }); persist(); activeIndex += 1; revealed = false; study();
  }));
}
function finishStudy() {
  quizQueue = queue.filter(w => w.example && new RegExp(`\\b${w.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(w.example));
  quizIndex = 0; quizCorrect = 0;
  if (quizQueue.length) { route = 'quiz'; render(); return; }
  saveSession();
}
function quiz() {
  const word = quizQueue[quizIndex];
  if (!word) { saveSession(); return; }
  const escaped = word.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blank = word.example.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '________');
  shell(`<div class="study-top"><button class="text-btn" data-route="home">← 나가기</button><span>문장 퀴즈 ${quizIndex + 1} / ${quizQueue.length}</span></div><div class="study-progress"><i style="width:${(quizIndex / quizQueue.length) * 100}%"></i></div><section class="flashcard quiz-card"><span class="tag">CONTEXT QUIZ</span><h2>${esc(blank)}</h2><p>${esc(word.exampleMeaning || '빈칸에 들어갈 단어를 입력하세요.')}</p><form id="quiz-form"><input id="quiz-answer" autocomplete="off" placeholder="영어 단어 입력" required><button class="primary">정답 확인</button></form><p id="quiz-feedback"></p></section>`);
  app.querySelector('#quiz-form').addEventListener('submit', e => {
    e.preventDefault(); const input = app.querySelector('#quiz-answer'); const correct = input.value.trim().toLowerCase() === word.english.toLowerCase();
    if (correct) quizCorrect += 1;
    app.querySelector('#quiz-feedback').innerHTML = correct ? '<b class="correct">정답이에요!</b>' : `<b class="wrong">정답: ${esc(word.english)}</b>`;
    pronounce(word.english);
    state.words = state.words.map(item => item.id === word.id ? { ...item, correct: item.correct + (correct ? 1 : 0), wrong: item.wrong + (correct ? 0 : 1), updatedAt: new Date().toISOString() } : item);
    persist();
    input.disabled = true; const button = e.target.querySelector('button'); button.type = 'button'; button.textContent = '다음 문제';
    button.addEventListener('click', () => { quizIndex += 1; quiz(); }, { once: true });
  });
}
function saveSession() { const responseTimes = sessionResults.map(item => item.responseMs).filter(Number.isFinite); const result = { id: crypto.randomUUID(), date: new Date().toISOString(), type: sessionKind, direction: sessionKind === 'typing' ? typingDirection : null, total: sessionResults.length, correct: sessionResults.filter(r => r.correct ?? r.grade === 'good').length, quizTotal: quizQueue.length, quizCorrect, averageResponseMs: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null }; state.sessions.push(result); persist(); route = 'result'; render(); }
function result() { const good = sessionResults.filter(r => r.correct ?? r.grade === 'good').length; const typingTitle = typingDirection === 'spelling' ? '영단어 타이핑 학습을 마쳤어요' : typingDirection === 'copy-meaning' ? '한글 뜻 따라 치기를 마쳤어요' : '뜻 타이핑 학습을 마쳤어요'; const title = sessionKind === 'weak' ? '틀린 단어 복습을 마쳤어요' : sessionKind === 'typing' ? typingTitle : '오늘의 학습을 마쳤어요'; const times = sessionResults.map(item => item.responseMs).filter(Number.isFinite); const average = times.length ? (times.reduce((sum, value) => sum + value, 0) / times.length / 1000).toFixed(1) : null; const accuracies = sessionResults.map(item => item.accuracy).filter(Number.isFinite); const copyAverage = accuracies.length ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length) : null; shell(`<section class="complete"><span>✓</span><p class="eyebrow">SESSION COMPLETE</p><h1>${title}</h1><p>${sessionResults.length}문제 중 ${good}개를 정확히 입력했습니다.${copyAverage !== null ? `<br>평균 입력 정확도 ${copyAverage}%` : ''}${average ? `<br>평균 응답 시간 ${average}초` : ''}${sessionKind === 'weak' ? `<br>남은 약점 단어 ${weakWordQueue(state).length}개` : ''}${quizQueue.length ? `<br>문장 퀴즈 ${quizQueue.length}개 중 ${quizCorrect}개 정답` : ''}</p><button class="primary" data-route="${sessionKind === 'weak' ? 'stats' : 'home'}">${sessionKind === 'weak' ? '학습 기록 보기' : '오늘로 돌아가기'}</button></section>`); }

function stats() {
  const recent = state.sessions.slice(-7).reverse(); const weak = weakWordQueue(state);
  shell(`<div class="page-head"><div><p class="eyebrow">MY PROGRESS</p><h1>학습 기록</h1></div><button class="primary" id="study-weak" ${weak.length ? '' : 'disabled'}>${weak.length ? `틀린 단어 ${weak.length}개 복습하기` : '복습할 틀린 단어 없음'}</button></div><section class="metrics"><article><span>학습 세션</span><strong>${state.sessions.length}</strong><small>SESSIONS</small></article><article><span>누적 학습</span><strong>${state.sessions.reduce((a,s)=>a+s.total,0)}</strong><small>REVIEWS</small></article><article><span>약점 단어</span><strong>${weak.length}</strong><small>WEAK WORDS</small></article></section><section class="split"><article class="panel"><h3>최근 학습</h3>${recent.length ? recent.map(s=>`<div class="history"><span>${new Date(s.date).toLocaleDateString('ko-KR')}${s.type === 'weak' ? ' · 오답 복습' : s.type === 'typing' ? ` · ${s.direction === 'spelling' ? '영단어 타이핑' : s.direction === 'copy-meaning' ? '한글 따라 치기' : '뜻 타이핑'}` : ''}</span><b>${s.total}개</b><em>${Math.round(s.correct/Math.max(1,s.total)*100)}%</em></div>`).join('') : '<div class="empty">아직 학습 기록이 없어요.</div>'}</article><article class="panel"><h3>아직 해결하지 못한 단어</h3>${weak.length ? weak.map(w=>`<div class="history"><b>${esc(w.english)}</b><span>${esc(w.meaning)}</span><em>오답 ${w.wrong} · 정답 ${w.correct}</em></div>`).join('') : '<div class="empty">약점 단어가 없어요.</div>'}</article></section>`);
  app.querySelector('#study-weak')?.addEventListener('click', () => openStudySetup('weak'));
}

function settings() {
  const voices = rankEnglishVoices(globalThis.speechSynthesis?.getVoices?.() || []);
  const voiceOptions = voices.map(voice => `<option value="${esc(voice.name)}" ${voice.name === state.settings.speechVoice ? 'selected' : ''}>${esc(voice.name)} (${esc(voice.lang)})</option>`).join('');
  shell(`<div class="page-head"><div><p class="eyebrow">PREFERENCES</p><h1>설정</h1></div></div><section class="panel settings"><form id="settings"><label>하루 새 단어 수<input name="dailyNew" type="number" min="1" max="100" value="${state.settings.dailyNew}"></label><label>하루 최대 복습 수<input name="dailyReview" type="number" min="1" max="300" value="${state.settings.dailyReview}"></label><label>영어 발음 음성<select name="speechVoice"><option value="">자동 선택 (고품질 우선)</option>${voiceOptions}</select></label><label>발음 속도<input name="speechRate" type="range" min="0.55" max="1.2" step="0.05" value="${state.settings.speechRate || 0.82}"><output id="rate-value">${Number(state.settings.speechRate || 0.82).toFixed(2)}×</output></label><button class="secondary" type="button" id="test-voice">예시 발음 듣기</button><button class="primary">설정 저장</button></form><hr><h3>데이터 백업</h3><p>모든 단어, 복습 일정과 기록을 JSON 파일로 보관할 수 있어요.</p><div class="actions"><button class="secondary" id="export">백업 내려받기</button><label class="secondary">백업 복원<input id="restore" type="file" accept=".json" hidden></label></div></section>`);
  const form = app.querySelector('#settings');
  form.elements.speechRate.addEventListener('input', e => { app.querySelector('#rate-value').textContent = `${Number(e.target.value).toFixed(2)}×`; });
  app.querySelector('#test-voice').addEventListener('click', () => { const data = Object.fromEntries(new FormData(form)); speakEnglish('comfortable pronunciation', globalThis.speechSynthesis, globalThis.SpeechSynthesisUtterance, { voiceName: data.speechVoice, rate: +data.speechRate }); });
  form.addEventListener('submit', e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); state.settings = { dailyNew: +data.dailyNew, dailyReview: +data.dailyReview, speechVoice: data.speechVoice, speechRate: +data.speechRate }; persist(); route='home'; render(); });
  app.querySelector('#export').addEventListener('click', () => { const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`word-garden-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); });
  app.querySelector('#restore').addEventListener('change', async e => { const epoch = accountEpoch; try { const restored = parseBackup(await e.target.files[0].text()); if (epoch !== accountEpoch) return; if (!confirm('현재 단어장과 학습 기록을 선택한 백업으로 바꿀까요?')) return; state = restored; persist(); render(); } catch (error) { alert(error.message); } });
}

function render() { ({ home, words, mistakes, import: imports, 'study-setup': studySetup, study, 'typing-setup': typingSetup, 'typing-preview': typingPreviewPage, typing, quiz, result, stats, settings }[route] || home)(); }

async function handleAccount() {
  if (!currentUser) { showAccount(); return; }
  const saved = await flushPendingSaves();
  if (!saved && !confirm('계정에 아직 저장하지 못한 변경 내용이 있습니다. 이 기기에 보관한 상태로 로그아웃할까요?')) return;
  const { error } = await auth.signOut();
  if (error) alert('로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
}

async function reloadAccount(discardLocal) {
  if (!currentUser || syncInProgress) return;
  if (discardLocal && !confirm('먼저 설정에서 현재 데이터를 백업해 주세요. 이 기기의 변경 내용을 서버 데이터로 바꿀까요?')) return;
  const epoch = accountEpoch;
  syncInProgress = syncInitialState(state, { discardLocal });
  try {
    const loaded = await syncInProgress;
    if (epoch === accountEpoch) { state = loaded; render(); }
  } catch (error) {
    if (error.name !== 'AbortError') console.error('계정 동기화를 완료하지 못했습니다.');
  } finally { if (epoch === accountEpoch) syncInProgress = null; }
}

async function applySession(event, session) {
  const id = session?.user?.id || null;
  if (id !== activeUserId) closeAccount();
  const recovery = event === 'PASSWORD_RECOVERY' || (session && new URLSearchParams(location.search).get('recovery') === '1');
  if (recovery) {
    const clean = new URL(location.href); clean.searchParams.delete('recovery'); history.replaceState(null, '', clean);
    showAccount('recovery');
  }
  if (id === activeUserId) return;
  activeUserId = id; currentUser = session?.user || null; accountEpoch++;
  configureStore(id, getAuthSession); syncInProgress = null;
  state = loadState(); route = 'home'; pendingRows = []; pendingFile = null;
  queue = []; sessionResults = []; quizQueue = []; typingQueue = []; typingPreview = [];
  activeIndex = 0; quizIndex = 0; typingIndex = 0; typingPreviewIndex = 0;
  typingAttempts = new Map(); typingFeedback = null; revealed = false; spokenStudyWordId = null;
  globalThis.speechSynthesis?.cancel(); render();
  await reloadAccount(false);
}

async function bootstrap() {
  app.innerHTML = '<main><p role="status">학습 공간을 준비하고 있어요.</p></main>';
  window.addEventListener('word-garden-sync', event => updateSyncStatus(app, event.detail));
  window.addEventListener('online', () => { void reloadAccount(false); });
  window.addEventListener('beforeunload', event => { if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; } });
  if (!auth) { await applySession('INITIAL_SESSION', null); return; }
  auth.onAuthStateChange((event, session) => { setTimeout(() => { void applySession(event, session); }, 0); });
  try { await applySession('INITIAL_SESSION', await getAuthSession()); }
  catch { await applySession('SIGNED_OUT', null); }
}

bootstrap();
