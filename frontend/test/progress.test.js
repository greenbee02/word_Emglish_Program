import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { buildProgress, calendarMonth, dayKey, shiftDay, shiftMonth } from '../src/progress.js';
import { mountProgressView } from '../src/progress-view.js';

const now = new Date(2026, 10, 24, 14);
const session = (day, total = 10, correct = 8) => ({ date: new Date(2026, 10, day, 12).toISOString(), total, correct });
test('same-day sessions count once for streaks and accuracy is weighted by questions', () => {
  const model = buildProgress([session(22), session(23), session(24, 2, 0), session(24, 8, 8)], now);
  assert.equal(model.current, 3); assert.equal(model.longest, 3); assert.equal(model.days.size, 3);
  assert.equal(model.days.get('2026-11-24').sessions, 2);
  assert.equal(model.total, 30); assert.equal(model.accuracy, 80); assert.equal(model.status, 'done');
});
test('yesterday keeps the streak alive; a missed full day breaks it and keeps the best record', () => {
  const sessions = [19,20,21,22,23].map(day => session(day));
  const pending = buildProgress(sessions, now);
  assert.equal(pending.current,5); assert.equal(pending.status,'pending');
  const broken = buildProgress(sessions, new Date(2026,10,25,0,1));
  assert.equal(broken.current,0); assert.equal(broken.status,'broken'); assert.equal(broken.longest,5); assert.equal(broken.previousRun,5);
  const restarted = buildProgress([...sessions, session(25)], new Date(2026,10,25,12));
  assert.equal(restarted.current,1); assert.equal(restarted.longest,5);
});
test('empty, future, invalid and zero-question sessions do not create study days', () => {
  const model = buildProgress([{date:'invalid',total:4},{date:null,total:4},{date:'',total:4},session(25),session(24,0),session(23,-2)],now);
  assert.equal(model.days.size,0); assert.equal(model.current,0); assert.equal(model.longest,0);
  assert.equal(model.status,'new'); assert.equal(model.accuracy,null);
  assert.equal(model.series(7).length,7); assert.equal(model.series(30).length,30);
  assert.equal(model.series(7).at(-1).key,'2026-11-24');
});
test('local dates, year boundaries and leap-month calendars retain consecutive days', () => {
  assert.equal(dayKey(new Date(2026,0,1,0,5)), '2026-01-01');
  assert.equal(shiftDay('2026-01-01',-1),'2025-12-31');
  assert.equal(shiftDay('2024-03-01',-1),'2024-02-29');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  const model = buildProgress([{ date: new Date(2025,11,31,23).toISOString(),total:3 },{ date: new Date(2026,0,1,1).toISOString(),total:2 }],new Date(2026,0,1,12));
  assert.equal(model.current,2);
  const leap = calendarMonth('2024-02',model);
  assert.equal(leap.days.length,29); assert.equal(leap.leading,4);
});
test('weekly comparisons include zero days and compare adjacent seven-day windows', () => {
  const model = buildProgress([session(11,5),session(17,5),session(18,12),session(24,8)],now);
  assert.equal(model.previousWeek,10); assert.equal(model.weekTotal,20); assert.equal(model.weekDays,2);
  assert.equal(model.series(7)[0].key,'2026-11-18');
});
test('calendar, chart period and review actions work without changing stored sessions', async () => {
  const dom = new Window(), root = dom.document.createElement('div'); dom.document.body.append(root);
  const sessions = [session(23),session(24)]; const original = JSON.stringify(sessions); let reviews = 0;
  try {
    mountProgressView(root,{sessions,weak:[{english:'<script>',meaning:'뜻',wrong:2,correct:0}],onStudyWeak:()=>reviews++,now});
    assert.match(root.textContent,/2일째/); assert.equal(root.querySelectorAll('.has-study').length,2);
    assert.equal(root.querySelectorAll('.chart-column').length,7);
    root.querySelector('[data-range="30"]').click(); assert.equal(root.querySelectorAll('.chart-column').length,30);
    root.querySelector('[data-day="2026-11-23"]').click();
    assert.match(root.querySelector('.calendar-detail').textContent,/2026년 11월 23일/);
    assert.match(root.querySelector('.calendar-detail').textContent,/학습 10문제/);
    root.querySelector('[data-month="-1"]').click(); assert.match(root.querySelector('.calendar-toolbar').textContent,/2026년 10월/);
    root.querySelector('[data-month="today"]').click(); assert.equal(root.querySelector('[data-month="1"]').disabled,true);
    assert.equal(root.querySelector('[data-day="2026-11-25"]').disabled,true);
    root.querySelector('#study-weak').click(); assert.equal(reviews,1);
    assert.equal(root.querySelector('script'),null); assert.equal(JSON.stringify(sessions),original);
  } finally { await dom.happyDOM.abort(); }
});
