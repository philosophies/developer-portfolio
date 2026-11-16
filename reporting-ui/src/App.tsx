import { useState, useMemo, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Problem, validate, reasonRequired, decodeDisplayActor } from './contracts.ts';
import type { Actor, Audit, Client, Entry, Input, Totals } from './contracts.ts';
import { HttpClient } from './http.ts';
import { FixtureClient, fixtureStore } from './fixture.ts';
import { RecordQueue, RecordForm, RecordDetail, Summary } from './components.tsx';

const simulation = import.meta.env.MODE === 'portfolio';
const blankRecord: Input = {
  externalId: '',
  department: 'Operations',
  occurredOn: '2026-01-10',
  amount: 0,
  status: 'valid',
};
const portfolio = 'https://cody-developer-portfolio.jones-cody.workers.dev/';

export default function App() {
  const [store] = useState(fixtureStore);
  const [persona, setPersona] = useState('operator');
  const [token, setToken] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const actor: Actor = simulation
    ? {
        subject: persona === 'operator' ? 'demo-owner' : 'demo-reviewer',
        role: persona === 'operator' ? 'operator' : 'reviewer',
      }
    : (decodeDisplayActor(token) ?? { subject: 'not connected', role: 'operator' });
  const client: Client = useMemo(
    () =>
      simulation
        ? new FixtureClient(store, {
            subject: persona === 'operator' ? 'demo-owner' : 'demo-reviewer',
            role: persona === 'operator' ? 'operator' : 'reviewer',
          })
        : new HttpClient(() => tokenRef.current),
    [store, persona, token],
  );
  const connected = simulation || Boolean(token);
  const [records, setRecords] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Audit[]>([]);
  const [input, setInput] = useState<Input>(blankRecord);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selectionGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    selectionGeneration.current++;
    setSelected(null);
    setHistory([]);
    setCreating(false);
    setEditing(false);
    setError('');
    setMessage('');
    if (!connected) {
      setRecords([]);
      setTotals([]);
      setCursor(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    Promise.all([client.list(), client.reports()])
      .then(([page, report]) => {
        if (active) {
          setRecords(page.items);
          setCursor(page.nextAfterId);
          setTotals(report);
        }
      })
      .catch((issue) => {
        if (active) setError(issue.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      selectionGeneration.current++;
    };
  }, [client, connected]);

  async function refresh() {
    const [page, report] = await Promise.all([client.list(), client.reports()]);
    setRecords(page.items);
    setCursor(page.nextAfterId);
    setTotals(report);
    return page;
  }
  async function choose(entry: Entry) {
    setSelected(entry);
    setEditing(false);
    setCreating(false);
    setReason('');
    setHistory([]);
    setError('');
    const generation = ++selectionGeneration.current;
    try {
      const events = await client.history(entry.id);
      if (generation === selectionGeneration.current) setHistory(events);
    } catch (issue) {
      if (generation === selectionGeneration.current) setError((issue as Error).message);
    }
  }
  async function mutate(action: () => Promise<Entry>, success: string) {
    selectionGeneration.current++;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await action();
      setSelected(result);
      setCreating(false);
      setEditing(false);
      setReason('');
      await refresh();
      setHistory(await client.history(result.id));
      setMessage(success);
    } catch (issue) {
      const problem = issue as Problem;
      setError(problem.message);
      if (problem.status === 409) {
        try {
          const page = await refresh();
          const fresh = page.items.find((row) => row.id === selected?.id);
          if (fresh) {
            setSelected(fresh);
            setHistory(await client.history(fresh.id));
          }
        } catch {
          setError('The record changed, but refresh failed. Check the connection before retrying.');
        }
      }
    } finally {
      setBusy(false);
    }
  }
  function beginCreate() {
    selectionGeneration.current++;
    setSelected(null);
    setHistory([]);
    setInput({ ...blankRecord });
    setAmount('');
    setCreating(true);
    setEditing(false);
    setError('');
    setMessage('');
  }
  function beginCorrection() {
    if (!selected) return;
    setInput({
      externalId: selected.externalId,
      department: selected.department,
      occurredOn: selected.occurredOn,
      amount: selected.amount,
      status: selected.status,
    });
    setAmount(selected.amount.toFixed(2));
    setReason('');
    setEditing(true);
    setCreating(false);
    setError('');
  }
  function save(event: FormEvent) {
    event.preventDefault();
    let payload: Input;
    try {
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount))
        throw new Problem(400, 'Use a non-negative amount with at most two decimal places.');
      payload = { ...input, amount: Number(amount) };
      validate(payload);
      if (editing) reasonRequired(reason);
    } catch (issue) {
      setError((issue as Error).message);
      return;
    }
    if (editing && selected)
      void mutate(
        () => client.correct(selected, payload, reason),
        'Correction saved as a draft. Another review is required.',
      );
    else
      void mutate(
        () => client.create(payload),
        'Draft created. Submit it when it is ready for review.',
      );
  }
  async function loadMore() {
    if (cursor === null) return;
    setBusy(true);
    setError('');
    try {
      const page = await client.list(cursor);
      setRecords((current) => [
        ...new Map([...current, ...page.items].map((row) => [row.id, row])).values(),
      ]);
      setCursor(page.nextAfterId);
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resetSample() {
    selectionGeneration.current++;
    setBusy(true);
    setError('');
    setSelected(null);
    setHistory([]);
    setCreating(false);
    setEditing(false);
    try {
      (client as FixtureClient).reset();
      await refresh();
      setMessage('Sample restored. Nothing was saved outside this tab.');
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <a href={portfolio}>
          ← Cody Jones <span>/ internal tools</span>
        </a>
        <span className="header-caption">RECORDS · REVIEW · RELEASE</span>
      </header>
      <div className="heading">
        <div>
          <p className="eyebrow">A SECOND SET OF EYES</p>
          <h1>Reporting workbench.</h1>
          <p>Good records. Clear decisions. A history you can follow.</p>
        </div>
        <span className="mode">{simulation ? 'SAMPLE MODE' : 'LOCAL API CLIENT'}</span>
      </div>
      <aside className="notice">
        <strong>{simulation ? 'Try the whole workflow.' : 'Connected to your own service.'}</strong>
        <p>
          {simulation
            ? 'Use the fictional operator and reviewer to create, approve and correct records. This runs on synthetic data in your browser; no backend or identity provider is connected.'
            : 'This client uses the local /api service through the development proxy. Tokens stay in memory, and the server checks every permission.'}
        </p>
      </aside>
      <section className="connection" aria-label="Connection and identity">
        {simulation ? (
          <>
            <label>
              Demo persona
              <select
                value={persona}
                disabled={busy}
                onChange={(event) => setPersona(event.target.value)}
              >
                <option value="operator">Operator · demo-owner</option>
                <option value="reviewer">Independent reviewer · demo-reviewer</option>
              </select>
            </label>
            <button className="secondary" disabled={busy} onClick={() => void resetSample()}>
              Reset sample
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setToken(tokenDraft.trim());
              setTokenDraft('');
            }}
          >
            <label>
              Local API access token
              <input
                type="password"
                value={tokenDraft}
                disabled={busy}
                onChange={(event) => setTokenDraft(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <button disabled={busy}>Connect</button>
            {token && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setToken('');
                  setTokenDraft('');
                }}
              >
                Disconnect
              </button>
            )}
          </form>
        )}
        <div className="identity">
          <span>Viewing as</span>
          <strong>{actor.subject}</strong>
          <small>
            {actor.role}
            {!simulation && ' · display only; server permissions apply'}
          </small>
        </div>
      </section>
      <div role="alert" className={error ? 'feedback error' : 'feedback'}>
        {error}
      </div>
      <div role="status" className="feedback success">
        {message}
        {busy ? ' Working…' : ''}
      </div>
      <Summary totals={totals} records={records} />
      <div className="workspace">
        <RecordQueue
          records={records}
          selectedId={selected?.id}
          busy={busy}
          connected={connected}
          cursor={cursor}
          onCreate={beginCreate}
          onChoose={(entry) => void choose(entry)}
          onMore={() => void loadMore()}
        />
        <section className="panel detail">
          <p className="eyebrow">02 / RECORD INSPECTOR</p>
          <h2>
            {creating
              ? 'Create a draft'
              : editing
                ? 'Make a correction'
                : selected
                  ? 'The details'
                  : 'One record at a time.'}
          </h2>
          {creating || editing ? (
            <RecordForm
              input={input}
              amount={amount}
              reason={reason}
              correction={editing}
              busy={busy}
              onInput={setInput}
              onAmount={setAmount}
              onReason={setReason}
              onSave={save}
              onCancel={() => {
                setCreating(false);
                setEditing(false);
              }}
            />
          ) : selected ? (
            <RecordDetail
              entry={selected}
              actor={actor}
              history={history}
              reason={reason}
              busy={busy}
              onReason={setReason}
              onSubmit={() =>
                void mutate(() => client.submit(selected), 'Submitted for independent review.')
              }
              onCorrect={beginCorrection}
              onReview={(approve) =>
                void mutate(
                  () => client.review(selected, approve, reason),
                  approve
                    ? 'Approved. The report totals are up to date.'
                    : 'Rejected. The owner can correct and resubmit.',
                )
              }
            />
          ) : (
            <div className="empty-state">
              <p>Open a record from the queue, or start with a new draft.</p>
              <p className="muted">
                {simulation
                  ? 'A good first move: open sample-002, then switch to the independent reviewer.'
                  : 'The source README explains local token setup and the API workflow.'}
              </p>
            </div>
          )}
        </section>
      </div>
      <footer>
        <p>
          {simulation
            ? 'Synthetic records. Browser memory only. Reload or reset to start again.'
            : 'Use development tokens only in your trusted local environment. The public sample never asks for credentials.'}
        </p>
        <a href="https://github.com/philosophies/developer-portfolio/tree/main/reporting-ui">
          Source &amp; setup ↗
        </a>
      </footer>
    </main>
  );
}
