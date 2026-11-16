import { Problem } from './contracts.ts';
import type { Client, Input, Entry, Page, Audit, Totals } from './contracts.ts';

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Problem(502, 'The API returned an unexpected response.');
  return value as Record<string, unknown>;
}
function record(value: unknown): Entry {
  const row = object(value);
  if (
    !Number.isInteger(row.id) ||
    Number(row.id) < 1 ||
    !Number.isInteger(row.version) ||
    Number(row.version) < 1 ||
    typeof row.externalId !== 'string' ||
    typeof row.department !== 'string' ||
    typeof row.ownerId !== 'string' ||
    typeof row.occurredOn !== 'string' ||
    typeof row.amount !== 'number' ||
    !Number.isFinite(row.amount) ||
    !['valid', 'exception'].includes(String(row.status)) ||
    !['draft', 'submitted', 'approved', 'rejected'].includes(String(row.workflowState))
  )
    throw new Problem(502, 'The API returned an unexpected record.');
  return row as Entry;
}
function audit(value: unknown): Audit {
  const event = object(value);
  if (
    !Number.isInteger(event.id) ||
    typeof event.actorId !== 'string' ||
    typeof event.action !== 'string' ||
    typeof event.at !== 'string' ||
    Number.isNaN(Date.parse(event.at)) ||
    !(event.reason === null || typeof event.reason === 'string') ||
    !(event.before === null || typeof event.before === 'string') ||
    typeof event.after !== 'string'
  )
    throw new Problem(502, 'The API returned unexpected history.');
  return event as Audit;
}

export class HttpClient implements Client {
  token: () => string;
  transport: typeof fetch;
  constructor(token: () => string, transport: typeof fetch = fetch) {
    this.token = token;
    this.transport = transport;
  }

  async request(path: string, body?: unknown): Promise<unknown> {
    const token = this.token().trim();
    if (!token) throw new Problem(401, 'A local API access token is required.');
    let response: Response;
    try {
      response = await this.transport('/api/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Problem(0, 'Cannot reach the API. Check that the local service is running.');
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Problem(response.ok ? 502 : response.status, 'The API response could not be read.');
    }
    if (!response.ok) {
      const fallback =
        response.status === 409
          ? 'The record changed. Refresh it before retrying.'
          : response.status === 401
            ? 'The access token is missing, invalid or expired.'
            : response.status === 403
              ? 'This action is not permitted.'
              : 'The request could not be completed.';
      const detail =
        data !== null && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>).error
          : undefined;
      throw new Problem(
        response.status,
        response.status >= 500 ? fallback : typeof detail === 'string' ? detail : fallback,
      );
    }
    return data;
  }
  async list(after = 0): Promise<Page> {
    const page = object(await this.request('records?limit=20&afterId=' + after));
    if (
      !Array.isArray(page.items) ||
      (page.nextAfterId !== null &&
        (!Number.isInteger(page.nextAfterId) || Number(page.nextAfterId) < 1))
    )
      throw new Problem(502, 'The API returned an unexpected page.');
    return { items: page.items.map(record), nextAfterId: page.nextAfterId as number | null };
  }
  async create(input: Input) {
    return record(await this.request('records', input));
  }
  async submit(entry: Entry) {
    return record(
      await this.request(`records/${entry.id}/submit`, { expectedVersion: entry.version }),
    );
  }
  async review(entry: Entry, approve: boolean, reason: string) {
    return record(
      await this.request(`records/${entry.id}/review`, {
        expectedVersion: entry.version,
        approve,
        reason,
      }),
    );
  }
  async correct(entry: Entry, input: Input, reason: string) {
    const { externalId: _, ...changes } = input;
    return record(
      await this.request(`records/${entry.id}/corrections`, {
        expectedVersion: entry.version,
        ...changes,
        reason,
      }),
    );
  }
  async history(id: number): Promise<Audit[]> {
    const events = await this.request(`records/${id}/history`);
    if (!Array.isArray(events)) throw new Problem(502, 'The API returned unexpected history.');
    return events.map(audit);
  }
  async reports(): Promise<Totals[]> {
    const report = object(await this.request('reports'));
    if (!Array.isArray(report.rows)) throw new Problem(502, 'The API returned unexpected totals.');
    return report.rows.map((value) => {
      const row = object(value);
      if (
        typeof row.department !== 'string' ||
        typeof row.total !== 'number' ||
        !Number.isFinite(row.total) ||
        row.total < 0 ||
        !Number.isInteger(row.records) ||
        Number(row.records) < 0 ||
        !Number.isInteger(row.exceptions) ||
        Number(row.exceptions) < 0 ||
        Number(row.exceptions) > Number(row.records)
      )
        throw new Problem(502, 'The API returned unexpected totals.');
      return row as Totals;
    });
  }
}
