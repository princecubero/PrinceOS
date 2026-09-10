import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';

const modules = [
  ['/', '⌂', 'Dashboard'], ['/calendar', '□', 'Calendar'], ['/finance', '$', 'Finance'],
  ['/fitness', '↗', 'Fitness'], ['/goals', '◎', 'Goals'], ['/habits', '♨', 'Habits'],
  ['/tasks', '✓', 'Tasks'], ['/notes', '✎', 'Notes'], ['/analytics', '▥', 'Analytics']
];
const seedEvents = {
  '2024-09-18': [{ id: 1, time: '09:30', title: 'Product design review', color: '' }, { id: 2, time: '12:30', title: 'Lunch with Claire', color: 'coral' }],
  '2024-09-24': [{ id: 3, time: '16:00', title: 'Send October invoices', color: 'gold' }]
};
const seedTransactions = [
  { id: 1, name: 'Northstar Studio', amount: 2400, type: 'income', category: 'Income' },
  { id: 2, name: 'Apartment rent', amount: 820, type: 'expense', category: 'Home' },
  { id: 3, name: 'Grocery market', amount: 64.3, type: 'expense', category: 'Food' }
];
const seedCollections = {
  tasks: [{ id: 1, title: 'Prepare client presentation', detail: 'Today · High priority', done: false }, { id: 2, title: 'Review monthly budget', detail: 'Sep 20 · Medium priority', done: true }],
  habits: [{ id: 1, title: 'Drink 8 glasses of water', detail: '12 day streak', done: true }, { id: 2, title: 'Read for 30 minutes', detail: '8 day streak', done: false }],
  goals: [{ id: 1, title: 'Build emergency fund', detail: '72% complete', progress: 72 }, { id: 2, title: 'Run a half marathon', detail: '45% complete', progress: 45 }],
  fitness: [{ id: 1, title: 'Upper body workout', detail: '45 min · 8 exercises', done: true }, { id: 2, title: 'Morning run', detail: '5.2 km · 31 min', done: true }],
  notes: [{ id: 1, title: 'Product ideas', detail: 'Explore a weekly review feature' }, { id: 2, title: 'September reflection', detail: 'Consistency improved this month' }]
};
const money = value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };

