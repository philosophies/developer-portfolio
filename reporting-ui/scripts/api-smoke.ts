import assert from 'node:assert/strict';
import { HttpClient } from '../src/http.ts';

// Credentials arrive on stdin, not in arguments, files or console output.
let input = '';
for await (const chunk of process.stdin) input += String(chunk);
const credentials = JSON.parse(input) as { operatorToken?: string; reviewerToken?: string };
if (!credentials.operatorToken || !credentials.reviewerToken) {
  throw new Error('Provide local development operatorToken and reviewerToken on stdin.');
}
const localFetch: typeof fetch = (path, options) =>
  fetch('http://127.0.0.1:5080' + String(path), options);
const owner = new HttpClient(() => credentials.operatorToken!, localFetch);
const reviewer = new HttpClient(() => credentials.reviewerToken!, localFetch);
const department = 'Contract-' + Date.now();
const payload = {
  externalId: 'contract-' + crypto.randomUUID(),
  department,
  occurredOn: '2026-01-10',
  amount: 12.5,
  status: 'valid' as const,
};
let record = await owner.create(payload);
assert.equal(record.workflowState, 'draft');
record = await owner.submit(record);
await assert.rejects(owner.review(record, true, 'Not a reviewer'), { status: 403 });
record = await reviewer.review(record, true, 'Verified synthetic contract fixture');
assert.equal((await owner.reports()).find((row) => row.department === department)?.total, 12.5);
record = await owner.correct(record, { ...payload, amount: 15 }, 'Corrected synthetic fixture');
assert.equal(record.workflowState, 'draft');
assert.equal(
  (await owner.reports()).find((row) => row.department === department),
  undefined,
);
assert.deepEqual(
  (await owner.history(record.id)).map((event) => event.action),
  ['create', 'submit', 'approve', 'correct'],
);
await assert.rejects(reviewer.correct(record, payload, 'Not the owner'), { status: 403 });
console.log(
  'Real HTTP adapter contract passed: create, submit, independent review, correction, history and permission denials.',
);
