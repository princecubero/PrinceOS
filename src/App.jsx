import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';

import { TasksPage, GoalsPage, HabitsPage, FitnessPage, NotesPage, AnalyticsPage } from './WorkspacePages';
import { goalProgress, habitDates, localDate } from './workspace-model';

const modules = [
  ['/', '⌂', 'Dashboard'], ['/calendar', '□', 'Calendar'], ['/finance', '$', 'Finance'],
  ['/fitness', '↗', 'Fitness'], ['/goals', '◎', 'Goals'], ['/habits', '♨', 'Habits'],
  ['/tasks', '✓', 'Tasks'], ['/notes', '✎', 'Notes'], ['/analytics', '▥', 'Analytics']
];
const emptyData = () => ({ events: {}, transactions: [], tasks: [], habits: [], goals: [], fitness: [], notes: [] });
const money = value => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function LoginPage({ onLogin }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      onLogin(result.user);
    } catch (loginError) { setError(loginError.message); }
    finally { setSubmitting(false); }
  };
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <div className="login-brand"><div className="brand-mark">P</div><div><strong>PrinceOS</strong><small>Your life. One system.</small></div></div>
    <div><div className="eyebrow">Private workspace</div><h1 id="login-title">Welcome back</h1><p className="login-copy">Sign in to open your dashboard.</p></div>
    <form onSubmit={submit}><label>Username<input name="username" autoComplete="username" autoCapitalize="none" required autoFocus /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form>
  </section></main>;
}

function Shell({ children }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">P</div><div className="brand-text">PrinceOS<small>Your life. One system.</small></div></div>
      <div><p className="nav-label">Modules</p><nav className="nav" aria-label="Main navigation">
        {modules.map(([path, icon, name]) => <NavLink key={path} to={path} aria-label={name} title={name} end={path === '/'}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{name}</span></NavLink>)}
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
  const savings = data.transactions.filter(t => t.type === 'savings').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const spendingFunds = data.transactions.filter(t => t.type === 'spending').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expenses = data.transactions.filter(t => t.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const spendingBalance = spendingFunds - expenses;
  const openTasks = data.tasks.filter(t => !t.done).length;
  const completedHabits = data.habits.filter(h => habitDates(h).includes(localDate())).length;
  const upcoming = Object.entries(data.events).flatMap(([date, items]) => items.map(item => ({ date, ...item }))).filter(item => `${item.date}T${item.time}` >= `${dateKey(new Date())}T${new Date().toTimeString().slice(0, 5)}`).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
  return <><Header eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} title="Your dashboard" subtitle="Here is the shape of your day and your progress." />
    <section className="stats"><Stat label="Spending money" value={money(spendingBalance)} note={`${money(expenses)} spent`} /><Stat label="Open tasks" value={openTasks} note={`${data.tasks.length - openTasks} completed`} /><Stat label="Habit completion" value={`${completedHabits}/${data.habits.length}`} note="Checked in today" /><Stat label="Active goals" value={data.goals.filter(goal => goalProgress(goal) < 100).length} note="Across life and work" /></section>
    <div className="summary-grid">
      <Card title="Upcoming agenda" subtitle="Upcoming events" action={<button className="small-link" onClick={() => navigate('/calendar')}>Calendar →</button>}>{!upcoming.length && <p className="muted-copy">No upcoming events. Add an event in Calendar.</p>}{upcoming.map(item => <div className="summary-line" key={item.id}><span><strong>{item.title}</strong><small>{item.date}</small></span><b>{item.time}</b></div>)}</Card>
      <Card title="Tasks" subtitle="What needs attention" action={<button className="small-link" onClick={() => navigate('/tasks')}>View all →</button>}>{!data.tasks.length && <p className="muted-copy">No tasks yet. Add your first task.</p>}{data.tasks.slice(0, 3).map(item => <div className="summary-line" key={item.id}><span><strong className={item.done ? 'completed' : ''}>{item.title}</strong><small>{item.detail}</small></span><b>{item.done ? 'Done' : 'Open'}</b></div>)}</Card>
      <Card title="Financial snapshot" subtitle="Separate money buckets"><div className="metric-pair"><span><small>Spending money</small><strong>{money(spendingBalance)}</strong></span><span><small>Savings</small><strong>{money(savings)}</strong></span></div><p className="muted-copy">Total money: {money(spendingBalance + savings)}. Expenses only reduce spending money.</p></Card>
      <Card title="Goals & habits" subtitle="Your momentum">{!data.goals.length && <p className="muted-copy">No goals yet. Add your first goal.</p>}{data.goals.slice(0, 2).map(goal => <div className="goal-row" key={goal.id}><div><strong>{goal.title}</strong><span>{Math.round(goalProgress(goal))}%</span></div><Progress value={goalProgress(goal)} /></div>)}</Card>
    </div></>;
}

