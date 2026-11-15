import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRows, gradeWord, makeWord, parseBackup, weakWordQueue, wordsForDays } from '../src/store.js';

test('같은 단어와 뜻은 중복으로 분류한다', () => {
  const original = makeWord({ english: 'reimburse', meaning: '비용을 상환하다' });
  const [row] = classifyRows([{ english: ' Reimburse ', meaning: '비용을  상환하다' }], [original]);
  assert.equal(row.reviewState, 'duplicate');
  assert.equal(row.selected, false);
});

test('같은 단어의 다른 뜻은 검토 대상으로 분류한다', () => {
  const original = makeWord({ english: 'charge', meaning: '요금' });
  const [row] = classifyRows([{ english: 'charge', meaning: '청구하다' }], [original]);
  assert.equal(row.reviewState, 'needs-review');
});

test('한 파일 안에서 반복된 행도 중복으로 분류한다', () => {
  const rows = classifyRows([
    { english: 'shipment', meaning: '배송' },
    { english: 'shipment', meaning: '배송' },
  ], []);
  assert.equal(rows[0].reviewState, 'ready');
  assert.equal(rows[1].reviewState, 'duplicate');
});

test('알고 있음 응답은 복습일을 미래로 옮긴다', () => {
  const original = makeWord({ english: 'applicant', meaning: '지원자' });
  const graded = gradeWord(original, 'good');
  assert.equal(graded.status, 'learning');
  assert.equal(graded.correct, 1);
  assert.ok(new Date(graded.dueAt) > new Date());
});

test('백업 복원은 데이터와 설정을 검증한다', () => {
  const restored = parseBackup(JSON.stringify({
    words: [{ id: '1', english: 'invoice', meaning: '송장' }],
    sessions: [], imports: [], settings: { dailyNew: 15, dailyReview: 40 },
  }));
  assert.equal(restored.words[0].english, 'invoice');
  assert.equal(restored.settings.dailyNew, 15);
  assert.throws(() => parseBackup('{broken'));
  assert.throws(() => parseBackup(JSON.stringify({ words: 'invalid' })));
});

test('아직 해결하지 못한 틀린 단어만 오답 복습 목록에 넣는다', () => {
  const unresolved = { ...makeWord({ english: 'invoice', meaning: '송장' }), wrong: 2, correct: 0 };
  const partlyResolved = { ...makeWord({ english: 'shipment', meaning: '배송' }), wrong: 2, correct: 1 };
  const resolved = { ...makeWord({ english: 'applicant', meaning: '지원자' }), wrong: 1, correct: 1 };
  const untouched = makeWord({ english: 'reimburse', meaning: '상환하다' });
  assert.deepEqual(weakWordQueue({ words: [resolved, partlyResolved, untouched, unresolved] }).map(word => word.english), ['invoice', 'shipment']);
});

test('오답 복습에서 알고 있음으로 채점하면 약점 목록에서 빠진다', () => {
  const weak = { ...makeWord({ english: 'invoice', meaning: '송장' }), wrong: 1, correct: 0 };
  const graded = gradeWord(weak, 'good');
  assert.equal(weakWordQueue({ words: [graded] }).length, 0);
});

test('여러 Day를 동시에 선택하면 해당 단원의 단어만 반환한다', () => {
  const words = [
    { english: 'day7', day: 7 }, { english: 'day8', day: 8 },
    { english: 'day9', day: 9 }, { english: 'day10', day: 10 },
    { english: 'unsorted', day: null },
  ];
  assert.deepEqual(wordsForDays(words, ['7', '8', '9']).map(word => word.english), ['day7', 'day8', 'day9']);
  assert.deepEqual(wordsForDays(words, ['9', 'none']).map(word => word.english), ['day9', 'unsorted']);
  assert.deepEqual(wordsForDays(words, []), []);
});
