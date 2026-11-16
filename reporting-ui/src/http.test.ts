import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpClient } from './http.ts';
import type { Entry, Input } from './contracts.ts';
const entry: Entry = {
  id: 9,
  externalId: 'sample-9',
  department: 'Ops',
  occurredOn: '2026-01-01',
  amount: 10,
  status: 'valid',
  ownerId: 'sample-owner',
  workflowState: 'draft',
  version: 3,
};
const input: Input = {
  externalId: entry.externalId,
  department: entry.department,
  occurredOn: entry.occurredOn,
  amount: entry.amount,
  status: entry.status,
};
test('credentials stay in the authorization header and are not sent in request data', async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/records');
    assert.equal(
      (options!.headers as Record<string, string>).Authorization,
      'Bearer local-test-token',
    );
    assert.equal(options!.credentials, 'omit');
    assert.equal(options!.cache, 'no-store');
    const body = JSON.parse(options!.body as string);
    assert.deepEqual(body, input);
    assert.equal('token' in body, false);
    return Response.json(entry, { status: 201 });
  };
  assert.deepEqual(await new HttpClient(() => 'local-test-token', transport).create(input), entry);
  assert.equal(calls, 1);
});
test('no token means no network request', async () => {
  let calls = 0;
  const client = new HttpClient(
    () => '',
    async () => {
      calls++;
      return Response.json(entry);
    },
  );
  await assert.rejects(client.create(input), { status: 401 });
  assert.equal(calls, 0);
});
test('corrections send the expected version and no writable ownership fields', async () => {
  const client = new HttpClient(
    () => 'local-test-token',
    async (url, options) => {
      assert.equal(url, '/api/records/9/corrections');
      assert.deepEqual(JSON.parse(options!.body as string), {
        expectedVersion: 3,
        department: 'Ops',
        occurredOn: '2026-01-01',
        amount: 10,
        status: 'valid',
        reason: 'Corrected evidence',
      });
      return Response.json({ ...entry, version: 4 });
    },
  );
  await client.correct(entry, input, 'Corrected evidence');
});
test('409 is a recoverable conflict rather than a success', async () => {
  const client = new HttpClient(
    () => 'local-test-token',
    async () => Response.json({ error: 'Refresh the record' }, { status: 409 }),
  );
  await assert.rejects(client.submit(entry), { status: 409, message: 'Refresh the record' });
});
test('expired credentials and malformed API shapes surface distinct failures', async () => {
  await assert.rejects(
    new HttpClient(
      () => 'local-test-token',
      async () => Response.json({}, { status: 401 }),
    ).list(),
    { status: 401 },
  );
  await assert.rejects(
    new HttpClient(
      () => 'local-test-token',
      async () => Response.json({ id: 9 }),
    ).create(input),
    { status: 502 },
  );
  await assert.rejects(
    new HttpClient(
      () => 'local-test-token',
      async () => Response.json({ items: [], nextAfterId: 'bad' }),
    ).list(),
    { status: 502 },
  );
});
test('network errors and invalid JSON cannot silently become empty data', async () => {
  await assert.rejects(
    new HttpClient(
      () => 'local-test-token',
      async () => {
        throw new Error('offline');
      },
    ).list(),
    { status: 0 },
  );
  await assert.rejects(
    new HttpClient(
      () => 'local-test-token',
      async () => new Response('not json'),
    ).list(),
    { status: 502 },
  );
});
test('server errors do not expose diagnostic response details', async () => {
  const client = new HttpClient(
    () => 'local-test-token',
    async () => Response.json({ error: 'private diagnostic details' }, { status: 500 }),
  );
  await assert.rejects(client.list(), {
    status: 500,
    message: 'The request could not be completed.',
  });
});
