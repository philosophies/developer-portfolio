import type { Actor, Audit, Entry, Input, Totals } from './contracts.ts';
import { permissions } from './contracts.ts';
import type { FormEvent } from 'react';

export const formatAmount = (amount: number) =>
  amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Feedback({
  error,
  message,
  busy,
}: {
  error: string;
  message: string;
  busy: boolean;
}) {
  return (
    <>
      <div role="alert" className={error ? 'feedback error' : 'feedback'}>
        {error}
      </div>
      <div role="status" className="feedback success">
        {message}
        {busy ? ' Working…' : ''}
      </div>
    </>
  );
}

export function Summary({ totals, records }: { totals: Totals[]; records: Entry[] }) {
  return (
    <section className="metrics" aria-label="Report summary">
      <div>
        <span>Approved amount</span>
        <strong>{formatAmount(totals.reduce((sum, row) => sum + row.total, 0))}</strong>
        <small>Only reviewed records count</small>
      </div>
      <div>
        <span>Records loaded</span>
        <strong>{records.length}</strong>
        <small>Visible to this person</small>
      </div>
      <div>
        <span>Awaiting review</span>
        <strong>{records.filter((row) => row.workflowState === 'submitted').length}</strong>
        <small>Within the loaded page</small>
      </div>
    </section>
  );
}

type QueueProps = {
  records: Entry[];
  selectedId?: number;
  busy: boolean;
  connected: boolean;
  cursor: number | null;
  onCreate: () => void;
  onChoose: (entry: Entry) => void;
  onMore: () => void;
};
export function RecordQueue({
  records,
  selectedId,
  busy,
  connected,
  cursor,
  onCreate,
  onChoose,
  onMore,
}: QueueProps) {
  return (
    <section className="panel queue">
      <div className="panel-head">
        <div>
          <p className="eyebrow">01 / WORK QUEUE</p>
          <h2>Records</h2>
        </div>
        <button disabled={busy || !connected} onClick={onCreate}>
          + New draft
        </button>
      </div>
      <p className="muted">
        Open a record to review its details. Corrections go back through approval.
      </p>
      <div className="table-wrap">
        <table>
          <caption>Records visible to the current person</caption>
          <thead>
            <tr>
              <th>Record / owner</th>
              <th>Department</th>
              <th>Amount</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id} className={selectedId === row.id ? 'selected' : ''}>
                <td>
                  <button
                    className="record-link"
                    disabled={busy}
                    aria-pressed={selectedId === row.id}
                    onClick={() => onChoose(row)}
                  >
                    {row.externalId}
                  </button>
                  <small>
                    v{row.version} · {row.ownerId}
                  </small>
                </td>
                <td>{row.department}</td>
                <td className="numeric">{formatAmount(row.amount)}</td>
                <td>
                  <span className={'badge ' + row.workflowState}>{row.workflowState}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!records.length && (
        <div className="empty-state">
          <h3>{connected ? 'Nothing in the queue.' : 'Connect to your local API.'}</h3>
          <p>
            {connected
              ? 'Create a draft to start the workflow.'
              : 'Use a development access token from the setup guide. Tokens stay in this tab’s memory.'}
          </p>
        </div>
      )}
      {cursor !== null && (
        <button className="secondary more" disabled={busy} onClick={onMore}>
          Load more records
        </button>
      )}
    </section>
  );
}

