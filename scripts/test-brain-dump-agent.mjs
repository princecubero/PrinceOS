import assert from 'node:assert/strict';
import { normalizeSuggestions, requestSchema, createBrainDumpHandler } from '../brain-dump-agent.mjs';

const task = { title: 'Buy milk', source: 'Buy milk tomorrow', due: '2026-09-18', priority: 'Normal' };
assert.equal(normalizeSuggestions({ tasks: [task] }, task.source)[0].status, 'todo');
assert.throws(() => normalizeSuggestions({ tasks: [{ ...task, due: '2026-02-30' }] }, task.source));
assert.throws(() => normalizeSuggestions({ tasks: [{ ...task, source: 'invented' }] }, task.source));
assert.throws(() => normalizeSuggestions({ tasks: [{ ...task, priority: 'Critical' }] }, task.source));
assert.equal(requestSchema.safeParse({ text: 'x'.repeat(10001), today: '2026-09-17' }).success, false);
const response = () => ({ code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = { body: { text: task.source, today: '2026-09-17' } };
const originalKey = process.env.GROQ_API_KEY;
try {
  delete process.env.GROQ_API_KEY;
  let result = response();
  await createBrainDumpHandler()(request, result);
  assert.equal(result.code, 503);
  process.env.GROQ_API_KEY = 'test-only';
  result = response();
  await createBrainDumpHandler()( { body: {} }, result);
  assert.equal(result.code, 400);
  let release;
  const handler = createBrainDumpHandler(() => new Promise(resolve => { release = resolve; }));
  const first = response();
  const running = handler(request, first);
  result = response();
  await handler(request, result);
  assert.equal(result.code, 429);
  release([task]);
  await running;
  assert.equal(first.body.drafts.length, 1);
  result = response();
  await createBrainDumpHandler(async () => { throw new Error('secret-provider-details'); })(request, result);
  assert.equal(result.code, 503);
  assert.equal(JSON.stringify(result.body).includes('secret-provider-details'), false);
} finally {
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
}
console.log('AI validation, missing key, failures, and concurrency checks passed.');