function Shell({ children }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">P</div><div className="brand-text">PrinceOS<small>Your life. One system.</small></div></div>
      <div><p className="nav-label">Modules</p><nav className="nav" aria-label="Main navigation">
        {modules.map(([path, icon, name]) => <NavLink key={path} to={path} end={path === '/'}><span className="nav-icon">{icon}</span><span>{name}</span></NavLink>)}
      </nav></div>
      <div className="side-note"><strong>Your life, organized</strong>One calm place for what matters today.</div>
    </aside>
    <main>{children}</main>
  </div>;
}
function Header({ eyebrow = 'PrinceOS', title, subtitle, children }) {
  return <header className="topbar"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><div className="date-line">{subtitle}</div></div><div className="top-actions">{children}</div></header>;
}
function Card({ title, subtitle, action, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-header"><div><h2 className="panel-title">{title}</h2>{subtitle && <div className="panel-subtitle">{subtitle}</div>}</div>{action}</div><div className="card-content">{children}</div></section>;
}
function Stat({ label, value, note }) { return <article className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-trend">{note}</div></article>; }
function Progress({ value, color = 'green' }) { return <div className="progress"><span className={color} style={{ width: `${Math.min(value, 100)}%` }} /></div>; }

function Dashboard({ data }) {
  const navigate = useNavigate();
  const income = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spent = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const openTasks = data.tasks.filter(t => !t.done).length;
  const completedHabits = data.habits.filter(h => h.done).length;
  const upcoming = Object.entries(data.events).flatMap(([date, items]) => items.map(item => ({ date, ...item }))).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
  return <><Header eyebrow="Wednesday, September 18" title="Good morning, Prince." subtitle="Here is the shape of your day and your progress." />
    <section className="stats"><Stat label="Available balance" value={money(2809.1 + income - spent)} note={`${money(spent)} spent`} /><Stat label="Today’s tasks" value={openTasks} note={`${data.tasks.length - openTasks} completed`} /><Stat label="Habits today" value={`${completedHabits}/${data.habits.length}`} note="Keep your streak alive" /><Stat label="Active goals" value={data.goals.length} note="Across life and work" /></section>
    <div className="summary-grid">
      <Card title="Today’s agenda" subtitle="Upcoming events" action={<button className="small-link" onClick={() => navigate('/calendar')}>Calendar →</button>}>{upcoming.map(item => <div className="summary-line" key={item.id}><span><strong>{item.title}</strong><small>{item.date}</small></span><b>{item.time}</b></div>)}</Card>
      <Card title="Tasks" subtitle="What needs attention" action={<button className="small-link" onClick={() => navigate('/tasks')}>View all →</button>}>{data.tasks.slice(0, 3).map(item => <div className="summary-line" key={item.id}><span><strong className={item.done ? 'completed' : ''}>{item.title}</strong><small>{item.detail}</small></span><b>{item.done ? 'Done' : 'Open'}</b></div>)}</Card>
      <Card title="Financial snapshot" subtitle="This month"><div className="metric-pair"><span><small>Income</small><strong>{money(income)}</strong></span><span><small>Expenses</small><strong>{money(spent)}</strong></span></div><Progress value={spent / 1680 * 100} /><p className="muted-copy">{money(Math.max(1680 - spent, 0))} left in your monthly budget.</p></Card>
      <Card title="Goals & habits" subtitle="Your momentum">{data.goals.slice(0, 2).map(goal => <div className="goal-row" key={goal.id}><div><strong>{goal.title}</strong><span>{goal.progress}%</span></div><Progress value={goal.progress} /></div>)}</Card>
    </div></>;
}

function CalendarPage({ events, updateEvents }) {
  const [month, setMonth] = useState(new Date(2024, 8, 1)); const [selected, setSelected] = useState(null); const [editing, setEditing] = useState(null);
  const days = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1); const offset = (first.getDay() + 6) % 7; return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1)); }, [month]);
  const save = e => { e.preventDefault(); const form = new FormData(e.currentTarget); const item = { id: editing?.id || Date.now(), title: form.get('title').trim(), time: form.get('time'), color: form.get('color') }; const key = dateKey(selected); updateEvents(all => ({ ...all, [key]: editing ? all[key].map(x => x.id === editing.id ? item : x) : [...(all[key] || []), item] })); setEditing(null); e.currentTarget.reset(); };
  const remove = id => { const key = dateKey(selected); updateEvents(all => ({ ...all, [key]: all[key].filter(x => x.id !== id) })); };
  return <><Header title="Calendar" subtitle="Events, appointments, schedules, and reminders."><button className="primary-button" onClick={() => setSelected(new Date(2024, 8, 18))}>+ New event</button></Header><Card title={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} action={<div className="month-controls"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}>‹</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}>›</button></div>}><div className="weekdays">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar">{days.map(date => <button key={dateKey(date)} className={`day ${date.getMonth() !== month.getMonth() ? 'muted' : ''} ${dateKey(date) === '2024-09-18' ? 'today' : ''}`} onClick={() => { setSelected(date); setEditing(null); }}><div className="day-number">{date.getDate()}</div>{(events[dateKey(date)] || []).map(item => <span key={item.id} className={`event ${item.color}`}>{item.time} · {item.title}</span>)}</button>)}</div></Card>
    {selected && <div className="modal-backdrop open"><div className="modal"><div className="modal-head"><h2>{selected.toLocaleDateString()}</h2><button className="close" onClick={() => setSelected(null)}>×</button></div>{(events[dateKey(selected)] || []).map(item => <div className="event-row" key={item.id}><span className="event-summary">{item.time} · {item.title}</span><button className="small-link" onClick={() => setEditing(item)}>Edit</button><button className="small-link delete-event" onClick={() => remove(item.id)}>Delete</button></div>)}<form onSubmit={save} key={editing?.id || 'new'}><div className="form-grid"><label>Title<input name="title" required defaultValue={editing?.title} /></label><label>Time<input name="time" type="time" required defaultValue={editing?.time || '09:00'} /></label><label>Color<select name="color" defaultValue={editing?.color || ''}><option value="">Green</option><option value="coral">Coral</option><option value="gold">Gold</option></select></label></div><div className="form-actions">{editing && <button type="button" className="cancel" onClick={() => setEditing(null)}>Cancel edit</button>}<button className="primary-button">{editing ? 'Save changes' : 'Add event'}</button></div></form></div></div>}</>;
}

