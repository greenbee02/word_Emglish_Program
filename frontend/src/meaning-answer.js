export function normalizeKoreanAnswer(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[0-9]+[.)]?/g, '')
    .replace(/[.,;:!?/\\]+/g, ' ')
    .replace(/(으로|에서|에게|한테|까지|부터|처럼|보다|의|을|를|이|가|은|는|에|와|과|도)(?=\s|$)/g, '')
    .replace(/[^가-힣a-z]/g, '')
    .replace(/(하는|하다|한다|되는|되다|된다)$/g, '');
}

export function acceptedMeanings(meaning = '') {
  return String(meaning)
    .split(/[\n,;\/]+/)
    .map((part) => part.replace(/^[0-9]+[.)]?\s*/, '').trim())
    .filter((part) => /[가-힣]/.test(part))
    .map((label) => ({ label, normalized: normalizeKoreanAnswer(label) }))
    .filter((item) => item.normalized.length >= 2);
}

export function representativeMeaning(meaning = '', limit = 2) {
  const seen = new Set();
  const labels = acceptedMeanings(meaning)
    .filter(({ label }) => !/[A-Za-z]{2,}/.test(label) && !/^\s*[=↔]/.test(label))
    .filter(({ normalized }) => {
      if (seen.has(normalized)) return false;
      seen.add(normalized); return true;
    })
    .slice(0, limit)
    .map(({ label }) => label.replace(/^[-=↔]\s*/, '').trim());
  if (labels.length) return labels.join(', ');
  return String(meaning).split('\n').find(line => /[가-힣]/.test(line))?.trim() || String(meaning).trim();
}

export function gradeMeaningAnswer(input, meaning) {
  const answer = normalizeKoreanAnswer(input);
  const candidates = acceptedMeanings(meaning);
  if (!answer) return { correct: false, answer, candidates };
  const correct = candidates.some(({ normalized }) => {
    if (answer === normalized) return true;
    const shorter = Math.min(answer.length, normalized.length);
    const longer = Math.max(answer.length, normalized.length);
    return shorter >= 3 && shorter / longer >= 0.75 && (answer.includes(normalized) || normalized.includes(answer));
  });
  return { correct, answer, candidates };
}

export function koreanInitials(value = '') {
  const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  return [...String(value)].map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? initials[Math.floor(code / 588)] : /[a-zA-Z]/.test(char) ? char : '';
  }).join('');
}

export function meaningHint(meaning, level = 1) {
  const candidate = acceptedMeanings(meaning)[0]?.label || String(meaning).split(/[,\n]/)[0].trim();
  const compact = candidate.replace(/\s+/g, '');
  if (level === 1) return `글자 수: ${compact.length}자`;
  if (level === 2) return `초성: ${koreanInitials(candidate)}`;
  return `첫 글자: ${compact.slice(0, 1)}…`;
}
