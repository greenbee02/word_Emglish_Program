import { createSyncStore } from './sync.js';
const API_BASE_URL = String(import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
let sessionProvider = async () => null;
const syncStore = createSyncStore({ storage: globalThis.localStorage, apiBase: API_BASE_URL,
  getSession: () => sessionProvider(), onStatus: (detail) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('word-garden-sync', { detail }));
  },
});
export function configureStore(userId, getSession) { sessionProvider = getSession || (async () => null); syncStore.setUser(userId); }
export const flushPendingSaves = () => syncStore.flush();
export const hasUnsavedChanges = () => syncStore.isDirty();
export const getSyncStatus = () => syncStore.getStatus();
export const getGuestState = () => ({ ...emptyState(), ...syncStore.guest() });

export const emptyState = () => ({
  words: [],
  imports: [],
  sessions: [],
  settings: { dailyNew: 10, dailyReview: 30, speechVoice: '', speechRate: 0.82 },
});

export function loadState() {
  return { ...emptyState(), ...syncStore.load() };
}

export function saveState(state) {
  syncStore.save(state);
}

export async function syncInitialState(localState, options) {
  return { ...emptyState(), ...await syncStore.sync(localState, options) };
}

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 형식이 아닙니다.'); }
  if (!data || !Array.isArray(data.words) || !Array.isArray(data.sessions)) {
    throw new Error('Word Garden 백업 형식이 아닙니다.');
  }
  const settings = data.settings || {};
  return {
    ...emptyState(),
    ...data,
    imports: Array.isArray(data.imports) ? data.imports : [],
    settings: {
      dailyNew: Number.isInteger(+settings.dailyNew) && +settings.dailyNew > 0 ? +settings.dailyNew : 10,
      dailyReview: Number.isInteger(+settings.dailyReview) && +settings.dailyReview > 0 ? +settings.dailyReview : 30,
      speechVoice: typeof settings.speechVoice === 'string' ? settings.speechVoice : '',
      speechRate: Number(settings.speechRate) >= 0.55 && Number(settings.speechRate) <= 1.2 ? Number(settings.speechRate) : 0.82,
    },
  };
}

export function normalizeEnglish(value = '') {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeMeaning(value = '') {
  return value.trim().replace(/\s+/g, ' ');
}

export function makeWord(row, source = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    english: normalizeEnglish(row.english),
    meaning: normalizeMeaning(row.meaning),
    partOfSpeech: (row.partOfSpeech || '').trim(),
    example: (row.example || '').trim(),
    exampleMeaning: (row.exampleMeaning || '').trim(),
    day: Number(row.day) || null,
    number: row.number ? String(row.number) : '',
    source,
    status: 'new',
    interval: 0,
    dueAt: now,
    correct: 0,
    wrong: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function classifyRows(rows, words) {
  const existing = new Map(words.map((w) => [`${normalizeEnglish(w.english)}|${normalizeMeaning(w.meaning)}`, w]));
  const englishIndex = new Map(words.map((w) => [normalizeEnglish(w.english), w]));
  return rows.map((row) => {
    const english = normalizeEnglish(row.english);
    const meaning = normalizeMeaning(row.meaning);
    let reviewState = 'ready';
    let note = '';
    if (!english || !meaning) {
      reviewState = 'needs-review';
      note = !english ? '영어 단어가 없습니다.' : '뜻이 없습니다.';
    } else if (existing.has(`${english}|${meaning}`)) {
      reviewState = 'duplicate';
      note = '같은 단어와 뜻이 이미 있습니다.';
    } else if (englishIndex.has(english)) {
      reviewState = 'needs-review';
      note = '같은 단어의 다른 뜻일 수 있습니다.';
    }
    const classified = { ...row, english, meaning, reviewState, note, selected: reviewState !== 'duplicate' };
    if (english && meaning && reviewState !== 'duplicate') {
      existing.set(`${english}|${meaning}`, classified);
      if (!englishIndex.has(english)) englishIndex.set(english, classified);
    }
    return classified;
  });
}

export function gradeWord(word, grade) {
  const now = new Date();
  let days = 0;
  if (grade === 'again') days = 0;
  if (grade === 'hard') days = Math.max(1, Math.round((word.interval || 1) * 1.5));
  if (grade === 'good') days = word.interval ? Math.max(3, Math.round(word.interval * 2.3)) : 1;
  const due = new Date(now);
  grade === 'again' ? due.setMinutes(due.getMinutes() + 10) : due.setDate(due.getDate() + days);
  return {
    ...word,
    status: 'learning',
    interval: days,
    dueAt: due.toISOString(),
    correct: word.correct + (grade === 'good' ? 1 : 0),
    wrong: word.wrong + (grade === 'again' ? 1 : 0),
    updatedAt: now.toISOString(),
  };
}

export function todayQueue(state) {
  const now = Date.now();
  const review = state.words
    .filter((w) => w.status !== 'new' && new Date(w.dueAt).getTime() <= now)
    .slice(0, state.settings.dailyReview);
  const fresh = state.words.filter((w) => w.status === 'new').slice(0, state.settings.dailyNew);
  return [...review, ...fresh];
}

export function weakWordQueue(state) {
  return [...state.words]
    .filter((word) => (Number(word.wrong) || 0) > (Number(word.correct) || 0))
    .sort((a, b) => ((Number(b.wrong) || 0) - (Number(b.correct) || 0)) - ((Number(a.wrong) || 0) - (Number(a.correct) || 0)) || new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
}

export function wordsForDays(words, selectedDays) {
  const selected = new Set((selectedDays || []).map(String));
  if (!selected.size) return [];
  return words.filter((word) => word.day ? selected.has(String(word.day)) : selected.has('none'));
}