function FinancePage({ transactions, updateTransactions }) {
  const [filter, setFilter] = useState('all'); const [query, setQuery] = useState(''); const [adding, setAdding] = useState(false);
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0); const spent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const filtered = transactions.filter(t => (filter === 'all' || t.type === filter) && `${t.name} ${t.category}`.toLowerCase().includes(query.toLowerCase()));
  const submit = e => { e.preventDefault(); const form = new FormData(e.currentTarget); updateTransactions(all => [{ id: Date.now(), name: form.get('name').trim(), amount: Number(form.get('amount')), type: form.get('type'), category: form.get('category') }, ...all]); setAdding(false); };
  return <><Header title="Finance" subtitle="Income, expenses, budgets, savings, and bills."><button className="primary-button" onClick={() => setAdding(true)}>+ Transaction</button></Header><section className="stats"><Stat label="Balance" value={money(2809.1 + income - spent)} note="Available now" /><Stat label="Income" value={money(income)} note="This month" /><Stat label="Expenses" value={money(spent)} note="This month" /><Stat label="Budget used" value={`${Math.round(spent / 1680 * 100)}%`} note={`${money(Math.max(1680 - spent, 0))} remaining`} /></section><Card title="Transactions" subtitle="Your recent financial activity"><div className="filter-row">{['all','income','expense'].map(value => <button key={value} className={`filter ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{value}</button>)}</div><div className="transaction-tools"><input type="search" placeholder="Search transactions" value={query} onChange={e => setQuery(e.target.value)} /></div>{filtered.map(t => <div className="transaction" key={t.id}><div className="transaction-icon">{t.type === 'income' ? '+' : '↗'}</div><div className="transaction-info"><strong>{t.name}</strong><span>{t.category}</span></div><div className={`amount ${t.type}`}>{t.type === 'income' ? '+' : '−'} {money(t.amount)}</div></div>)}</Card>{adding && <div className="modal-backdrop open"><div className="modal"><div className="modal-head"><h2>Add transaction</h2><button className="close" onClick={() => setAdding(false)}>×</button></div><form onSubmit={submit}><div className="form-grid"><label>Name<input name="name" required /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Category<input name="category" required placeholder="Food, Home, Salary…" /></label></div><div className="form-actions"><button className="primary-button">Save</button></div></form></div></div>}</>;
}

function CollectionPage({ type, title, subtitle, items, updateItems }) {
  const [adding, setAdding] = useState(false);
  const labels = { tasks: 'task', habits: 'habit', goals: 'goal', fitness: 'workout', notes: 'note' };
  const add = e => { e.preventDefault(); const form = new FormData(e.currentTarget); const progress = type === 'goals' ? Number(form.get('progress')) : undefined; updateItems(all => [...all, { id: Date.now(), title: form.get('title').trim(), detail: form.get('detail').trim(), done: false, progress }]); setAdding(false); };
  const toggle = id => updateItems(all => all.map(item => item.id === id ? { ...item, done: !item.done } : item));
  const remove = id => updateItems(all => all.filter(item => item.id !== id));
  return <><Header title={title} subtitle={subtitle}><button className="primary-button" onClick={() => setAdding(true)}>+ Add {labels[type]}</button></Header><div className="module-grid"><Card title={`${title} overview`} subtitle={`${items.length} recorded`}><div className="large-metric">{type === 'goals' ? `${Math.round(items.reduce((s, x) => s + x.progress, 0) / Math.max(items.length, 1))}%` : items.filter(x => x.done).length}</div><p className="muted-copy">{type === 'goals' ? 'Average progress' : 'Completed entries'}</p></Card><Card title={`All ${title.toLowerCase()}`} subtitle="Add, update, and remove entries">{items.map(item => <div className="collection-row" key={item.id}>{type !== 'goals' && type !== 'notes' && <button className={`check-button ${item.done ? 'done' : ''}`} onClick={() => toggle(item.id)} aria-label={`Toggle ${item.title}`}>{item.done ? '✓' : ''}</button>}<div><strong className={item.done ? 'completed' : ''}>{item.title}</strong><span>{item.detail}</span>{type === 'goals' && <Progress value={item.progress} />}</div><button className="small-link delete-event" onClick={() => remove(item.id)}>Delete</button></div>)}</Card></div>{adding && <div className="modal-backdrop open"><div className="modal"><div className="modal-head"><h2>Add {labels[type]}</h2><button className="close" onClick={() => setAdding(false)}>×</button></div><form onSubmit={add}><div className="form-grid"><label>Title<input name="title" required /></label><label>Details<input name="detail" required /></label>{type === 'goals' && <label>Progress %<input name="progress" type="number" min="0" max="100" defaultValue="0" /></label>}</div><div className="form-actions"><button className="primary-button">Save</button></div></form></div></div>}</>;
}

function Analytics({ data }) {
  const cards = [['Financial health', 68, 'Based on monthly budget'], ['Habit consistency', data.habits.filter(x => x.done).length / Math.max(data.habits.length, 1) * 100, 'Daily completion rate'], ['Goal progress', data.goals.reduce((s, x) => s + x.progress, 0) / Math.max(data.goals.length, 1), 'Average across goals'], ['Task completion', data.tasks.filter(x => x.done).length / Math.max(data.tasks.length, 1) * 100, 'All tracked tasks']];
  return <><Header title="Analytics" subtitle="Trends across finance, fitness, productivity, habits, and goals." /><div className="summary-grid">{cards.map(([title, value, note]) => <Card key={title} title={title} subtitle={note}><div className="large-metric">{Math.round(value)}%</div><Progress value={value} /><p className="muted-copy">Updated from your PrinceOS data.</p></Card>)}</div></>;
}

export default function App() {
  const [data, setData] = useState(() => load('princeos.data.v1', { events: seedEvents, transactions: seedTransactions, ...seedCollections }));
  const [databaseStatus, setDatabaseStatus] = useState('connecting');
  useEffect(() => {
    fetch('/api/state').then(response => response.json()).then(result => {
      if (result.data) {
        setData(result.data);
      } else {
        return fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      }
    }).then(() => setDatabaseStatus('connected')).catch(() => setDatabaseStatus('offline'));
  }, []);
  const update = (key, value) => setData(current => {
    const nextValue = typeof value === 'function' ? value(current[key]) : value;
    const next = { ...current, [key]: nextValue };
    localStorage.setItem('princeos.data.v1', JSON.stringify(next));
    fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).then(response => {
      if (!response.ok) throw new Error('Database save failed');
      setDatabaseStatus('connected');
    }).catch(() => setDatabaseStatus('offline'));
    return next;
  });
  const collectionProps = key => ({ items: data[key], updateItems: value => update(key, value) });
  return <Shell><div className={`database-status ${databaseStatus}`}>● {databaseStatus === 'connected' ? 'Database connected' : databaseStatus === 'offline' ? 'Local fallback' : 'Connecting database'}</div><Routes>
    <Route path="/" element={<Dashboard data={data} />} />
    <Route path="/calendar" element={<CalendarPage events={data.events} updateEvents={value => update('events', value)} />} />
    <Route path="/finance" element={<FinancePage transactions={data.transactions} updateTransactions={value => update('transactions', value)} />} />
    <Route path="/fitness" element={<CollectionPage type="fitness" title="Fitness" subtitle="Track workouts, exercises, personal records, and progress." {...collectionProps('fitness')} />} />
    <Route path="/goals" element={<CollectionPage type="goals" title="Goals" subtitle="Turn long-term ambitions into measurable milestones." {...collectionProps('goals')} />} />
    <Route path="/habits" element={<CollectionPage type="habits" title="Habits" subtitle="Build routines, streaks, and a consistent daily rhythm." {...collectionProps('habits')} />} />
    <Route path="/tasks" element={<CollectionPage type="tasks" title="Tasks" subtitle="Organize priorities, deadlines, and recurring work." {...collectionProps('tasks')} />} />
    <Route path="/notes" element={<CollectionPage type="notes" title="Notes" subtitle="Capture ideas, reflections, and useful details." {...collectionProps('notes')} />} />
    <Route path="/analytics" element={<Analytics data={data} />} />
    <Route path="*" element={<Dashboard data={data} />} />
  </Routes></Shell>;
}
