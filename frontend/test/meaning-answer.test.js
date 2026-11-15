import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedMeanings, gradeMeaningAnswer, koreanInitials, meaningHint, normalizeKoreanAnswer, representativeMeaning } from '../src/meaning-answer.js';

test('띄어쓰기와 기본 조사 및 하다 어미 차이를 허용한다', () => {
  assert.equal(normalizeKoreanAnswer('비용을 상환하다'), '비용상환');
  assert.equal(gradeMeaningAnswer('비용 상환', '비용을 상환하다').correct, true);
});

test('여러 뜻 중 대표 뜻 하나를 맞히면 정답으로 처리한다', () => {
  assert.equal(gradeMeaningAnswer('선호', '호의, 선호\n선호하다, 편애하다').correct, true);
  assert.equal(gradeMeaningAnswer('배송', '호의, 선호').correct, false);
});

test('정답의 일부에 불과한 짧은 단어는 오답으로 처리한다', () => {
  assert.equal(gradeMeaningAnswer('비용', '비용을 상환하다').correct, false);
  assert.equal(gradeMeaningAnswer('상환', '비용을 상환하다').correct, false);
});

test('예문과 번호가 포함된 뜻에서 한글 후보를 분리한다', () => {
  const candidates = acceptedMeanings('1. 뛰어난, 훌륭한\n=excellent, superb\n2. 미결제된');
  assert.deepEqual(candidates.map(item => item.label), ['뛰어난', '훌륭한', '미결제된']);
});

test('뜻의 글자 수, 초성, 첫 글자 힌트를 단계별로 만든다', () => {
  assert.equal(koreanInitials('비용 상환'), 'ㅂㅇㅅㅎ');
  assert.equal(meaningHint('비용 상환', 1), '글자 수: 4자');
  assert.equal(meaningHint('비용 상환', 2), '초성: ㅂㅇㅅㅎ');
  assert.equal(meaningHint('비용 상환', 3), '첫 글자: 비…');
});

test('타이핑용 대표 뜻은 앞의 한글 뜻 두 개만 남기고 영어 예문을 제외한다', () => {
  const meaning = '호의적인, 우호적인, 유리한\nfavorable weather conditions\n좋은 날씨\n=advantageous';
  assert.equal(representativeMeaning(meaning), '호의적인, 우호적인');
});
