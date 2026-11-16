import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureClient, fixtureStore } from './fixture.ts';
import { permissions, validate, decodeDisplayActor } from './contracts.ts';
import type { Input } from './contracts.ts';
const input: Input = {
  externalId: 'new-record',
  department: 'Operations',
  occurredOn: '2026-01-10',
  amount: 12.5,
  status: 'valid',
};
function people() {
  const store = fixtureStore();
  return {
    owner: new FixtureClient(store, { subject: 'demo-owner', role: 'operator' }),
    reviewer: new FixtureClient(store, { subject: 'demo-reviewer', role: 'reviewer' }),
  };
}
test('create, submit, independently approve, correct and inspect history', async () => {
  const { owner, reviewer } = people();
  let record = await owner.create(input);
  record = await owner.submit(record);
  record = await reviewer.review(record, true, 'Checked sample evidence');
  assert.equal(record.workflowState, 'approved');
  assert.equal((await owner.reports()).find((r) => r.department === 'Operations')?.total, 12.5);
  record = await owner.correct(record, { ...input, amount: 15 }, 'Fixed the source amount');
  assert.equal(record.workflowState, 'draft');
  assert.equal(
    (await owner.reports()).find((r) => r.department === 'Operations'),
    undefined,
  );
  const history = await owner.history(record.id);
  assert.deepEqual(
    history.map((e) => e.action),
    ['create', 'submit', 'approve', 'correct'],
  );
  assert.equal(JSON.parse(history[3].before!).amount, 12.5);
  assert.equal(JSON.parse(history[3].after).amount, 15);
});
test('a reviewer cannot approve their own submission', async () => {
  const { reviewer } = people();
  let r = await reviewer.create(input);
  r = await reviewer.submit(r);
  assert.equal(permissions(r, reviewer.actor).review, false);
  await assert.rejects(reviewer.review(r, true, 'Self approval attempt'), { status: 403 });
});
test('an operator cannot approve or see another owner’s record', async () => {
  const { owner, reviewer } = people();
  let r = await reviewer.create(input);
  r = await reviewer.submit(r);
  await assert.rejects(owner.history(r.id), { status: 404 });
  const own = (await owner.list()).items[1];
  await assert.rejects(owner.review(own, true, 'Not a reviewer'), { status: 403 });
});
test('stale copies cannot change a new version or add an event', async () => {
  const { owner } = people();
  const r = await owner.create(input);
  await owner.submit(r);
  await assert.rejects(owner.submit(r), { status: 409 });
  assert.equal((await owner.history(r.id)).length, 2);
  const approved = (await owner.list()).items.find((record) => record.id === 3)!;
  await assert.rejects(owner.submit(approved), { status: 409 });
});
test('rejection and correction require reasons', async () => {
  const { owner, reviewer } = people();
  let r = await owner.create(input);
  r = await owner.submit(r);
  await assert.rejects(reviewer.review(r, false, 'x'), { status: 400 });
  r = await reviewer.review(r, false, 'Needs verification');
  assert.equal(r.workflowState, 'rejected');
  await assert.rejects(owner.correct(r, input, ''), { status: 400 });
});
test('pagination remains stable and stops at the last page', async () => {
  const { owner } = people();
  for (let n = 0; n < 22; n++) await owner.create({ ...input, externalId: 'entry-' + n });
  const first = await owner.list();
  const second = await owner.list(first.nextAfterId!);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 5);
  assert.equal(second.nextAfterId, null);
  assert.equal(new Set([...first.items, ...second.items].map((r) => r.id)).size, 25);
});
test('reset removes only simulation changes and restores the sample', async () => {
  const { owner } = people();
  await owner.create(input);
  owner.reset();
  assert.equal((await owner.list()).items.length, 3);
  assert.equal((await owner.history(1)).length, 0);
});
test('invalid precision, dates and amounts are rejected', () => {
  for (const candidate of [
    { ...input, amount: 1.001 },
    { ...input, amount: -1 },
    { ...input, occurredOn: '2026-02-30' },
    { ...input, amount: NaN },
    { ...input, department: ' ' },
  ])
    assert.throws(() => validate(candidate), { status: 400 });
});
test('display claims are optional and do not provide token verification', () => {
  assert.equal(decodeDisplayActor('bad'), null);
  const token =
    'header.' +
    btoa(JSON.stringify({ sub: 'sample-person', role: ['operator', 'reviewer'] })) +
    '.unverified';
  assert.deepEqual(decodeDisplayActor(token), { subject: 'sample-person', role: 'reviewer' });
  const unicode = btoa(
    String.fromCharCode(
      ...new TextEncoder().encode(JSON.stringify({ sub: 'opérateur', role: 'operator' })),
    ),
  );
  assert.deepEqual(decodeDisplayActor('header.' + unicode + '.unverified'), {
    subject: 'opérateur',
    role: 'operator',
  });
});
