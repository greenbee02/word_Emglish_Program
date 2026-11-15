import test from 'node:test';
import assert from 'node:assert/strict';
import { copyAccuracy, copyProgress, gradeCopyAnswer, normalizeCopyText } from '../src/copy-answer.js';

test('따라 치기는 줄바꿈과 연속 공백 차이를 하나의 공백으로 처리한다', () => {
  assert.equal(normalizeCopyText('비용을\n  상환하다'), '비용을 상환하다');
  assert.equal(gradeCopyAnswer('비용을  상환하다', '비용을 상환하다').correct, true);
});

test('따라 치기 정확도와 진행 상태를 계산한다', () => {
  assert.equal(copyAccuracy('지원자', '지원자'), 100);
  assert.ok(copyAccuracy('지언자', '지원자') < 100);
  assert.deepEqual(copyProgress('지원', '지원자'), { typed: 2, total: 3, matched: 2, accuracy: 67 });
});
