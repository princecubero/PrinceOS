const assert = require('assert').strict;

(async () => {
  const { organizeBrainDump } = await import('../src/brain-dump.mjs');
  const now = new Date(2026, 8, 16, 23, 30);
  const drafts = organizeBrainDump('Buy groceries tomorrow\nFinish portfolio by Friday\nUrgent: pay internet bill today\nClean my room', now);
  assert.deepEqual(drafts.map(({ title, due, priority }) => ({ title, due, priority })), [
    { title: 'Buy groceries', due: '2026-09-17', priority: 'Normal' },
    { title: 'Finish portfolio', due: '2026-09-18', priority: 'Normal' },
    { title: 'pay internet bill', due: '2026-09-16', priority: 'High' },
    { title: 'Clean my room', due: '', priority: 'Normal' },
  ]);
  assert.equal(drafts[2].detail, 'Urgent: pay internet bill today');
  assert.equal(drafts[0].status, 'todo');
  assert.equal(drafts[0].done, false);
  assert.deepEqual(organizeBrainDump(' \n\r\n'), []);
  assert.equal(organizeBrainDump('- Buy milk\r\n1. Call Alex')[1].title, 'Call Alex');
  assert.equal(organizeBrainDump('Review Wednesday', now)[0].due, '2026-09-23');
  assert.equal(organizeBrainDump('Review tomorrow', new Date(2026, 11, 31))[0].due, '2027-01-01');
  assert.equal(organizeBrainDump('Review tomorrow', new Date(2028, 1, 28))[0].due, '2028-02-29');
  assert.equal(organizeBrainDump('Review on 2026-02-30', now)[0].due, '');
  assert.equal(organizeBrainDump('Review on 2026-02-30', now)[0].title, 'Review on 2026-02-30');
  assert.equal(organizeBrainDump('Review on 2028-02-29', now)[0].due, '2028-02-29');
  assert.equal(organizeBrainDump('High priority: Call Alex', now)[0].priority, 'High');
  assert.equal(organizeBrainDump('Think about tomorrow and next month', now)[0].due, '');
  assert.equal(organizeBrainDump('Urgent:', now)[0].title, 'Urgent:');
  console.log('Brain dump parser checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