type FormProps = {
  input: Input;
  amount: string;
  reason: string;
  correction: boolean;
  busy: boolean;
  onInput: (input: Input) => void;
  onAmount: (amount: string) => void;
  onReason: (reason: string) => void;
  onSave: (event: FormEvent) => void;
  onCancel: () => void;
};
export function RecordForm({
  input,
  amount,
  reason,
  correction,
  busy,
  onInput,
  onAmount,
  onReason,
  onSave,
  onCancel,
}: FormProps) {
  return (
    <form onSubmit={onSave}>
      <fieldset disabled={busy}>
        <label>
          External ID
          <input
            value={input.externalId}
            autoFocus={!correction}
            readOnly={correction}
            maxLength={100}
            required
            placeholder="e.g. ops-004"
            onChange={(e) => onInput({ ...input, externalId: e.target.value })}
          />
        </label>
        <label>
          Department
          <input
            value={input.department}
            autoFocus={correction}
            maxLength={80}
            required
            onChange={(e) => onInput({ ...input, department: e.target.value })}
          />
        </label>
        <div className="form-pair">
          <label>
            Occurred on
            <input
              type="date"
              value={input.occurredOn}
              min="1900-01-01"
              max="2100-12-31"
              required
              onChange={(e) => onInput({ ...input, occurredOn: e.target.value })}
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              value={amount}
              required
              placeholder="0.00"
              onChange={(e) => onAmount(e.target.value)}
            />
          </label>
        </div>
        <label>
          Business status
          <select
            value={input.status}
            onChange={(e) => onInput({ ...input, status: e.target.value as Input['status'] })}
          >
            <option value="valid">Valid</option>
            <option value="exception">Exception</option>
          </select>
        </label>
        {correction && (
          <label>
            Correction reason
            <textarea
              value={reason}
              minLength={3}
              maxLength={500}
              required
              placeholder="What changed, and why?"
              onChange={(e) => onReason(e.target.value)}
            />
          </label>
        )}
        <p className="form-hint">
          {correction
            ? 'Saving a correction returns this record to draft.'
            : 'New records start as drafts; they do not enter approved totals.'}
        </p>
        <div className="actions">
          <button>{correction ? 'Save correction' : 'Create draft'}</button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function snapshot(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return 'Snapshot could not be read.';
  }
}
function AuditHistory({ events, loading }: { events: Audit[]; loading: boolean }) {
  return (
    <section className="audit">
      <h3>Audit history</h3>
      {loading ? (
        <p className="muted">Loading history…</p>
      ) : events.length === 0 ? (
        <p className="muted">
          No events recorded here. Baseline sample states do not invent historical approvals.
        </p>
      ) : (
        <ol className="history">
          {events.map((event) => (
            <li key={event.id}>
              <div className="event-heading">
                <strong>{event.action}</strong>
                <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
              </div>
              <span>{event.actorId}</span>
              {event.reason && <p>{event.reason}</p>}
              <details>
                <summary>Inspect recorded snapshots</summary>
                <pre>
                  {JSON.stringify(
                    { before: snapshot(event.before), after: snapshot(event.after) },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type DetailProps = {
  entry: Entry;
  actor: Actor;
  history: Audit[];
  historyLoading: boolean;
  reason: string;
  busy: boolean;
  onReason: (reason: string) => void;
  onSubmit: () => void;
  onCorrect: () => void;
  onReview: (approve: boolean) => void;
};
export function RecordDetail({
  entry,
  actor,
  history,
  historyLoading,
  reason,
  busy,
  onReason,
  onSubmit,
  onCorrect,
  onReview,
}: DetailProps) {
  const allowed = permissions(entry, actor);
  return (
    <>
      <dl>
        <div>
          <dt>External ID</dt>
          <dd>{entry.externalId}</dd>
        </div>
        <div>
          <dt>Workflow</dt>
          <dd>
            <span className={'badge ' + entry.workflowState}>{entry.workflowState}</span>
            <small>Version {entry.version}</small>
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{entry.ownerId}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="amount">{formatAmount(entry.amount)}</dd>
        </div>
        <div>
          <dt>Occurred</dt>
          <dd>{entry.occurredOn}</dd>
        </div>
      </dl>
      <div className="actions">
        {allowed.submit && (
          <button disabled={busy} onClick={onSubmit}>
            Submit for review
          </button>
        )}
        {allowed.correct && (
          <button disabled={busy} className="secondary" onClick={onCorrect}>
            Correct record
          </button>
        )}
      </div>
      {allowed.review && (
        <section className="review-box">
          <h3>Independent review</h3>
          <label>
            Review reason
            <textarea
              value={reason}
              minLength={3}
              maxLength={500}
              disabled={busy}
              placeholder="What did you verify?"
              onChange={(e) => onReason(e.target.value)}
            />
          </label>
          <div className="actions">
            <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(true)}>
              Approve record
            </button>
            <button
              className="secondary"
              disabled={busy || reason.trim().length < 3}
              onClick={() => onReview(false)}
            >
              Reject record
            </button>
          </div>
        </section>
      )}
      {entry.workflowState === 'submitted' && entry.ownerId === actor.subject && (
        <p className="form-hint">
          Waiting for another person to review. You cannot approve your own submission.
        </p>
      )}
      <AuditHistory events={history} loading={historyLoading} />
    </>
  );
}
