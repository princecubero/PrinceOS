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
const schema = "brain_review_test_" + Date.now();
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});
let server;
let origin;
function browser(...args) {
  const result = spawnSync(cli, ["--session", "brain-review-check", ...args], {
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

  assert.equal((await fetch(origin + '/api/brain-dump', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:'test',today:'2026-09-17'})})).status,401);
  const drafts = [
    {type:'task',title:'Pay internet bill',detail:'Pay internet bill tomorrow',due:'2026-09-18',priority:'High',time:'',question:'',steps:[]},
    {type:'note',title:'Spare keys',detail:'Keys are in the drawer',due:'',priority:'Normal',time:'',question:'',steps:[]},
    {type:'goal',title:'Build portfolio',detail:'Create a portfolio',due:'',priority:'Normal',time:'',question:'',steps:[{title:'Choose projects',selected:false}]},
    {type:'event',title:'Meet Alex',detail:'Meet Alex sometime',due:'',priority:'Normal',time:'',question:'When will you meet Alex?',steps:[]}
  ];
  evaluate(`window.originalFetch=window.fetch; window.fetch=(url, options)=>url==='/api/brain-dump' ? Promise.resolve(new Response(JSON.stringify({drafts: ${JSON.stringify(drafts)}}),{status:200,headers:{'Content-Type':'application/json'}})) : window.originalFetch(url,options)`);
  click('Brain dump');
  browser('find','label','Your thoughts','fill','Mixed thoughts');
  click('Organize with AI');
  assert(browser('snapshot').includes('When will you meet Alex?'));
  click('Select none');
  assert(browser('snapshot').includes('Save 0 selected'));
  click('Select all');
  // The CLI's fill command does not dispatch React changes for native date/time controls.
  for (const [type, value] of [['date','2026-09-19'], ['time','15:00']]) {
    evaluate(`(() => { const input = document.querySelector('.brain-dump-draft:nth-child(4) input[type="${type}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, '${value}'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  }
  browser('check','.brain-steps input');
  const screenshots=path.join(root,'.local-backups','brain-review');
  fs.mkdirSync(screenshots,{recursive:true});
  browser('screenshot',path.join(screenshots,'review.png'));
  click('Save 4 selected');
  saved();
  assert.equal((await payload('tasks')).length,1);
  assert.equal((await payload('notes')).length,1);
  assert((await payload('goals'))[0].detail.includes('Choose projects'));
  assert.equal((await payload('events'))[0].time,'15:00');
  click('Brain dump');
  click('Suggest my daily plan');
  assert(browser('snapshot').includes('Pay internet bill'));
  browser('find','label','Your thoughts','fill','Pay internet bill tomorrow');
  click('Organize locally');
  assert(browser('snapshot').includes('Possible existing task'));
  const task=(await payload('tasks'))[0];
  browser('select','.brain-question select','update:'+task.id);
  click('Save 1 selected');
  saved();
  assert.equal((await payload('tasks')).length,1);
  browser('open',origin+'/notes'); saved();
  assert(browser('snapshot').includes('Spare keys'));
  browser('open',origin+'/goals'); saved();
  assert(browser('snapshot').includes('Build portfolio'));
  browser('set','viewport','390','844');
  click('Brain dump');
  browser('find','label','Your thoughts','fill','Mobile check');
  click('Organize locally');
  browser('screenshot',path.join(screenshots,'mobile.png'));
  assert(!evaluate('document.documentElement.scrollWidth > window.innerWidth').includes('true'));
  assert(!browser('errors').trim().replace('No errors','').trim());
  console.log('PASS authenticated route, mixed browser saves, selection, clarification, checklist, duplicate update, daily plan, reload persistence, mobile layout.');
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
    if (/^brain_review_test_\d+$/.test(schema))
      await client
        .query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
        .catch(() => {});
    await client.end();
  });
