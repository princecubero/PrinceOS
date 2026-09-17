const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Only interpret a date at the end of a line. Keep the original in the description.
export function organizeBrainDump(text, now = new Date()) {
  return text.split(/\r?\n/).map(line => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')).filter(Boolean).map(original => {
    let title = original;
    let priority = 'Normal';
    const urgent = /^(?:urgent|high priority)\s*:\s*/i;
    if (urgent.test(title)) {
      priority = 'High';
      title = title.replace(urgent, '');
    }
    let due = '';
    const match = title.match(/\s+(?:(?:by|on)\s+)?(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|\d{4}-\d{2}-\d{2})[.!]?$/i);
    if (match) {
      const word = match[1].toLowerCase();
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
      if (word === 'tomorrow') date.setDate(date.getDate() + 1);
      else if (weekdays.includes(word)) date.setDate(date.getDate() + ((weekdays.indexOf(word) - date.getDay() + 7) % 7 || 7));
      else if (word !== 'today') {
        const parsed = new Date(`${word}T12:00:00`);
        if (!Number.isNaN(parsed.getTime()) && dateKey(parsed) === word) due = word;
      }
      if (!/^\d/.test(word)) due = dateKey(date);
      if (due) title = title.slice(0, match.index).trim();
    }
    return { title: title || original, detail: original, due, priority, status: 'todo', done: false, category: '' };
  });
}
