export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const words = title => new Set(title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean));
export function duplicateTasks(title, tasks) {
  const a = words(title);
  return tasks.map(task => {
    const b = words(task.title || '');
    const overlap = [...a].filter(word => b.has(word)).length;
    const score = overlap / Math.max(1, new Set([...a, ...b]).size);
    return { ...task, score };
  }).filter(task => task.score >= 0.6).sort((a, b) => b.score - a.score).slice(0, 3);
}
export function prepareDrafts(drafts, tasks) {
  return drafts.map(item => ({ type: 'task', time: '', question: '', steps: [], ...item,
    id: crypto.randomUUID(), selected: true, action: 'new', updateId: '', dateConfirmed: !item.question,
    // Possible duplicates require a deliberate choice before they are saved.
    ...(item.type === undefined || item.type === 'task' ? (duplicateTasks(item.title, tasks).length ? { action: 'review' } : {}) : {}),
  }));
}
export function draftError(item) {
  if (!item.title.trim()) return 'Enter a title.';
  if (item.due && !validDate(item.due)) return 'Choose a valid date.';
  if (item.question && !item.dateConfirmed) return 'Answer the date question or confirm no date.';
  if (item.type === 'event' && (!validDate(item.due) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) return 'Events need a date and time.';
  if (item.type === 'task' && (item.action === 'review' || (item.action === 'update' && !item.updateId))) return 'Choose whether to add or update this task.';
  return '';
}
export function applySuggestions(state, drafts, today) {
  const next = { ...state, tasks: [...state.tasks], notes: [...state.notes], goals: [...state.goals], events: { ...state.events } };
  const updated = new Set();
  for (const item of drafts.filter(item => item.selected)) {
    const error = draftError(item);
    if (error) throw new Error(error);
    const detail = [item.detail, ...(item.steps || []).filter(step => step.selected).map(step => `☐ ${step.title}`)].filter(Boolean).join('\n');
    const record = { id: item.id, title: item.title.trim(), detail, createdDate: today, updatedAt: new Date().toISOString(), category: '' };
    if (item.type === 'task') {
      if (item.action === 'update') {
        if (updated.has(String(item.updateId))) throw new Error('Choose only one suggestion per existing task.');
        updated.add(String(item.updateId));
        const index = next.tasks.findIndex(task => String(task.id) === String(item.updateId));
        if (index < 0) throw new Error('The existing task is no longer available.');
        const old = next.tasks[index];
        next.tasks[index] = { ...old, title: record.title, due: item.due || old.due || '', priority: item.priority,
          detail: [old.detail, detail && detail !== old.detail ? detail : ''].filter(Boolean).join('\n'), updatedAt: record.updatedAt };
      } else next.tasks.unshift({ ...record, due: item.due, priority: item.priority, status: 'todo', done: false });
    } else if (item.type === 'note') next.notes.unshift({ ...record, tags: '' });
    else if (item.type === 'goal') next.goals.unshift({ ...record, due: item.due, target: 100, current: 0, unit: '%' });
    else if (item.type === 'event') next.events[item.due] = [...(next.events[item.due] || []), { ...record, time: item.time, color: '' }];
    else throw new Error('Unknown suggestion type.');
  }
  return next;
}
export function dailyPlan(tasks, today, limit = 5) {
  const rank = task => (task.due && task.due < today ? 100 : task.due === today ? 80 : 0) + (task.priority === 'High' ? 20 : 0) + (task.status === 'doing' ? 10 : 0);
  return tasks.filter(task => !task.done && task.status !== 'done').sort((a, b) => rank(b) - rank(a) || (a.due || '9999').localeCompare(b.due || '9999')).slice(0, limit).map(task => ({ ...task,
    reason: task.due && task.due < today ? 'Overdue' : task.due === today ? 'Due today' : task.priority === 'High' ? 'High priority' : task.status === 'doing' ? 'Already in progress' : task.due ? `Due ${task.due}` : 'Next available task',
  }));
}
