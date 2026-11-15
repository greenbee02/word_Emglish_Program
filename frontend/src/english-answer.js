export function normalizeEnglishAnswer(value = '') {
  return String(value).trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

export function editDistance(left = '', right = '') {
  const a = normalizeEnglishAnswer(left);
  const b = normalizeEnglishAnswer(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

export function gradeEnglishAnswer(input, english) {
  const answer = normalizeEnglishAnswer(input);
  const expected = normalizeEnglishAnswer(english);
  return { correct: !!answer && answer === expected, answer, expected, distance: editDistance(answer, expected) };
}

export function englishHint(english, level = 1) {
  const word = normalizeEnglishAnswer(english);
  const letters = word.replace(/[^a-z]/g, '');
  if (level === 1) return `알파벳 ${letters.length}자`;
  if (level === 2) return `첫 글자: ${word.slice(0, 1)}…`;
  return word.replace(/[a-z]/g, (char, index) => index % 2 ? '_' : char);
}
