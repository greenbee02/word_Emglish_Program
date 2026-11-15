export function normalizeCopyText(value = '') {
  return String(value).trim().replace(/[“”]/g, '"').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

export function copyAccuracy(input, target) {
  const typed = normalizeCopyText(input);
  const expected = normalizeCopyText(target);
  if (!expected) return 0;
  const row = Array.from({ length: expected.length + 1 }, (_, index) => index);
  for (let i = 1; i <= typed.length; i += 1) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= expected.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (typed[i - 1] === expected[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return Math.max(0, Math.round((1 - row[expected.length] / Math.max(typed.length, expected.length, 1)) * 100));
}

export function gradeCopyAnswer(input, target) {
  const answer = normalizeCopyText(input);
  const expected = normalizeCopyText(target);
  return { correct: !!answer && answer === expected, answer, expected, accuracy: copyAccuracy(answer, expected) };
}

export function copyProgress(input, target) {
  const typed = normalizeCopyText(input);
  const expected = normalizeCopyText(target);
  let matched = 0;
  while (matched < typed.length && matched < expected.length && typed[matched] === expected[matched]) matched += 1;
  return { typed: typed.length, total: expected.length, matched, accuracy: copyAccuracy(typed, expected) };
}
