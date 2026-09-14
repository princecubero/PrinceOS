// Uses a disposable PostgreSQL schema; never writes to the user's workspace data.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const net = require("net");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });
const { Client } = require("pg");
const initialize = require("../database/initialize");
const { hashPassword } = require("../auth");
const cli = process.env.AGENT_BROWSER_BIN;
if (!cli)
  throw new Error("Set AGENT_BROWSER_BIN to the agent-browser executable.");
const schema = "workspace_test_" + Date.now();
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});
let server;
let origin;
function browser(...args) {
  const result = spawnSync(cli, ["--session", "workspace-check", ...args], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 40000,
  });
  if (result.status !== 0)
    throw new Error(args[0] + ": " + result.stdout + result.stderr);
  return result.stdout;
}
function evaluate(code) {
  return browser("eval", code);
}
function click(text) {
  const line = browser('snapshot').split('\n').find(line => line.includes(`button "${text}"`));
  const match = line && line.match(/ref=(e\d+)/);
  if (!match) throw new Error('Button not found: ' + text);
  browser('scrollintoview', '@' + match[1]);
  browser('click', '@' + match[1]);
}
function fill(label, value) {
  if (label === 'Due date') {
    evaluate(`document.querySelector('input[name="due"]').value = ${JSON.stringify(value)}`);
    return;
  }
  if (label === "Note")
    browser("fill", 'textarea[name="detail"]', String(value));
  else browser("find", "label", label, "fill", String(value));
}
function select(label, value) {
  const selectors = {
    Priority: 'select[name="priority"]',
    Activity: 'select[name="activity"]',
    "Habit & fitness period": ".range-label select",
  };
  browser("select", selectors[label] || `select[aria-label="${label}"]`, value);
}
function page(route) {
  browser("open", origin + route);
  saved();
}
function saved() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const snapshot = browser("snapshot");
    if (/database connected/i.test(snapshot)) return;
    if (attempt === 7)
      throw new Error("Page did not finish saving/loading: " + snapshot);
  }
}
async function payload(module) {
  return (
    await client.query("SELECT payload FROM module_records WHERE module=$1", [
      module,
    ])
  ).rows.map((r) => r.payload);
}
async function main() {
  // Pure calculations: date boundaries, legacy records, and reversible check-ins.
  const source = fs.readFileSync(
    path.join(root, "src/workspace-model.js"),
    "utf8"
  );
  const model = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  assert.equal(model.daysBefore(1, "2026-03-01"), "2026-02-28");
  assert.equal(model.goalProgress({ progress: 35 }), 35);
  assert.equal(model.goalProgress({ current: 15, target: 10 }), 100);
  assert.equal(
    model.habitStreak({ checkins: ["2026-09-12", "2026-09-13"] }, "2026-09-14"),
    2
  );
  assert.deepEqual(
    model.toggleCheckin(
      model.toggleCheckin({ id: "h" }, "2026-09-14"),
      "2026-09-14"
    ).checkins,
    []
  );
  console.log(
    "PASS date, progress, legacy compatibility, and habit calculations"
  );
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await initialize(client);
  const password = "Temporary-workspace-test-2026!";
  const credentials = await hashPassword(password);
  await client.query(
    "UPDATE users SET username='workspace-test', password_salt=$1, password_hash=$2",
    [credentials.salt, credentials.hash]
  );
  const port = await new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  origin = `http://127.0.0.1:${port}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("options", "-c search_path=" + schema);
  server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url.toString(), PORT: String(port) },
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server startup timeout")),
      15000
    );
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("API running")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("Server exited: " + code));
    });
  });
  browser("open", origin);
  browser('set', 'viewport', '1440', '1100');
  fill("Username", "workspace-test");
  fill("Password", password);
  click("Sign in");
  saved();
  assert(
    !evaluate("!!document.querySelector('vite-error-overlay')").includes("true")
  );
  console.log("PASS browser loads, login, authenticated database connection");
  for (const route of [
    "/fitness",
    "/goals",
    "/habits",
    "/tasks",
    "/notes",
    "/analytics",
  ]) {
    page(route);
    assert(evaluate('document.querySelector("h1").textContent').length > 2);
  }
  console.log("PASS all six pages render with empty data");

  page("/tasks");
  click("+ New task");
  fill("Task", "Prepare weekly review");
  fill("Description", "Collect progress and next actions");
  fill("Due date", "2026-01-01");
  select("Priority", "High");
  fill("Project / area", "Personal");
  click("Save task");
  saved();
  select("Status of Prepare weekly review", "doing");
  saved();
  assert.equal((await payload("tasks"))[0].status, "doing");
  click("Edit Prepare weekly review");
  fill("Task", "Review the week");
  click("Save task");
  saved();
  page("/tasks");
  assert(browser("snapshot").includes("Review the week"));
  browser("fill", 'input[aria-label="Search tasks"]', "does-not-match");
  assert(!browser("snapshot").includes("Edit Review the week"));
  console.log("PASS task create, edit, status, search, and database reload");

  page("/goals");
  click("+ New goal");
  fill("Goal", "Read twelve books");
  fill("Target", "12");
  fill("Current amount", "3");
  fill("Unit (books, pesos, sessions…)", "books");
  click("Save goal");
  saved();
  assert.equal((await payload("goals"))[0].progress, 25);
  click("Update progress");
  fill("Current amount", "12");
  click("Save goal");
  saved();
  select("Filter goals", "completed");
  assert(browser("snapshot").includes("Read twelve books"));
  console.log("PASS measurable goal progress and achieved filtering");

  page("/habits");
  click("+ New habit");
  fill("Habit", "Read every day");
  click("Save habit");
  saved();
  click("Read every day on " + model.localDate());
  saved();
  assert.deepEqual((await payload("habits"))[0].checkins, [model.localDate()]);
  page("/habits");
  assert(evaluate('!!document.querySelector("button[aria-pressed=true]")').includes("true"));
  click("Read every day on " + model.localDate());
  saved();
  assert.equal((await payload("habits"))[0].checkins.length, 0);
  click("Previous seven days");
  click("Today");
  console.log(
    "PASS daily habit check-in, undo, persistence, and history navigation"
  );

  page("/fitness");
  click("+ Log workout");
  fill("Workout", "Evening walk");
  fill("Minutes", "45");
  fill("Distance (km, optional)", "3.5");
  select("Activity", "Walking");
  click("Save workout");
  saved();
  assert.equal((await payload("fitness"))[0].duration, 45);
  click("Mark planned");
  saved();
  assert.equal((await payload("fitness"))[0].done, false);
  click("Mark completed");
  saved();
  console.log("PASS workout logging, numeric fields, and completion toggles");

  page("/notes");
  click("+ New note");
  fill("Title", "Ideas for next month");
  fill("Notebook", "Personal");
  fill("Tags (comma separated)", "plans, reflection");
  fill("Note", "First line\nSecond line");
  click("Save note");
  saved();
  click("Pin note");
  saved();
  assert.equal((await payload("notes"))[0].pinned, true);
  click("Edit Ideas for next month");
  fill("Note", "Revised first line\nSecond line");
  click("Save note");
  saved();
  page("/notes");
  assert(browser("snapshot").includes("Revised first line"));
  console.log("PASS note creation, editing, pinning, and multiline reload");

  page("/analytics");
  select("Habit & fitness period", "30");
  assert(browser("snapshot").includes("45 min"));
  fs.mkdirSync(path.join(root, ".local-backups", "workspace-verification"), {
    recursive: true,
  });
  for (const route of [
    "tasks",
    "goals",
    "habits",
    "fitness",
    "notes",
    "analytics",
  ]) {
    page("/" + route);
    browser("set", "viewport", "1440", "1000");
    browser(
      "screenshot",
      path.join(
        root,
        ".local-backups",
        "workspace-verification",
        route + ".png"
      )
    );
    browser("set", "viewport", "390", "844");
    assert(
      evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth"
      ).includes("true"),
      "Horizontal overflow on " + route
    );
  }
  browser(
    "screenshot",
    path.join(root, ".local-backups", "workspace-verification", "mobile.png")
  );
  const errors = browser("errors");
  assert(!/Error:|ReferenceError|TypeError/.test(errors), errors);
  console.log(
    "PASS analytics period, desktop screenshots, all mobile widths, no browser errors"
  );
  for (const [module, title] of [
    ["tasks", "Review the week"],
    ["goals", "Read twelve books"],
    ["habits", "Read every day"],
    ["fitness", "Evening walk"],
    ["notes", "Ideas for next month"],
  ]) {
    page("/" + module);
    if (module === "goals") select("Filter goals", "all");
    click("Delete " + title);
    click("Keep it");
    assert.equal((await payload(module)).length, 1);
    click("Delete " + title);
    click(
      "Delete " +
        {
          tasks: "task",
          goals: "goal",
          habits: "habit",
          fitness: "workout",
          notes: "note",
        }[module]
    );
    saved();
    assert.equal((await payload(module)).length, 0);
  }
  console.log(
    "PASS cancel and confirmed deletion across all five editable modules"
  );
}
main()
  .catch((error) => {
    console.error(error);
    try {
      console.error(browser("snapshot"));
      browser(
        "screenshot",
        path.join(root, ".local-backups", "workspace-failure.png")
      );
    } catch (_) {}
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      browser("close");
    } catch (_) {}
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (/^workspace_test_\d+$/.test(schema))
      await client
        .query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
        .catch(() => {});
    await client.end();
  });
