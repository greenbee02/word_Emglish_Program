// Calendar days follow the learner's device timezone. UTC ordinals keep day
// differences stable across daylight-saving changes without rounding timestamps.
export function dayKey(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDay(key, offset) {
  const [year, month, day] = key.split('-').map(Number);
  return dayKey(new Date(year, month - 1, day + offset, 12));
}
const ordinal = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const accuracy = (correct, total) => total ? Math.round(correct / total * 100) : null;

export function buildProgress(sessions, now = new Date()) {
  const today = dayKey(now), days = new Map(), validSessions = [];
  for (const session of sessions) {
    const key = dayKey(session.date), total = Math.floor(Number(session.total));
    if (!key || key > today || !Number.isFinite(total) || total <= 0) continue;
    const correct = Math.min(total, Math.max(0, Math.floor(Number(session.correct) || 0)));
    const normalized = { ...session, total, correct };
    validSessions.push(normalized);
    const entry = days.get(key) || { key, total: 0, correct: 0, sessions: 0 };
    entry.total += total; entry.correct += correct; entry.sessions++;
    days.set(key, entry);
  }
  const dates = [...days.keys()].sort();
  let longest = 0, run = 0, previous;
  for (const key of dates) {
    run = previous && ordinal(key) - ordinal(previous) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run); previous = key;
  }
  const lastDay = dates.at(-1) || null;
  const current = lastDay && (lastDay === today || lastDay === shiftDay(today, -1)) ? run : 0;
  const series = count => Array.from({ length: count }, (_, i) => {
    const key = shiftDay(today, i - count + 1);
    return days.get(key) || { key, total: 0, correct: 0, sessions: 0 };
  });
  const week = series(7), previousWeek = Array.from({ length: 7 }, (_, i) => days.get(shiftDay(today, i - 13))?.total || 0).reduce((a, b) => a + b, 0);
  const total = validSessions.reduce((sum, s) => sum + s.total, 0);
  const correct = validSessions.reduce((sum, s) => sum + s.correct, 0);
  return { today, days, dates, lastDay, current, longest, previousRun: run,
    status: !lastDay ? 'new' : current ? days.has(today) ? 'done' : 'pending' : 'broken',
    sessions: validSessions.sort((a, b) => new Date(b.date) - new Date(a.date)),
    total, correct, accuracy: accuracy(correct, total), series,
    weekTotal: week.reduce((sum, d) => sum + d.total, 0), weekDays: week.filter(d => d.total > 0).length, previousWeek };
}

export function calendarMonth(monthKey, progress) {
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 12), count = new Date(year, month, 0, 12).getDate();
  return { label: `${year}년 ${month}월`, leading: start.getDay(), days: Array.from({ length: count }, (_, index) => {
    const key = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
    return { key, day: index + 1, future: key > progress.today, ...(progress.days.get(key) || { total: 0, correct: 0, sessions: 0 }) };
  }) };
}
export function shiftMonth(key, offset) {
  const [year, month] = key.split('-').map(Number);
  return dayKey(new Date(year, month - 1 + offset, 1, 12)).slice(0, 7);
}