function CalendarPage({ events, updateEvents }) {
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); const [selected, setSelected] = useState(null); const [editing, setEditing] = useState(null);
  const days = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1); const offset = (first.getDay() + 6) % 7; return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1)); }, [month]);
  const save = e => { e.preventDefault(); const form = new FormData(e.currentTarget); const item = { id: editing?.id || Date.now(), title: form.get('title').trim(), time: form.get('time'), color: form.get('color') }; const key = dateKey(selected); updateEvents(all => ({ ...all, [key]: editing ? all[key].map(x => x.id === editing.id ? item : x) : [...(all[key] || []), item] })); setEditing(null); e.currentTarget.reset(); };
  const remove = id => { const key = dateKey(selected); updateEvents(all => ({ ...all, [key]: all[key].filter(x => x.id !== id) })); };
  return <><Header title="Calendar" subtitle="Events, appointments, schedules, and reminders."><button className="primary-button" onClick={() => setSelected(new Date())}>+ New event</button></Header><Card title={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} action={<div className="month-controls"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}>‹</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}>›</button></div>}><div className="weekdays">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar">{days.map(date => <button key={dateKey(date)} className={`day ${date.getMonth() !== month.getMonth() ? 'muted' : ''} ${dateKey(date) === dateKey(new Date()) ? 'today' : ''}`} onClick={() => { setSelected(date); setEditing(null); }}><div className="day-number">{date.getDate()}</div>{(events[dateKey(date)] || []).map(item => <span key={item.id} className={`event ${item.color}`}>{item.time} · {item.title}</span>)}</button>)}</div></Card>
    {selected && <div className="modal-backdrop open"><div className="modal"><div className="modal-head"><h2>{selected.toLocaleDateString()}</h2><button className="close" onClick={() => setSelected(null)}>×</button></div>{(events[dateKey(selected)] || []).map(item => <div className="event-row" key={item.id}><span className="event-summary">{item.time} · {item.title}</span><button className="small-link" onClick={() => setEditing(item)}>Edit</button><button className="small-link delete-event" onClick={() => remove(item.id)}>Delete</button></div>)}<form onSubmit={save} key={editing?.id || 'new'}><div className="form-grid"><label>Title<input name="title" required defaultValue={editing?.title} /></label><label>Time<input name="time" type="time" required defaultValue={editing?.time || '09:00'} /></label><label>Color<select name="color" defaultValue={editing?.color || ''}><option value="">Green</option><option value="coral">Coral</option><option value="gold">Gold</option></select></label></div><div className="form-actions">{editing && <button type="button" className="cancel" onClick={() => setEditing(null)}>Cancel edit</button>}<button className="primary-button">{editing ? 'Save changes' : 'Add event'}</button></div></form></div></div>}</>;
}

