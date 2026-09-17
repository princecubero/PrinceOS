import assert from 'node:assert/strict';
import { prepareDrafts, duplicateTasks, draftError, applySuggestions, dailyPlan } from '../src/brain-dump-review.mjs';
const today = '2026-09-17';
const old = { id: 'old', title: 'Pay internet bill', detail: 'Account reference', due: today, status: 'done', done: true, category: 'Home' };
const state = { tasks: [old], notes: [], goals: [], events: {}, habits: [], transactions: [], fitness: [] };
const base = { title: old.title, detail: 'Pay internet bill tomorrow', due: '2026-09-18', priority: 'High' };
assert.equal(duplicateTasks('Pay the internet bill', [old]).length, 1);
assert.equal(duplicateTasks('Walk the dog', [old]).length, 0);
const [draft] = prepareDrafts([base], [old]);
assert.equal(draft.action, 'review');
assert.ok(draftError(draft));
draft.action = 'update'; draft.updateId = old.id;
const updated = applySuggestions(state, [draft], today);
assert.equal(updated.tasks.length, 1);
assert.equal(updated.tasks[0].done, true);
assert.equal(updated.tasks[0].category, 'Home');
assert.ok(updated.tasks[0].detail.includes('Account reference'));
assert.equal(old.due, today);
assert.throws(() => applySuggestions(state, [draft, { ...draft, id: 'second' }], today));
const mixed = prepareDrafts([
  { ...base, type: 'note', title: 'Keep this idea' },
  { ...base, type: 'goal', title: 'Portfolio', steps: [{ title: 'Pick projects', selected: true }, { title: 'Buy a domain', selected: false }] },
  { ...base, type: 'event', title: 'Dentist', time: '15:00' },
  { ...base, type: 'task', title: 'Ignore this' },
], []);
mixed[3].selected = false;
const result = applySuggestions(state, mixed, today);
assert.equal(result.notes.length, 1);
assert.equal(result.goals[0].current, 0);
assert.ok(result.goals[0].detail.includes('Pick projects'));
assert.ok(!result.goals[0].detail.includes('Buy a domain'));
assert.equal(result.events['2026-09-18'][0].time, '15:00');
assert.equal(result.tasks.length, 1);
assert.equal(Object.keys(state.events).length, 0);
assert.ok(draftError({ ...mixed[2], time: '' }));
assert.ok(draftError({ ...mixed[0], question: 'Which date?', dateConfirmed: false }));
assert.equal(draftError({ ...mixed[0], question: 'Which date?', dateConfirmed: true }), '');
const plan = dailyPlan([old, { id: 'later', title: 'Later', due: '2026-10-01' }, { id: 'late', title: 'Late', due: '2026-09-16' }, { id: 'now', title: 'Now', due: today }], today);
assert.deepEqual(plan.map(task => task.id), ['late', 'now', 'later']);
console.log('Mixed saves, duplicate updates, selection, date clarification, optional steps, and daily planning passed.');
