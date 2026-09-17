import "./workspace.css";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { organizeBrainDump } from './brain-dump.mjs';
import {
  daysBefore,
  goalProgress,
  habitDates,
  habitStreak,
  localDate,
  taskStatus,
  toggleCheckin,
  total,
  workoutDone,
} from "./workspace-model";

// Field definitions are the single place to customize each editor.
const fields = {
  tasks: [
    ["title", "Task", "text", true],
    ["detail", "Description", "textarea"],
    ["due", "Due date", "date"],
    ["priority", "Priority", ["Normal", "High", "Low"]],
    [
      "status",
      "Status",
      [
        ["todo", "To do"],
        ["doing", "In progress"],
        ["done", "Done"],
      ],
    ],
    ["category", "Project / area", "text"],
  ],
  habits: [
    ["title", "Habit", "text", true],
    ["detail", "Your cue or reason", "textarea"],
    ["category", "Area", "text"],
  ],
  goals: [
    ["title", "Goal", "text", true],
    ["detail", "Why it matters / next steps", "textarea"],
    ["target", "Target", "number", true, 1],
    ["current", "Current amount", "number", true, 0],
    ["unit", "Unit (books, pesos, sessions…)", "text"],
    ["due", "Target date", "date"],
    ["category", "Area", "text"],
  ],
  fitness: [
    ["title", "Workout", "text", true],
    ["date", "Workout date", "date", true],
    [
      "activity",
      "Activity",
      [
        "Strength",
        "Walking",
        "Running",
        "Cycling",
        "Mobility",
        "Sport",
        "Other",
      ],
    ],
    ["duration", "Minutes", "number", true, 1],
    ["distance", "Distance (km, optional)", "number", false, 0],
    [
      "status",
      "Status",
      [
        ["planned", "Planned"],
        ["completed", "Completed"],
      ],
    ],
    ["detail", "Exercises, sets, reps, or reflections", "textarea"],
  ],
  notes: [
    ["title", "Title", "text", true],
    ["category", "Notebook", "text"],
    ["tags", "Tags (comma separated)", "text"],
    ["detail", "Note", "textarea", true],
  ],
};
const names = {
  tasks: "task",
  habits: "habit",
  goals: "goal",
  fitness: "workout",
  notes: "note",
};
const defaults = (type) => ({
  title: "",
  detail: "",
  category: "",
  ...(type === "tasks" ? { priority: "Normal", status: "todo" } : {}),
  ...(type === "goals" ? { target: 100, current: 0, unit: "%" } : {}),
  ...(type === "fitness"
    ? {
        date: localDate(),
        activity: "Strength",
        duration: 30,
        status: "completed",
      }
    : {}),
});

