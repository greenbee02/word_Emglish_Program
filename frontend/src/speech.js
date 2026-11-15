export function cleanPronunciationText(value = '') {
  return String(value).trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

export function rankEnglishVoices(voices = []) {
  const score = (voice) => {
    const name = String(voice.name || '').toLowerCase();
    const lang = String(voice.lang || '').toLowerCase();
    if (!lang.startsWith('en')) return -1000;
    let points = lang === 'en-us' ? 40 : 20;
    if (/natural|neural|premium|enhanced/.test(name)) points += 100;
    if (/google|microsoft/.test(name)) points += 30;
    if (voice.localService === false) points += 10;
    return points;
  };
  return [...voices].filter((voice) => score(voice) >= 0).sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)));
}

export function speakEnglish(value, speech = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, options = {}) {
  const text = cleanPronunciationText(value);
  if (!text || !speech || !Utterance) return false;
  speech.cancel();
  const utterance = new Utterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Math.min(1.2, Math.max(0.55, Number(options.rate) || 0.82));
  utterance.pitch = 1;
  const voices = rankEnglishVoices(speech.getVoices?.() || []);
  utterance.voice = voices.find((voice) => voice.name === options.voiceName) || voices[0] || null;
  speech.speak(utterance);
  return true;
}