function FinancePage({ transactions, updateTransactions }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const savings = transactions.filter(transaction => transaction.type === 'savings').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const spendingFunds = transactions.filter(transaction => transaction.type === 'spending').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expenses = transactions.filter(transaction => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const spendingBalance = spendingFunds - expenses;
  const filtered = transactions.filter(transaction => (filter === 'all' || transaction.type === filter)
    && `${transaction.name} ${transaction.notes || transaction.category || ''}`.toLowerCase().includes(query.toLowerCase()));
  const closeEditor = () => setEditing(null);
  const submit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const transaction = {
      id: editing?.id || Date.now(),
      name: form.get('name').trim(),
      amount: Number(form.get('amount')),
      type: form.get('type'),
      notes: form.get('notes').trim(),
    };
    updateTransactions(all => editing?.id
      ? all.map(item => item.id === editing.id ? transaction : item)
      : [transaction, ...all]);
    closeEditor();
  };
  return <>
    <Header title="Finance" subtitle="Track spending money, expenses, and savings separately."><button className="primary-button" onClick={() => setEditing({})}>+ Transaction</button></Header>
    <section className="stats"><Stat label="Spending money" value={money(spendingBalance)} note={`${money(spendingFunds)} added before expenses`} /><Stat label="Savings" value={money(savings)} note="Not reduced by expenses" /><Stat label="Expenses" value={money(expenses)} note="Deducted from spending money" /><Stat label="Total money" value={money(spendingBalance + savings)} note="Spending money plus savings" /></section>
    <Card title="Transactions" subtitle="Hover over a transaction to edit it">
      <div className="filter-row">{[['all', 'All'], ['spending', 'Spending money'], ['expense', 'Expenses'], ['savings', 'Savings']].map(([value, label]) => <button key={value} className={`filter ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <div className="transaction-tools"><input type="search" aria-label="Search transactions" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {!filtered.length && <p className="muted-copy">{transactions.length ? 'No matching transactions.' : 'No transactions yet. Add your first transaction.'}</p>}
      {filtered.map(transaction => <div className="transaction" key={transaction.id}>
        <div className={`transaction-icon ${transaction.type}`}>{transaction.type === 'expense' ? '−' : '+'}</div>
        <div className="transaction-info"><strong>{transaction.name}</strong>{(transaction.notes || transaction.category) && <span>{transaction.notes || transaction.category}</span>}</div>
        <div className={`amount ${transaction.type}`}>{transaction.type === 'expense' ? '−' : '+'} {money(transaction.amount)}</div>
        <button className="transaction-edit" onClick={() => setEditing(transaction)} aria-label={`Edit ${transaction.name}`}>Edit</button>
      </div>)}
    </Card>
    {editing && <div className="modal-backdrop open"><div className="modal"><div className="modal-head"><h2>{editing.id ? 'Edit transaction' : 'Add transaction'}</h2><button className="close" onClick={closeEditor} aria-label="Close">×</button></div><form onSubmit={submit} key={editing.id || 'new'}><div className="form-grid"><label>Name<input name="name" required defaultValue={editing.name || ''} /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing.amount || ''} /></label><label>Type<select name="type" defaultValue={['spending', 'expense', 'savings'].includes(editing.type) ? editing.type : 'spending'}><option value="spending">Spending money</option><option value="expense">Expense</option><option value="savings">Savings</option></select></label><label>Notes <span className="optional-label">Optional</span><textarea name="notes" rows="3" defaultValue={editing.notes || editing.category || ''} /></label></div><div className="form-actions"><button type="button" className="cancel" onClick={closeEditor}>Cancel</button><button className="primary-button">{editing.id ? 'Save changes' : 'Add transaction'}</button></div></form></div></div>}
  </>;
}

export default function App() {
  const [auth, setAuth] = useState({ status: 'checking', user: null });
  const [data, setData] = useState(emptyData);
  const [databaseStatus, setDatabaseStatus] = useState('connecting');
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me').then(response => {
      if (!response.ok) throw new Error('Not signed in');
      return response.json();
    }).then(result => { if (active) setAuth({ status: 'signed-in', user: result.user }); })
      .catch(() => { if (active) setAuth({ status: 'signed-out', user: null }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (auth.status !== 'signed-in') return undefined;
    let active = true;
    fetch('/api/state').then(response => {
      if (response.status === 401) {
        setAuth({ status: 'signed-out', user: null });
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Database load failed');
      return response.json();
    }).then(result => {
      if (!active) return;
      const next = result.data || emptyData();
      dataRef.current = next;
      setData(next);
      setLoaded(true);
      setDatabaseStatus('connected');
    }).catch(() => { if (active) setDatabaseStatus('offline'); });
    return () => { active = false; };
  }, [auth.status]);
  const update = (key, value) => {
    if (!loaded) return;
    const current = dataRef.current;
    const next = { ...current, [key]: typeof value === 'function' ? value(current[key]) : value };
    dataRef.current = next;
    setData(next);
    setDatabaseStatus('saving');
    const version = ++revision.current;
    // Serialize full-state saves so a slower request cannot overwrite a newer edit.
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (response.status === 401) { setAuth({ status: 'signed-out', user: null }); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Database save failed');
      if (version === revision.current) setDatabaseStatus('connected');
    }).catch(() => { if (version === revision.current) setDatabaseStatus('offline'); });
  };
  if (auth.status === 'checking') return <main className="login-page"><p className="login-copy">Checking your session…</p></main>;
  if (auth.status === 'signed-out') return <LoginPage onLogin={user => { setLoaded(false); setDatabaseStatus('connecting'); setAuth({ status: 'signed-in', user }); }} />;
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); dataRef.current = emptyData(); setData(emptyData()); setLoaded(false); setAuth({ status: 'signed-out', user: null }); };
  if (!loaded) return <Shell><Header title="Your dashboard" subtitle={databaseStatus === 'offline' ? 'Unable to load your data. Check the API and PostgreSQL, then retry.' : 'Loading your data…'} />{databaseStatus === 'offline' && <button className="primary-button" onClick={() => window.location.reload()}>Retry</button>}</Shell>;
  const collectionProps = key => ({ items: data[key], updateItems: value => update(key, value) });
  return <Shell><div className="session-bar"><span>Signed in as {auth.user?.username}</span><button className="small-link" onClick={logout}>Sign out</button></div><div className={`database-status ${databaseStatus}`}>● {databaseStatus === 'connected' ? 'Database connected' : databaseStatus === 'offline' ? 'Save failed — changes are not saved. Keep this page open and retry.' : 'Saving changes…'}</div>{databaseStatus === 'offline' && <button className="primary-button" onClick={() => update('events', dataRef.current.events)}>Retry save</button>}<Routes>
    <Route path="/" element={<Dashboard data={data} />} />
    <Route path="/calendar" element={<CalendarPage events={data.events} updateEvents={value => update('events', value)} />} />
    <Route path="/finance" element={<FinancePage transactions={data.transactions} updateTransactions={value => update('transactions', value)} />} />
    <Route path="/fitness" element={<FitnessPage {...collectionProps('fitness')} />} />
    <Route path="/goals" element={<GoalsPage {...collectionProps('goals')} />} />
    <Route path="/habits" element={<HabitsPage {...collectionProps('habits')} />} />
    <Route path="/tasks" element={<TasksPage {...collectionProps('tasks')} />} />
    <Route path="/notes" element={<NotesPage {...collectionProps('notes')} />} />
    <Route path="/analytics" element={<AnalyticsPage data={data} />} />
    <Route path="*" element={<Dashboard data={data} />} />
  </Routes></Shell>;
}
