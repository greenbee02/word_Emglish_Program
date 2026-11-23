import { normalizeKoreanAnswer } from './meaning-answer.js';

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

export function copyMeaningCandidates(target = '') {
  // Parentheses are context notes; English tails are examples or grammar notes.
  // Split after removing those notes so commas inside a note aren't new answers.
  const expanded = String(target).replace(/([가-힣]+)\(([가-힣]+(?:\s*[,/]\s*[가-힣]+)*)\)([가-힣]*)/g, (original, base, aliases, suffix) => {
    if (!suffix && !/[,/]/.test(aliases)) return original;
    return [base, ...aliases.split(/\s*[,/]\s*/)].map(label => label + suffix).join(', ');
  });
  const candidates = expanded.replace(/\([^)]*\)/g, '').replace(/\d+[.)]\s*/g, '\n')
    .replace(/([가-힣]다)\s+(?=[가-힣])/g, '$1\n')
    .split(/[\n,;\/|]+/)
    .map(part => part.split(/[A-Za-z=↔]/)[0].replace(/^[-~\s]+/, '').trim())
    .filter(part => /[가-힣]/.test(part));
  return [...new Set(candidates)];
}

export function gradeCopyAnswer(input, target) {
  const answer = normalizeCopyText(input);
  const fullTarget = normalizeCopyText(target);
  const candidates = copyMeaningCandidates(target);
  const normalized = normalizeKoreanAnswer(answer);
  // An exact normalized meaning also allows one-character meanings, but a
  // short fragment of a longer meaning never qualifies on its own.
  const matched = normalized && candidates.find(candidate => normalized === normalizeKoreanAnswer(candidate));
  const expected = matched || candidates.reduce((best, candidate) => copyAccuracy(answer, candidate) > copyAccuracy(answer, best) ? candidate : best, candidates[0] || fullTarget);
  const correct = !!answer && (answer === fullTarget || Boolean(matched));
  return { correct, answer, expected, accuracy: correct ? 100 : copyAccuracy(answer, expected) };
}

export function copyProgress(input, target) {
  const typed = normalizeCopyText(input);
  const graded = gradeCopyAnswer(input, target);
  const expected = normalizeCopyText(graded.expected);
  let matched = 0;
  while (matched < typed.length && matched < expected.length && typed[matched] === expected[matched]) matched += 1;
  return { typed: typed.length, total: expected.length, matched, accuracy: graded.accuracy, correct: graded.correct };
}
