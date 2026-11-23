import test from 'node:test';
import assert from 'node:assert/strict';
import { copyAccuracy, copyMeaningCandidates, copyProgress, gradeCopyAnswer, normalizeCopyText } from '../src/copy-answer.js';

test('따라 치기는 줄바꿈과 연속 공백 차이를 하나의 공백으로 처리한다', () => {
  assert.equal(normalizeCopyText('비용을\n  상환하다'), '비용을 상환하다');
  assert.equal(gradeCopyAnswer('비용을  상환하다', '비용을 상환하다').correct, true);
});

test('따라 치기 정확도와 진행 상태를 계산한다', () => {
  assert.equal(copyAccuracy('지원자', '지원자'), 100);
  assert.ok(copyAccuracy('지언자', '지원자') < 100);
  assert.deepEqual(copyProgress('지원', '지원자'), { typed: 2, total: 3, matched: 2, accuracy: 67, correct: false });
});

test('여러 뜻 중 하나를 쓰면 영어 예문과 나머지 뜻을 입력하지 않아도 인정한다', () => {
  const target = '기대하다, 예상하다 expect 목 to V';
  assert.deepEqual(copyMeaningCandidates(target), ['기대하다', '예상하다']);
  assert.equal(gradeCopyAnswer('기대하다', target).correct, true);
  assert.equal(gradeCopyAnswer('예상하다', target).correct, true);
  assert.equal(gradeCopyAnswer('예상', target).correct, true);
  assert.equal(copyProgress('예상하다', target).accuracy, 100);
});

test('번호·괄호·영어 문법 설명은 따라 칠 필요가 없다', () => {
  assert.equal(gradeCopyAnswer('끝나다', '1. 결론짓다 (+that절) 2. 끝나다 (with)').correct, true);
  assert.equal(gradeCopyAnswer('지우다', '(벌금)부과하다, 지우다 impose a fine 벌금을 부과하다').correct, true);
  assert.equal(gradeCopyAnswer('건물', '(건물, 토지)사용').correct, false);
  assert.equal(gradeCopyAnswer('전문지식', '전문지식(in)(on)').correct, true);
  assert.equal(gradeCopyAnswer('예치하다', '(특정한 곳에)두다 예금(예치)하다 보증금, 저축예금').correct, true);
  assert.equal(gradeCopyAnswer('조짐', '말(암시, 조짐)').correct, true);
  assert.equal(gradeCopyAnswer('가산명사', '증명서(가산명사)').correct, false);
});

test('띄어쓰기·조사·기본 어미 차이를 허용하지만 뜻의 일부나 무관한 답은 거절한다', () => {
  assert.equal(gradeCopyAnswer('비용 상환', '비용을 상환하다').correct, true);
  assert.equal(gradeCopyAnswer('힘', '힘, 권력').correct, true);
  for (const answer of ['', ' ', '비용', '상환', '기', '배송', '예샹하다', '비용상환안']) {
    assert.equal(gradeCopyAnswer(answer, '비용을 상환하다, 기대하다, 예상하다').correct, false, answer);
  }
});
