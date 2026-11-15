import test from 'node:test';
import assert from 'node:assert/strict';
import { editDistance, englishHint, gradeEnglishAnswer, normalizeEnglishAnswer } from '../src/english-answer.js';

test('영단어 채점은 대소문자와 앞뒤 공백을 허용한다', () => {
  assert.equal(normalizeEnglishAnswer('  First-Come   Basis '), 'first-come basis');
  assert.equal(gradeEnglishAnswer(' Applicant ', 'applicant').correct, true);
});

test('철자가 다르면 오답과 편집 거리를 반환한다', () => {
  const result = gradeEnglishAnswer('aplicant', 'applicant');
  assert.equal(result.correct, false);
  assert.equal(result.distance, 1);
  assert.equal(editDistance('favor', 'favour'), 1);
});

test('영단어 힌트를 단계별로 만든다', () => {
  assert.equal(englishHint('real estate', 1), '알파벳 10자');
  assert.equal(englishHint('real estate', 2), '첫 글자: r…');
  assert.match(englishHint('real estate', 3), /_/);
});