function Dialog({ title, children, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      aria-labelledby="editor-title"
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="workspace-dialog-body">
        <div className="modal-head">
          <h2 id="editor-title">{title}</h2>
          <button
            type="button"
            className="close"
            aria-label="Close dialog"
            onClick={close}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function Editor({ type, item, save, close }) {
  const initial = { ...defaults(type), ...item };
  if (type === "tasks") initial.status = taskStatus(item);
  if (type === "fitness" && item.id)
    initial.status = workoutDone(item) ? "completed" : "planned";
  if (type === "goals" && !item.target) {
    initial.current = goalProgress(item);
    initial.target = 100;
    initial.unit = "%";
  }
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      ...item,
      id: item.id || crypto.randomUUID(),
      createdDate: item.createdDate || localDate(),
      updatedAt: new Date().toISOString(),
    };
    for (const [key, label, kind, required] of fields[type]) {
      const value = String(form.get(key) || "").trim();
      if (required && !value) {
        setError(`${label} is required.`);
        return;
      }
      next[key] =
        kind === "number" ? (value === "" ? null : Number(value)) : value;
    }
    if (type === "tasks") next.done = next.status === "done";
    if (type === "fitness") next.done = next.status === "completed";
    if (type === "goals") next.progress = goalProgress(next);
    save(next);
    close();
  };
  return (
    <Dialog title={`${item.id ? "Edit" : "New"} ${names[type]}`} close={close}>
      <form onSubmit={submit}>
        <div className="workspace-form">
          {fields[type].map(([key, label, kind, required, min]) => (
            <label
              key={key}
              className={kind === "textarea" ? "wide-field" : ""}
            >
              {label}
              {required && <span aria-hidden="true"> *</span>}
              {Array.isArray(kind) ? (
                <select name={key} defaultValue={initial[key]}>
                  {kind.map((option) => (
                    <option
                      key={Array.isArray(option) ? option[0] : option}
                      value={Array.isArray(option) ? option[0] : option}
                    >
                      {Array.isArray(option) ? option[1] : option}
                    </option>
                  ))}
                </select>
              ) : kind === "textarea" ? (
                <textarea
                  name={key}
                  rows={type === "notes" ? 12 : 4}
                  required={required}
                  maxLength={50000}
                  defaultValue={initial[key] || ""}
                />
              ) : (
                <input
                  name={key}
                  type={kind}
                  autoFocus={key === "title"}
                  required={required}
                  min={min}
                  max={kind === "number" ? 1000000000 : undefined}
                  step={kind === "number" ? "any" : undefined}
                  maxLength={500}
                  defaultValue={initial[key] ?? ""}
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="cancel" onClick={close}>
            Cancel
          </button>
          <button className="primary-button">Save {names[type]}</button>
        </div>
      </form>
    </Dialog>
  );
}
function useRecords(type, updateItems) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const save = (next) =>
    updateItems((all) =>
      all.some((item) => item.id === next.id)
        ? all.map((item) => (item.id === next.id ? next : item))
        : [next, ...all]
    );
  return {
    add: () => setEditing({}),
    edit: setEditing,
    remove: setDeleting,
    save,
    dialogs: (
      <>
        {editing && (
          <Editor
            type={type}
            item={editing}
            save={save}
            close={() => setEditing(null)}
          />
        )}
        {deleting && (
          <Dialog
            title={`Delete ${names[type]}?`}
            close={() => setDeleting(null)}
          >
            <p>
              Delete “{deleting.title}”? This also removes its recorded history.
            </p>
            <div className="form-actions">
              <button className="cancel" onClick={() => setDeleting(null)}>
                Keep it
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  updateItems((all) =>
                    all.filter((item) => item.id !== deleting.id)
                  );
                  setDeleting(null);
                }}
              >
                Delete {names[type]}
              </button>
            </div>
          </Dialog>
        )}
      </>
    ),
  };
}
function PageHeader({ title, subtitle, add, label }) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">Your personal workspace</div>
        <h1>{title}</h1>
        <div className="date-line">{subtitle}</div>
      </div>
      {add && (
        <button className="primary-button" onClick={add}>
          + {label}
        </button>
      )}
    </header>
  );
}
function Metrics({ items }) {
  return (
    <section className="stats">
      {items.map(([label, value, note]) => (
        <article className="stat" key={label}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          <div className="stat-trend">{note}</div>
        </article>
      ))}
    </section>
  );
}
function Empty({ children, add, label = "Add your first entry" }) {
  return (
    <div className="workspace-empty">
      <span aria-hidden="true">＋</span>
      <p>{children}</p>
      {add && (
        <button className="small-link" onClick={add}>
          {label}
        </button>
      )}
    </div>
  );
}
function Actions({ item, records }) {
  return (
    <div className="record-actions">
      <button
        className="small-link"
        onClick={() => records.edit(item)}
        aria-label={`Edit ${item.title}`}
      >
        Edit
      </button>
      <button
        className="small-link delete-event"
        onClick={() => records.remove(item)}
        aria-label={`Delete ${item.title}`}
      >
        Delete
      </button>
    </div>
  );
}
function Search({ query, setQuery, children, label }) {
  return (
    <div className="workspace-tools">
      <input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label}…`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {children}
    </div>
  );
}
const matches = (item, query) =>
  `${item.title} ${item.detail || ""} ${item.category || ""} ${item.tags || ""}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
const percentage = (value, max) => (max ? Math.round((value / max) * 100) : 0);
function Meter({ value, label }) {
  return (
    <div
      className="workspace-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function BrainDump({ save, close }) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState('');
  const submitted = useRef(false);
  const change = (id, key, value) => setDrafts(all => all.map(item => item.id === id ? { ...item, [key]: value } : item));
  const organize = event => {
    event.preventDefault();
    const next = organizeBrainDump(text);
    if (!next.length || next.length > 50 || next.some(item => item.title.length > 500 || item.detail.length > 10000)) {
      setError('Enter 1–50 thoughts, with each task title no longer than 500 characters.');
      return;
    }
    setError('');
    setDrafts(next.map(item => ({ ...item, id: crypto.randomUUID() })));
  };
  return <Dialog title="Brain dump" close={close}>
    {drafts === null ? <form onSubmit={organize}>
      <p className="record-copy">One thought per line. End a line with today, tomorrow, a weekday, or YYYY-MM-DD to suggest a due date. Start with “Urgent:” or “High priority:” for high priority. Weekdays mean the next occurrence, starting tomorrow.</p>
      <div className="workspace-form"><label className="wide-field">Your thoughts<textarea autoFocus rows={8} maxLength={25000} required value={text} onChange={event => setText(event.target.value)} placeholder={'Buy groceries tomorrow\nFinish portfolio by Friday\nUrgent: pay internet bill today\nClean my room'} /></label></div>
      <p className="record-copy">Review and edit suggestions before adding them. Nothing is saved yet.</p>
      {error && <p role="alert" className="login-error">{error}</p>}
      <div className="form-actions"><button type="button" className="cancel" onClick={close}>Cancel</button><button className="primary-button">Organize thoughts</button></div>
    </form> : <form onSubmit={event => {
      event.preventDefault();
      if (submitted.current || !drafts.length || drafts.some(item => !item.title.trim())) return;
      submitted.current = true;
      save(drafts.map(item => ({ ...item, title: item.title.trim(), createdDate: localDate(), updatedAt: new Date().toISOString() })));
      close();
    }}>
      <p className="record-copy" role="status">{drafts.length} suggested {drafts.length === 1 ? 'task' : 'tasks'}. Check dates and priorities. Your original lines are kept in task descriptions.</p>
      <div className="brain-dump-drafts">{drafts.map((item, index) => <fieldset className="brain-dump-draft" key={item.id}>
        <legend>Task {index + 1}</legend>
        <div className="workspace-form">
          <label className="wide-field">Task title<input required maxLength={500} value={item.title} onChange={event => change(item.id, 'title', event.target.value)} /></label>
          <label>Due date<input type="date" value={item.due} onChange={event => change(item.id, 'due', event.target.value)} /></label>
          <label>Priority<select value={item.priority} onChange={event => change(item.id, 'priority', event.target.value)}>{['Normal', 'High', 'Low'].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <p className="record-copy">Original: {item.detail}</p>
        <button type="button" className="small-link delete-event" aria-label={`Remove task ${index + 1}`} onClick={() => setDrafts(all => all.filter(draft => draft.id !== item.id))}>Remove</button>
      </fieldset>)}</div>
      <div className="form-actions"><button type="button" className="cancel" onClick={() => setDrafts(null)}>Back to thoughts</button><button className="primary-button" disabled={!drafts.length || drafts.some(item => !item.title.trim())}>Add {drafts.length} {drafts.length === 1 ? 'task' : 'tasks'}</button></div>
    </form>}
  </Dialog>;
}

export function TasksPage({ items, updateItems }) {
  const records = useRecords("tasks", updateItems);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const today = localDate();
  const overdue = (item) =>
    item.due && item.due < today && taskStatus(item) !== "done";
  const filtered = items
    .filter(
      (item) =>
        matches(item, query) &&
        (priority === "All priorities" ||
          (item.priority || "Normal") === priority)
    )
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="A clear place for the next thing, the work in motion, and the wins."
        add={records.add}
        label="New task"
      />
      <Metrics
        items={[
          [
            "To do",
            items.filter((i) => taskStatus(i) === "todo").length,
            "Ready when you are",
          ],
          [
            "In progress",
            items.filter((i) => taskStatus(i) === "doing").length,
            "Keep your focus here",
          ],
          [
            "Overdue",
            items.filter(overdue).length,
            "Review dates or priorities",
          ],
          [
            "Completed",
            items.filter((i) => taskStatus(i) === "done").length,
            "Work you have finished",
          ],
        ]}
      />
      <Search query={query} setQuery={setQuery} label="tasks">
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {["All priorities", "High", "Normal", "Low"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Search>
      <div className="task-board">
        {[
          ["todo", "To do"],
          ["doing", "In progress"],
          ["done", "Done"],
        ].map(([status, label]) => (
          <section className={`task-lane lane-${status}`} key={status}>
            <h2>
              {label}
              <span>
                {filtered.filter((i) => taskStatus(i) === status).length}
              </span>
            </h2>
            {filtered
              .filter((i) => taskStatus(i) === status)
              .map((item) => (
                <article className="task-card" key={item.id}>
                  <div className="record-meta">
                    <span
                      className={`tag priority-${item.priority || "Normal"}`}
                    >
                      {item.priority || "Normal"}
                    </span>
                    {item.category && <span>{item.category}</span>}
                  </div>
                  <h3>{item.title}</h3>
                  {item.detail && <p className="record-copy">{item.detail}</p>}
                  {item.due && (
                    <p className={overdue(item) ? "overdue" : "record-date"}>
                      {overdue(item) ? "Overdue · " : "Due · "}
                      {item.due}
                    </p>
                  )}
                  <select
                    aria-label={`Status of ${item.title}`}
                    value={taskStatus(item)}
                    onChange={(e) =>
                      records.save({
                        ...item,
                        status: e.target.value,
                        done: e.target.value === "done",
                      })
                    }
                  >
                    <option value="todo">To do</option>
                    <option value="doing">In progress</option>
                    <option value="done">Done</option>
                  </select>
                  <Actions item={item} records={records} />
                </article>
              ))}
            {!filtered.some((i) => taskStatus(i) === status) && (
              <p className="lane-empty">
                {items.length
                  ? "No matching tasks here."
                  : "Your tasks will appear here."}
              </p>
            )}
          </section>
        ))}
      </div>
      {records.dialogs}
    </>
  );
}

export function GoalsPage({ items, updateItems }) {
  const records = useRecords("goals", updateItems);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const completed = items.filter((item) => goalProgress(item) >= 100).length;
  const filtered = items.filter(
    (item) =>
      matches(item, query) &&
      (filter === "all" ||
        goalProgress(item) >= 100 === (filter === "completed"))
  );
  return (
    <>
      <PageHeader
        title="Goals"
        subtitle="Give your ambitions a number, a date, and a next step."
        add={records.add}
        label="New goal"
      />
      <Metrics
        items={[
          ["Active goals", items.length - completed, "One step at a time"],
          ["Achieved", completed, "Targets reached"],
          [
            "Average progress",
            `${Math.round(
              items.reduce((s, i) => s + goalProgress(i), 0) /
                Math.max(items.length, 1)
            )}%`,
            "Across all goals",
          ],
          [
            "Past target date",
            items.filter(
              (i) => i.due && i.due < localDate() && goalProgress(i) < 100
            ).length,
            "A chance to revise your plan",
          ],
        ]}
      />
      <Search query={query} setQuery={setQuery} label="goals">
        <select
          aria-label="Filter goals"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="completed">Achieved</option>
          <option value="all">All goals</option>
        </select>
      </Search>
      <div className="goal-grid">
        {filtered.map((item) => (
          <article className="goal-card" key={item.id}>
            <div className="record-meta">
              <span className="tag">{item.category || "Personal"}</span>
              <span>
                {goalProgress(item) >= 100
                  ? "Achieved"
                  : item.due
                  ? `Target · ${item.due}`
                  : "At your own pace"}
              </span>
            </div>
            <h2>{item.title}</h2>
            <div className="goal-number">
              {Math.round(goalProgress(item))}
              <small>%</small>
            </div>
            <Meter value={goalProgress(item)} label={item.title} />
            <p className="record-date">
              {item.target
                ? `${item.current || 0} / ${item.target} ${item.unit || ""}`
                : `${goalProgress(item)} / 100 %`}
            </p>
            {item.detail && <p className="record-copy">{item.detail}</p>}
            <button
              className="outline-button"
              onClick={() => records.edit(item)}
            >
              Update progress
            </button>
            <Actions item={item} records={records} />
          </article>
        ))}
      </div>
      {!filtered.length && (
        <Empty add={records.add} label="Create a goal">
          {items.length
            ? "No goals match this view."
            : "What would you like to work toward? Start with one measurable goal."}
        </Empty>
      )}
      {records.dialogs}
    </>
  );
}

export function HabitsPage({ items, updateItems }) {
  const records = useRecords("habits", updateItems);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const today = localDate();
  const days = Array.from({ length: 7 }, (_, i) =>
    daysBefore(offset + 6 - i, today)
  );
  const completed = items.filter((item) =>
    habitDates(item).includes(today)
  ).length;
  const filtered = items.filter((item) => matches(item, query));
  return (
    <>
      <PageHeader
        title="Habits"
        subtitle="Small actions, repeated. Check in each day and build a history."
        add={records.add}
        label="New habit"
      />
      <Metrics
        items={[
          [
            "Today",
            `${completed} / ${items.length}`,
            "Daily habits checked in",
          ],
          [
            "Last 7 days",
            items.reduce(
              (s, i) =>
                s +
                habitDates(i).filter((d) => d >= daysBefore(6) && d <= today)
                  .length,
              0
            ),
            "Total check-ins",
          ],
          [
            "Best current streak",
            `${Math.max(0, ...items.map((i) => habitStreak(i)))} days`,
            "Consecutive days, through today or yesterday",
          ],
          ["Daily routines", items.length, "All habits repeat daily"],
        ]}
      />
      <Search query={query} setQuery={setQuery} label="habits" />
      <section className="panel habit-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Your daily rhythm</h2>
            <p className="panel-subtitle">
              {days[0]} – {days[6]} · Select a day to add or undo a check-in.
            </p>
          </div>
          <div className="history-controls">
            <button
              className="outline-button"
              onClick={() => setOffset(offset + 7)}
              aria-label="Previous seven days"
            >
              ←
            </button>
            <button
              className="outline-button"
              disabled={offset === 0}
              onClick={() => setOffset(0)}
            >
              Today
            </button>
            <button
              className="outline-button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 7))}
              aria-label="Next seven days"
            >
              →
            </button>
          </div>
        </div>
        <div className="habit-scroll">
          <table className="habit-table">
            <thead>
              <tr>
                <th scope="col">Habit</th>
                {days.map((day) => (
                  <th scope="col" key={day}>
                    <span>
                      {new Date(`${day}T12:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "short" }
                      )}
                    </span>
                    <small>{day.slice(5)}</small>
                  </th>
                ))}
                <th scope="col">Streak</th>
                <th scope="col">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <strong>{item.title}</strong>
                    <small>
                      {item.detail || item.category || "A little every day"}
                    </small>
                    {item.done && !item.checkins && (
                      <small>
                        Previously marked done; start your dated history below.
                      </small>
                    )}
                  </th>
                  {days.map((day) => (
                    <td key={day}>
                      <button
                        className={`habit-check ${
                          habitDates(item).includes(day) ? "checked" : ""
                        }`}
                        aria-label={`${item.title} on ${day}`}
                        aria-pressed={habitDates(item).includes(day)}
                        onClick={() => records.save(toggleCheckin(item, day))}
                      >
                        {habitDates(item).includes(day) ? "✓" : "·"}
                      </button>
                    </td>
                  ))}
                  <td>
                    <b>{habitStreak(item)}</b>
                    <small>days</small>
                  </td>
                  <td>
                    <Actions item={item} records={records} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty add={records.add} label="Create a habit">
            {items.length
              ? "No matching habits."
              : "Choose a small daily action you want to repeat."}
          </Empty>
        )}
      </section>
      {records.dialogs}
    </>
  );
}

export function FitnessPage({ items, updateItems }) {
  const records = useRecords("fitness", updateItems);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const recent = items.filter(
    (i) => workoutDone(i) && i.date >= daysBefore(6) && i.date <= localDate()
  );
  const filtered = items
    .filter(
      (i) =>
        matches(i, query) &&
        (filter === "all" || workoutDone(i) === (filter === "completed"))
    )
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const days = Array.from({ length: 7 }, (_, i) => daysBefore(6 - i));
  const minutes = days.map((day) =>
    total(
      recent.filter((i) => i.date === day),
      "duration"
    )
  );
  const scale = Math.max(1, ...minutes);
  return (
    <>
      <PageHeader
        title="Fitness"
        subtitle="Plan a session, record the work, and see your movement add up."
        add={records.add}
        label="Log workout"
      />
      <Metrics
        items={[
          ["Sessions", recent.length, "Completed in the last 7 days"],
          ["Movement", `${total(recent, "duration")} min`, "Last 7 days"],
          [
            "Distance",
            `${Number(total(recent, "distance").toFixed(2))} km`,
            "Last 7 days",
          ],
          [
            "Planned",
            items.filter((i) => !workoutDone(i)).length,
            "Sessions still to complete",
          ],
        ]}
      />
      <div className="fitness-layout">
        <section className="panel movement-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">A week of movement</h2>
              <p className="panel-subtitle">Completed minutes per day</p>
            </div>
          </div>
          <div className="movement-chart">
            {days.map((day, index) => (
              <div key={day} className="movement-column">
                <span>{minutes[index]}</span>
                <div className="movement-track">
                  <div
                    style={{ height: `${(minutes[index] / scale) * 100}%` }}
                  />
                </div>
                <small>
                  {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </small>
              </div>
            ))}
          </div>
          <p className="chart-footnote">
            Planned and undated workouts are excluded from this chart.
          </p>
        </section>
        <section>
          <Search query={query} setQuery={setQuery} label="workouts">
            <select
              aria-label="Filter workouts"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All sessions</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
            </select>
          </Search>
          <div className="workout-list">
            {filtered.map((item) => (
              <article className="workout-card" key={item.id}>
                <div className="workout-date">
                  <strong>{item.date ? item.date.slice(8) : "—"}</strong>
                  <small>
                    {item.date
                      ? new Date(`${item.date}T12:00:00`).toLocaleDateString(
                          undefined,
                          { month: "short", year: "numeric" }
                        )
                      : "No date"}
                  </small>
                </div>
                <div className="workout-content">
                  <div className="record-meta">
                    <span className="tag">{item.activity || "Workout"}</span>
                    <span>{workoutDone(item) ? "Completed" : "Planned"}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p className="record-date">
                    {item.duration
                      ? `${item.duration} min`
                      : "Duration not recorded"}
                    {item.distance ? ` · ${item.distance} km` : ""}
                  </p>
                  {item.detail && <p className="record-copy">{item.detail}</p>}
                  <div className="workout-footer">
                    <button
                      className="outline-button"
                      onClick={() =>
                        records.save({
                          ...item,
                          done: !workoutDone(item),
                          status: workoutDone(item) ? "planned" : "completed",
                        })
                      }
                    >
                      {workoutDone(item) ? "Mark planned" : "Mark completed"}
                    </button>
                    <Actions item={item} records={records} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <Empty add={records.add} label="Log a workout">
              {items.length
                ? "No sessions match this view."
                : "Your movement counts. Record your first session."}
            </Empty>
          )}
        </section>
      </div>
      {records.dialogs}
    </>
  );
}

export function NotesPage({ items, updateItems }) {
  const records = useRecords("notes", updateItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);
  const categories = [
    ...new Set(items.map((i) => i.category || "Unfiled")),
  ].sort();
  const filtered = items
    .filter(
      (i) =>
        matches(i, query) &&
        (!category || (i.category || "Unfiled") === category)
    )
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
  const active = filtered.find((i) => i.id === selected) || filtered[0];
  const exportNote = () => {
    const url = URL.createObjectURL(
      new Blob([`${active.title}\n\n${active.detail || ""}`], {
        type: "text/plain;charset=utf-8",
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      active.title.replace(/[^a-z0-9 _-]/gi, "").slice(0, 80) || "note"
    }.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeader
        title="Notes"
        subtitle="A home for ideas, plans, and things worth remembering."
        add={records.add}
        label="New note"
      />
      <Search query={query} setQuery={setQuery} label="notes">
        <select
          aria-label="Filter notebook"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All notebooks</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="record-date">{filtered.length} notes</span>
      </Search>
      <div className="notes-layout">
        <section className="note-index" aria-label="Notes list">
          {filtered.map((item) => (
            <button
              key={item.id}
              className={`note-preview ${
                active?.id === item.id ? "selected" : ""
              }`}
              onClick={() => setSelected(item.id)}
            >
              <span className="record-meta">
                {item.category || "Unfiled"}
                {item.pinned && " · Pinned"}
              </span>
              <strong>{item.title}</strong>
              <p>{item.detail || "Empty note"}</p>
              <small>
                {item.updatedAt
                  ? new Date(item.updatedAt).toLocaleDateString()
                  : "Saved note"}
              </small>
            </button>
          ))}
          {!filtered.length && (
            <Empty add={records.add} label="Create a note">
              {items.length ? "No matching notes." : "Capture your first idea."}
            </Empty>
          )}
        </section>
        <article className="note-paper">
          {active ? (
            <>
              <div className="record-meta">
                <span>{active.category || "Unfiled"}</span>
                <button
                  className="small-link"
                  aria-pressed={!!active.pinned}
                  onClick={() =>
                    records.save({ ...active, pinned: !active.pinned })
                  }
                >
                  {active.pinned ? "Unpin" : "Pin note"}
                </button>
              </div>
              <h2>{active.title}</h2>
              <div className="note-tags">
                {(active.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((tag, i) => (
                    <span className="tag" key={`${tag}-${i}`}>
                      {tag}
                    </span>
                  ))}
              </div>
              <div className="note-body">{active.detail}</div>
              <footer className="note-footer">
                <span>
                  {
                    (active.detail || "").trim().split(/\s+/).filter(Boolean)
                      .length
                  }{" "}
                  words
                </span>
                <button className="small-link" onClick={exportNote}>
                  Download .txt
                </button>
                <Actions item={active} records={records} />
              </footer>
            </>
          ) : (
            <div className="note-placeholder">
              <h2>Room to think.</h2>
              <p>Select a note or start a new one.</p>
            </div>
          )}
        </article>
      </div>
      {records.dialogs}
    </>
  );
}

export function AnalyticsPage({ data }) {
  const [range, setRange] = useState(7);
  const today = localDate();
  const start = daysBefore(range - 1);
  const checkins = data.habits.reduce(
    (s, item) =>
      s +
      habitDates(item).filter((date) => date >= start && date <= today).length,
    0
  );
  const workouts = data.fitness.filter(
    (i) => workoutDone(i) && i.date >= start && i.date <= today
  );
  const completed = data.tasks.filter((i) => taskStatus(i) === "done").length;
  const goals = data.goals.length
    ? Math.round(
        data.goals.reduce((s, i) => s + goalProgress(i), 0) / data.goals.length
      )
    : 0;
  const currency = (amount) =>
    amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  const expense = total(
    data.transactions.filter((i) => i.type === "expense"),
    "amount"
  );
  const spending = total(
    data.transactions.filter((i) => i.type === "spending"),
    "amount"
  );
  const savings = total(
    data.transactions.filter((i) => i.type === "savings"),
    "amount"
  );
  const activity = [
    ...new Set(workouts.map((i) => i.activity || "Workout")),
  ].map((name) => [
    name,
    total(
      workouts.filter((i) => (i.activity || "Workout") === name),
      "duration"
    ),
  ]);
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="An honest overview of what you have recorded, and where to focus next."
      />
      <div className="workspace-tools">
        <label className="range-label">
          Habit & fitness period{" "}
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <span className="record-date">
          {start} – {today}
        </span>
      </div>
      <Metrics
        items={[
          ["Habit check-ins", checkins, `Last ${range} days`],
          [
            "Workout time",
            `${total(workouts, "duration")} min`,
            `${workouts.length} completed sessions in period`,
          ],
          [
            "Tasks completed",
            `${completed} / ${data.tasks.length}`,
            "Current snapshot · all tasks",
          ],
          ["Goal progress", `${goals}%`, "Current average · all goals"],
        ]}
      />
      <div className="analytics-grid">
        <section className="panel analytics-card">
          <div className="record-meta">
            <span className="eyebrow">Consistency</span>
            <Link className="small-link" to="/habits">
              Manage habits →
            </Link>
          </div>
          <h2>Show up, one day at a time</h2>
          <p className="record-date">
            Days checked in during this period. New habits are shown against the
            full period.
          </p>
          {data.habits.map((item) => {
            const count = habitDates(item).filter(
              (d) => d >= start && d <= today
            ).length;
            return (
              <div className="analytics-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {count} / {range} days
                  </span>
                </div>
                <Meter
                  value={percentage(count, range)}
                  label={`${item.title} check-in rate`}
                />
              </div>
            );
          })}
          {!data.habits.length && (
            <p className="record-copy">
              Add habits and check in to see your consistency here.
            </p>
          )}
        </section>
        <section className="panel analytics-card">
          <div className="record-meta">
            <span className="eyebrow">Movement</span>
            <Link className="small-link" to="/fitness">
              View workouts →
            </Link>
          </div>
          <h2>How you moved</h2>
          <p className="record-date">
            Completed workout minutes by activity, in this period.
          </p>
          {activity.map(([name, minutes]) => (
            <div className="analytics-row" key={name}>
              <div>
                <strong>{name}</strong>
                <span>{minutes} min</span>
              </div>
              <Meter
                value={percentage(minutes, total(workouts, "duration"))}
                label={`${name} share of workout time`}
              />
            </div>
          ))}
          {!activity.length && (
            <p className="record-copy">
              No dated, completed workouts in this period.
            </p>
          )}
        </section>
        <section className="panel analytics-card">
          <div className="record-meta">
            <span className="eyebrow">Finance · all records</span>
            <Link className="small-link" to="/finance">
              Open finance →
            </Link>
          </div>
          <h2>Your money at a glance</h2>
          {[
            ["Spending money", spending - expense],
            ["Savings", savings],
            ["Expenses", expense],
            ["Total money", spending - expense + savings],
          ].map(([label, amount]) => (
            <div className="finance-insight" key={label}>
              <span>{label}</span>
              <strong>{currency(amount)}</strong>
            </div>
          ))}
          <p className="record-date">
            All-time totals. Transactions do not currently record a transaction
            date.
          </p>
        </section>
        <section className="panel analytics-card">
          <span className="eyebrow">Next steps</span>
          <h2>Make space for what matters</h2>
          <Link className="insight-link" to="/tasks">
            <strong>
              {
                data.tasks.filter(
                  (i) => i.due && i.due < today && taskStatus(i) !== "done"
                ).length
              }{" "}
              overdue tasks
            </strong>
            <span>Review deadlines and choose your next action →</span>
          </Link>
          <Link className="insight-link" to="/goals">
            <strong>
              {data.goals.filter((i) => goalProgress(i) < 100).length} active
              goals
            </strong>
            <span>Record progress or adjust your target →</span>
          </Link>
          <Link className="insight-link" to="/notes">
            <strong>{data.notes.length} saved notes</strong>
            <span>Revisit ideas and turn them into action →</span>
          </Link>
        </section>
      </div>
    </>
  );
}
