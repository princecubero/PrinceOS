import React, { useEffect, useRef, useState } from 'react';
import { organizeBrainDump } from './brain-dump.mjs';
import { prepareDrafts, duplicateTasks, draftError, dailyPlan } from './brain-dump-review.mjs';
import { localDate } from './workspace-model';

export default function BrainDump({ save, close, tasks, Dialog }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState('');
  const [showPlan, setShowPlan] = useState(false);
  const pending = useRef(null);
  const submitted = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  const change = (id, values) => setDrafts(all => all.map(item => item.id === id ? { ...item, ...values } : item));
  const receive = items => { setDrafts(prepareDrafts(items, tasks)); setError(''); };
  const organize = event => {
    event.preventDefault();
    if (pending.current) return;
    const items = organizeBrainDump(text);
    if (!items.length || items.length > 50 || items.some(item => item.title.length > 500 || item.detail.length > 10000)) {
      setError('Enter 1–50 thoughts, each with a title no longer than 500 characters.'); return;
    }
    receive(items);
  };
  const organizeAI = async () => {
    if (pending.current) return;
    if (!text.trim() || text.length > 10000) { setError('For AI, enter 1–10,000 characters.'); return; }
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/brain-dump', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: localDate() }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI is unavailable. Organize locally instead.');
      if (!controller.signal.aborted) receive(result.drafts);
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'AI request stopped. Try again or organize locally.' : failure.message);
    } finally { clearTimeout(timeout); pending.current = null; setBusy(false); }
  };
  const selected = (drafts || []).filter(item => item.selected);
  const plan = dailyPlan(tasks, localDate());
  return <Dialog title="Brain dump" close={close}>
    <button type="button" className="small-link" onClick={() => setShowPlan(value => !value)}>{showPlan ? 'Hide daily plan' : 'Suggest my daily plan'}</button>
    {showPlan && <section className="brain-plan" aria-label="Suggested daily plan"><h3>Focus for today</h3><p className="record-copy">Up to five saved tasks, ordered by deadlines, priority, and work in progress. This does not change dates.</p>
      {plan.length ? <ol>{plan.map(item => <li key={item.id}><strong>{item.title}</strong><span>{item.reason}</span></li>)}</ol> : <p>No open tasks yet. Save suggestions to include them in your next plan.</p>}
    </section>}
    {error && <p role="alert" className="login-error">{error}</p>}
    {drafts === null ? <form onSubmit={organize}>
      <p className="record-copy">Write tasks, ideas, goals, or appointments. AI sorts them and suggests optional steps for bigger work.</p>
      <div className="workspace-form"><label className="wide-field">Your thoughts<textarea autoFocus disabled={busy} rows={8} maxLength={25000} required value={text} onChange={event => setText(event.target.value)} placeholder={'Pay internet bill tomorrow\nMeeting Friday at 3 pm\nBuild my portfolio\nNote: the spare keys are in the drawer'} /></label></div>
      <p className="record-copy">AI sends these thoughts and today's date to Groq. Local mode creates one task per line. Review everything before saving.</p>
      <div className="form-actions"><button type="button" className="cancel" onClick={close}>Cancel</button><button disabled={busy} className="cancel">Organize locally</button><button type="button" className="primary-button" disabled={busy || !text.trim()} onClick={organizeAI}>{busy ? 'Organizing…' : 'Organize with AI'}</button></div>
    </form> : <form onSubmit={event => {
      event.preventDefault();
      if (submitted.current || !selected.length) return;
      const issue = selected.map(draftError).find(Boolean);
      if (issue) { setError(issue); return; }
      try { submitted.current = true; save(selected); close(); }
      catch (failure) { submitted.current = false; setError(failure.message); }
    }}>
      <p role="status" className="record-copy">{selected.length} of {drafts.length} suggestions selected. Choose the destination and check dates before saving.</p>
      <div className="brain-selection"><button type="button" className="small-link" onClick={() => setDrafts(all => all.map(item => ({ ...item, selected: true })))}>Select all</button><button type="button" className="small-link" onClick={() => setDrafts(all => all.map(item => ({ ...item, selected: false })))}>Select none</button></div>
      <div className="brain-dump-drafts">{drafts.map((item, index) => {
        const matches = item.type === 'task' ? duplicateTasks(item.title, tasks) : [];
        return <fieldset className={`brain-dump-draft ${!item.selected ? 'brain-excluded' : ''}`} key={item.id}>
          <legend><label><input type="checkbox" checked={item.selected} onChange={event => change(item.id, { selected: event.target.checked })} /> Suggestion {index + 1}</label></legend>
          <div className="workspace-form">
            <label>Save as<select disabled={!item.selected} value={item.type} onChange={event => change(item.id, { type: event.target.value, action: event.target.value === 'task' && duplicateTasks(item.title, tasks).length ? 'review' : 'new', updateId: '' })}>{['task', 'note', 'goal', 'event'].map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="wide-field">Title<input disabled={!item.selected} required maxLength={500} value={item.title} onChange={event => change(item.id, { title: event.target.value, action: item.type === 'task' && duplicateTasks(event.target.value, tasks).length ? 'review' : 'new', updateId: '' })} /></label>
            <label className="wide-field">Description<textarea disabled={!item.selected} maxLength={10000} value={item.detail} onChange={event => change(item.id, { detail: event.target.value })} /></label>
            {item.type !== 'note' && <label>{item.type === 'event' ? 'Event date' : 'Due date'}<input disabled={!item.selected} type="date" required={item.type === 'event'} value={item.due} onChange={event => change(item.id, { due: event.target.value, dateConfirmed: Boolean(event.target.value) && (item.type !== 'event' || Boolean(item.time)) })} /></label>}
            {item.type === 'event' && <label>Time<input disabled={!item.selected} type="time" required value={item.time} onChange={event => change(item.id, { time: event.target.value, dateConfirmed: Boolean(item.due && event.target.value) })} /></label>}
            {item.type === 'task' && <label>Priority<select disabled={!item.selected} value={item.priority} onChange={event => change(item.id, { priority: event.target.value })}>{['Normal', 'High', 'Low'].map(value => <option key={value}>{value}</option>)}</select></label>}
          </div>
          {item.question && !item.dateConfirmed && <div className="brain-question"><strong>{item.question}</strong><p>Choose the date{item.type === 'event' ? ' and time' : ''} above.</p>{item.type !== 'event' && <button type="button" className="small-link" onClick={() => change(item.id, { due: '', dateConfirmed: true })}>Keep without a date</button>}</div>}
          {matches.length > 0 && <div className="brain-question"><strong>Possible existing task</strong><p className="record-copy">An update keeps its progress and appends your description. A blank date keeps the existing date.</p><label>Action<select disabled={!item.selected} value={item.action === 'update' ? `update:${item.updateId}` : item.action} onChange={event => { const value = event.target.value; change(item.id, value.startsWith('update:') ? { action: 'update', updateId: value.slice(7) } : { action: value, updateId: '' }); }}><option value="review">Choose an action</option><option value="new">Add as a separate task</option>{matches.map(match => <option key={match.id} value={`update:${match.id}`}>Update: {match.title}{match.done || match.status === 'done' ? ' (completed)' : ''}</option>)}</select></label></div>}
          {item.steps.length > 0 && <div className="brain-steps"><strong>Optional next steps</strong><p className="record-copy">Selected steps are added as a checklist in the description.</p>{item.steps.map((step, stepIndex) => <label key={stepIndex}><input type="checkbox" disabled={!item.selected} checked={step.selected} onChange={event => change(item.id, { steps: item.steps.map((value, position) => position === stepIndex ? { ...value, selected: event.target.checked } : value) })} />{step.title}</label>)}</div>}
          {item.type === 'goal' && <p className="record-copy">Starts at 0% progress. You can set a measurable target in Goals.</p>}
        </fieldset>;
      })}</div>
      <div className="form-actions"><button type="button" className="cancel" onClick={() => { setDrafts(null); setError(''); }}>Back to thoughts</button><button className="primary-button" disabled={!selected.length}>Save {selected.length} selected</button></div>
    </form>}
  </Dialog>;
}
