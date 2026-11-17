import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetectionSession } from './src/session.js';

test('editing an input discards a late response even if the adapter ignores cancellation', async () => {
  let finish;
  const session = createDetectionSession(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = session.run('https://example.com/old.jpg');
  session.invalidate();
  finish({ source: 'synthetic fixture', boxes: [] });
  await pending;
  assert.equal(session.snapshot().result, null);
  assert.equal(session.snapshot().history.length, 0);
  assert.equal(session.snapshot().busy, false);
});

test('a late failure cannot overwrite a newer successful request', async () => {
  let rejectOld;
  const session = createDetectionSession((url) =>
    url.includes('old')
      ? new Promise((resolve, reject) => {
          rejectOld = reject;
        })
      : Promise.resolve({ source: 'synthetic fixture', boxes: [] }),
  );
  const old = session.run('https://example.com/old');
  await session.run('https://example.com/new', 'empty');
  rejectOld(new Error('stale failure'));
  await old;
  assert.equal(session.snapshot().error, '');
  assert.equal(session.snapshot().history.length, 1);
  assert.equal(session.snapshot().history[0].fixture, 'empty');
});

test('history is bounded, excludes URLs and clear removes all session results', async () => {
  const session = createDetectionSession();
  for (let i = 0; i < 7; i++) await session.run('https://example.com/private-path', 'pair');
  assert.equal(session.snapshot().history.length, 5);
  assert.equal(session.snapshot().result.boxes.length, 2);
  assert.equal(JSON.stringify(session.snapshot().history).includes('private-path'), false);
  session.clear();
  assert.equal(session.snapshot().history.length, 0);
  assert.equal(session.snapshot().result, null);
});

test('empty results are valid and unsupported fixtures report a useful error', async () => {
  const session = createDetectionSession();
  await session.run('https://example.com/image', 'empty');
  assert.deepEqual(session.snapshot().result.boxes, []);
  await session.run('https://example.com/image', 'unknown');
  assert.match(session.snapshot().error, /supported synthetic sample/);
  assert.equal(session.snapshot().history.length, 1);
});

test('clear cancels a pending run and prevents a late history entry', async () => {
  let finish;
  const session = createDetectionSession(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = session.run('https://example.com/image');
  session.clear();
  finish({ source: 'synthetic fixture', boxes: [] });
  await pending;
  assert.equal(session.snapshot().history.length, 0);
  assert.equal(session.snapshot().result, null);
});
