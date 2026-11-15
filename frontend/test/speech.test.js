import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPronunciationText, rankEnglishVoices, speakEnglish } from '../src/speech.js';

test('영어 발음 텍스트의 불필요한 공백을 정리한다', () => {
  assert.equal(cleanPronunciationText('  on   a first-come basis  '), 'on a first-come basis');
});

test('미국 영어 음성을 우선해 단어를 재생한다', () => {
  const spoken = [];
  let cancelled = 0;
  class MockUtterance { constructor(text) { this.text = text; } }
  const speech = {
    cancel: () => { cancelled += 1; },
    getVoices: () => [{ name: 'Korean', lang: 'ko-KR' }, { name: 'English', lang: 'en-US' }],
    speak: (utterance) => spoken.push(utterance),
  };
  assert.equal(speakEnglish('applicant', speech, MockUtterance), true);
  assert.equal(cancelled, 1);
  assert.equal(spoken[0].text, 'applicant');
  assert.equal(spoken[0].lang, 'en-US');
  assert.equal(spoken[0].voice.lang, 'en-US');
  assert.equal(spoken[0].rate, 0.82);
});

test('음성 합성을 지원하지 않는 환경에서는 안전하게 건너뛴다', () => {
  assert.equal(speakEnglish('invoice', null, null), false);
  assert.equal(speakEnglish('', { speak() {} }, class {}), false);
});

test('일반 음성보다 Natural 영어 음성을 우선한다', () => {
  const voices = rankEnglishVoices([
    { name: 'Basic US', lang: 'en-US', localService: true },
    { name: 'Microsoft Natural', lang: 'en-US', localService: false },
    { name: 'Korean', lang: 'ko-KR', localService: true },
  ]);
  assert.deepEqual(voices.map(voice => voice.name), ['Microsoft Natural', 'Basic US']);
});
