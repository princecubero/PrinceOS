# PrinceOS (Daymark Dashboard)

A responsive React dashboard for schedule and personal finance management.

## Stack

- React 18 and React Router
- Tailwind CSS 3 and Vite
- Node.js and Express REST API
- PostgreSQL database persistence

## First-time setup on Windows

### 1. Open the project in PowerShell

```powershell
cd "C:\Users\Msi User\Desktop\test2"
```

Run all commands below from this folder.

### 2. Check prerequisites

```powershell
node --version
npm --version
```

The project declares Node.js `>=14.16` in `package.json`. Node.js and npm must be installed and available in your terminal. PostgreSQL must also be installed and running locally; you can check its service in Windows Services (`services.msc`).

### 3. Install dependencies

```powershell
npm install
```

Do this on first setup or when project dependencies change.

### 4. Configure your local database connection

Create `.env` only if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

The example settings are:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/princeos
DATABASE_SSL=false
PORT=3001
```

Update the PostgreSQL username, password, and port to match your actual local installation. The example uses username `postgres`, password `postgres`, port `5432`, and database `princeos`; these are examples, not verified credentials. URL-encode special characters in credentials used in `DATABASE_URL`. Save the file before continuing.

Keep `PORT=3001` for the existing Vite API proxy. Changing the API port also requires updating the proxy target in `vite.config.js`.

### 5. Initialize the database

```powershell
npm run db:setup
```

This creates the configured database if missing, applies `database/schema.sql`, and creates a local profile using your operating-system account name. PostgreSQL must already be running, and the configured account needs permission to create the database if it does not exist.

Wait for `Database "princeos" is ready.` (or your configured database name) before proceeding.

### 6. Start development mode

```powershell
npm run dev
```

This starts both the Express API and the Vite frontend. Keep this terminal open while using the app.

### 7. Open the app and verify the API

Open the exact local frontend URL printed by Vite in the terminal.

The API runs at `http://127.0.0.1:3001` with the example settings. In a second PowerShell terminal, check the API and its database connection:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

A successful response contains `status: ok` and `database: postgresql`.

### 8. Stop the app

Press `Ctrl+C` in the terminal running `npm run dev`. If prompted to terminate the batch job, type `Y` and press Enter.

## Start it again next time

1. Make sure your local PostgreSQL service is running.
2. Open PowerShell and run:

```powershell
cd "C:\Users\Msi User\Desktop\test2"
npm run dev
```

3. Open the frontend URL printed by Vite.

You do not need to reinstall dependencies or recreate `.env` on every start.

## Build and run the built app locally

To build the frontend and then serve it with the API:

```powershell
npm run preview
```

Open `http://127.0.0.1:3001` with the example settings. PostgreSQL and a working `.env` are still required.

Alternatively, run the two steps separately:

```powershell
npm run build
npm start
```

`npm run build` creates the frontend files in `dist`; it does not start a server. `npm start` runs the API and serves `dist` if it exists. Rebuild after frontend changes when using this mode.

## Troubleshooting

- **`npm` is not recognized:** Check that Node.js and npm are installed, then reopen PowerShell.
- **`vite` or `concurrently` is not recognized:** Run `npm install` from this project folder, then retry `npm run dev`.
- **`DATABASE_URL is required`:** Complete the `.env` configuration step and restart the app.
- **Connection refused / `ECONNREFUSED`:** Check that PostgreSQL is running and that the host and port in `.env` match your installation.
- **Password authentication failed:** Correct the database username and password in `.env`, then restart the app.
- **Database does not exist:** Run `npm run db:setup` with a database account that has the required permissions.
- **Port already in use / `EADDRINUSE`:** Stop the previous app instance with `Ctrl+C`. To identify the process listening on the default API port, run `Get-NetTCPConnection -LocalPort 3001 -State Listen`.
- **The page opens but data requests fail:** Read the API errors in the terminal and run the health check above. The frontend needs a working API and PostgreSQL connection.

## Stored data and timestamps

New installations start with empty collections. No sample events, transactions, balances, budgets, or analytics values are generated. Data loads from PostgreSQL; the old demo local-storage cache is no longer imported.

Both `users` and `module_records` have `addtime` and `updatetime` (`TIMESTAMPTZ`). Inserts set both automatically. Updates preserve `addtime` and change `updatetime` only when stored content changes. Unchanged records retain both timestamps.

Run `npm run db:setup` and restart the API after updating. The migration renames existing timestamps, preserves user-created records, and removes only exact original sample records belonging to the legacy demo account. Modified sample records are retained and transferred to the local profile. Older module records had no creation timestamp, so their existing last-update value is used as the earliest known `addtime`.

This is a single-user app. Configure its login as described below; the API does not accept a browser-supplied user identity.

### Verify timestamp and data migrations

With local PostgreSQL running and `.env` configured, run `node scripts/test-database.cjs`. This exercises migration, sample cleanup, timestamp preservation, and API save/reload/delete behavior in temporary schemas that are removed afterward. The database account needs permission to create schemas.

## Configure login

PrinceOS protects dashboard and state API access with a PostgreSQL-backed login and an HTTP-only session cookie. Configure or reset the single local account before signing in:

```powershell
npm run auth:setup
```

Enter a username and a password of at least 10 characters. The password is processed locally with scrypt; only its salt and hash are stored in PostgreSQL. Running this command again changes the credentials and signs out existing sessions.

The login session lasts 30 days. Use **Sign out** when using a shared device. Production cookies use the Secure flag when NODE_ENV is production.

## Finance behavior

PrinceOS displays money in Philippine pesos (`PHP`). Transactions can add `spending` money, record an `expense`, or add `savings`, with an optional note. Spending money is calculated as additions minus expenses. Savings is a separate balance, so expenses never reduce it. Total money combines the current spending-money balance with savings. Hover over a transaction, focus it with the keyboard, or view it on a touch device to reveal its **Edit** button. The database migration converts earlier `income` entries to `savings` and preserves an earlier category as its note.
