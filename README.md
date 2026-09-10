# Daymark Dashboard

A responsive React dashboard for schedule and personal finance management.

## Stack

- React 18
- React Router
- Tailwind CSS 3
- Vite and Node.js tooling
- Express REST API
- PostgreSQL database persistence

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Create a production build with `npm run build`, then preview it with `npm run preview`.

The API runs on port `3001` during development. Copy `.env.example` to `.env`, create a PostgreSQL database named `princeos`, and update `DATABASE_URL` if needed. The API creates its tables and demo user automatically.
