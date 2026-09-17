# PrinceOS

A personal dashboard for keeping track of tasks, money, routines, and plans in one place.

The calendar holds events and appointments. Finance tracks spending money, expenses, and savings in Philippine pesos. There are also pages for goals, daily habits, workouts, and notes, with an overview of progress in Analytics.

Built with React, Vite, Tailwind CSS, Express, and PostgreSQL. It runs locally with a single user account.

## Running it locally

You'll need Node.js 22 or newer, npm, and a running PostgreSQL server. `npm run dev` starts the app, but it doesn't start PostgreSQL.

Clone the repo and install the dependencies:

```powershell
git clone https://github.com/princecubero/PrinceOS.git
cd PrinceOS
npm install
```

Create `.env` from the example if you don't already have one:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Update the connection string with your local PostgreSQL credentials:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/princeos
DATABASE_SSL=false
PORT=3001
```

URL-encode any special characters in the username or password. If you change the API port, update the proxy in `vite.config.js` too.

Set up the database and login, then start the app:

```powershell
npm run db:setup
npm run auth:setup
npm run dev
```

The database setup creates `princeos` if it doesn't exist, so the PostgreSQL account needs permission to create databases. Login setup asks for a username and a password of at least 10 characters.

Open the URL printed by Vite. Keep the terminal open while using the app; press `Ctrl+C` to stop it.

After the first setup, just run `npm run dev` from the project folder. For the existing checkout on this PC:

```powershell
cd "C:\Users\Msi User\Desktop\test2"
npm run dev
```

## A few things to know

- **Organize with AI** in Brain dump separates natural sentences into tasks, notes, goals, and calendar events. Add `GROQ_API_KEY` to your local `.env` and restart the server. The optional `GROQ_MODEL` defaults to `openai/gpt-oss-120b`. Only submitted thoughts and the local date are sent. Free-tier limits apply. Never commit your `.env` or share the key.
- Review suggestions individually: select which to save, change their destination, and edit titles, descriptions, dates, and event times. Ambiguous timing prompts a question; choose a date/time or explicitly keep non-events undated. Events require both date and time. Goals start at 0% and can be configured further in Goals. Optional steps become a checklist in the description when selected.
- Possible duplicate tasks are matched locally by title similarity. Choose an existing task to update or explicitly add a separate task. Updates preserve progress and append descriptions; an empty due date preserves the existing date. Duplicate matching is a suggestion, so check the match before accepting.
- **Suggest my daily plan** ranks up to five saved open tasks by overdue/due-today dates, priority, and current progress. It uses no AI quota and does not change your schedule. Newly saved tasks appear the next time you open Brain dump.

- The **Brain dump** button beside the dark-mode switch is available on the dashboard and every workspace page, and stays visible as you scroll. It turns one thought per line into editable task suggestions. It recognizes trailing today/tomorrow, weekday names (the next occurrence after today), and YYYY-MM-DD dates, plus an **Urgent:** or **High priority:** prefix. Review suggestions and click **Add tasks** to save; original lines stay in task descriptions. This runs locally with no AI API or subscription.
- Dark mode keeps the green theme and is on by default. Use **Dark mode On/Off** on the login screen or above any page to switch. Your choice is saved in this browser.
- Data is saved in PostgreSQL. A fresh database starts empty. Cloning the repo on another computer won't bring your records with it; use a database backup and restore to transfer them.
- Expenses reduce spending money, not savings. Total money is the remaining spending balance plus savings.
- Habits repeat daily. You can add or undo check-ins for today and earlier dates. Streaks count consecutive days ending today or yesterday.
- Analytics uses the selected period for habits and workouts. Task, goal, and finance figures are current or all-time totals, as labeled on the page.
- Login lasts 30 days. Use **Sign out** to end it, or rerun `npm run auth:setup` to change your credentials and clear existing sessions.
- If a save fails, keep the page open and use **Retry save**.

## Making changes

| File | What's in it |
| --- | --- |
| `src/App.jsx` | Routes, login, dashboard, calendar, finance, and saving data |
| `src/WorkspacePages.jsx` | Tasks, goals, habits, fitness, notes, and analytics; editor fields are defined near the top |
| `src/workspace-model.js` | Date, streak, and progress calculations |
| `src/input.css` / `src/workspace.css` | Shared styles and workspace page layouts |
| `server.js` | API routes and authentication |
| `database/` | Database schema and migrations |

To build and serve the frontend with the API:

```powershell
npm run build
npm start
```

Open `http://127.0.0.1:3001`. Rebuild after frontend changes. `npm run preview` combines these two steps.

## Troubleshooting and checks

If the app can't connect, check that PostgreSQL is running and that `.env` has the right credentials. On Windows, you can check the service in `services.msc`. If the database is missing, run `npm run db:setup`.

To check the API and database connection while the app is running:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

A working connection returns `status: ok` and `database: postgresql`. If a port is already in use, stop the previous app instance before starting another one.

Run `node scripts/test-database.cjs` to check migrations and API persistence. For browser checks, build the app, set `AGENT_BROWSER_BIN` to an installed agent-browser executable, and run `node scripts/test-workspace.cjs`. Both tests use temporary database schemas and require permission to create them. Browser screenshots go into `.local-backups/workspace-verification/`.

Brain dump checks: `node scripts/test-brain-dump-agent.mjs` and `node scripts/test-brain-dump-review.mjs`. Run `node scripts/test-brain-dump-browser.cjs` with `AGENT_BROWSER_BIN` set after building to verify mixed saves, duplicate updates, daily planning, and mobile layout in a disposable schema. Its AI responses are fixtures for repeatability; saved records use the real API and PostgreSQL.

When updating an older installation, run `npm run db:setup` before restarting. Migrations preserve edited records and remove only unchanged legacy demo entries. Records use `addtime` and `updatetime`; saving an unchanged record doesn't change its timestamps.
