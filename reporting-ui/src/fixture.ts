import { Problem, validate, reasonRequired } from './contracts.ts';
import type { Actor, Audit, Client, Entry, Input, Totals } from './contracts.ts';
type Store = { records: Entry[]; events: Audit[]; nextId: number };
const seeds = (): Entry[] => [
  {
    id: 1,
    externalId: 'sample-001',
    department: 'Operations',
    occurredOn: '2026-01-10',
    amount: 125.5,
    status: 'valid',
    ownerId: 'demo-owner',
    workflowState: 'draft',
    version: 1,
  },
  {
    id: 2,
    externalId: 'sample-002',
    department: 'Operations',
    occurredOn: '2026-01-11',
    amount: 40,
    status: 'exception',
    ownerId: 'demo-owner',
    workflowState: 'submitted',
    version: 2,
  },
  {
    id: 3,
    externalId: 'sample-003',
    department: 'Finance',
    occurredOn: '2026-02-01',
    amount: 210.25,
    status: 'valid',
    ownerId: 'demo-owner',
    workflowState: 'approved',
    version: 3,
  },
];
export function fixtureStore(): Store {
  return { records: seeds(), events: [], nextId: 4 };
}
export class FixtureClient implements Client {
  store: Store;
  actor: Actor;
  constructor(store: Store, actor: Actor) {
    this.store = store;
    this.actor = actor;
  }
  visible() {
    return this.store.records.filter(
      (r) => this.actor.role === 'reviewer' || r.ownerId === this.actor.subject,
    );
  }
  find(id: number) {
    const r = this.visible().find((r) => r.id === id);
    if (!r) throw new Problem(404, 'Record not found.');
    return r;
  }
  async list(after = 0) {
    const rows = this.visible()
      .filter((r) => r.id > after)
      .sort((a, b) => a.id - b.id);
    return {
      items: structuredClone(rows.slice(0, 20)),
      nextAfterId: rows.length > 20 ? rows[19].id : null,
    };
  }
  async create(input: Input) {
    validate(input);
    if (this.store.records.some((r) => r.externalId === input.externalId.trim()))
      throw new Problem(409, 'External ID already exists.');
    const r: Entry = {
      ...input,
      externalId: input.externalId.trim(),
      department: input.department.trim(),
      id: this.store.nextId++,
      ownerId: this.actor.subject,
      workflowState: 'draft',
      version: 1,
    };
    this.store.records.push(r);
    this.append('create', null, null, r);
    return structuredClone(r);
  }
  change(
    entry: Entry,
    action: 'submit' | 'approve' | 'reject' | 'correct',
    reason: string | null = null,
    input?: Input,
  ) {
    const current = this.find(entry.id);
    if (entry.version !== current.version)
      throw new Problem(409, 'The record changed. Refresh before retrying.');
    const owner = current.ownerId === this.actor.subject;
    if (
      (['submit', 'correct'].includes(action) && !owner) ||
      (['approve', 'reject'].includes(action) && (this.actor.role !== 'reviewer' || owner))
    )
      throw new Problem(403, 'This person cannot perform that action.');
    if (
      (action === 'submit' && current.workflowState !== 'draft') ||
      (action === 'correct' && current.workflowState === 'submitted') ||
      (['approve', 'reject'].includes(action) && current.workflowState !== 'submitted')
    )
      throw new Problem(409, 'That transition is not available in the current state.');
    if (action !== 'submit') reasonRequired(reason ?? '');
    if (input) validate(input);
    const before = structuredClone(current);
    Object.assign(
      current,
      ...(input
        ? [
            {
              department: input.department.trim(),
              occurredOn: input.occurredOn,
              amount: input.amount,
              status: input.status,
            },
          ]
        : []),
      {
        workflowState:
          action === 'submit'
            ? 'submitted'
            : action === 'approve'
              ? 'approved'
              : action === 'reject'
                ? 'rejected'
                : 'draft',
        version: current.version + 1,
      },
    );
    this.append(action, reason, before, current);
    return structuredClone(current);
  }
  async submit(entry: Entry) {
    return this.change(entry, 'submit');
  }
  async review(entry: Entry, approve: boolean, reason: string) {
    return this.change(entry, approve ? 'approve' : 'reject', reason);
  }
  async correct(entry: Entry, input: Input, reason: string) {
    return this.change(entry, 'correct', reason, input);
  }
  append(action: string, reason: string | null, before: Entry | null, after: Entry) {
    this.store.events.push({
      id: this.store.events.length + 1,
      actorId: this.actor.subject,
      action,
      reason,
      before: before ? JSON.stringify(before) : null,
      after: JSON.stringify(after),
      at: new Date().toISOString(),
    });
  }
  async history(id: number) {
    this.find(id);
    return structuredClone(
      this.store.events.filter((e) => (JSON.parse(e.after) as Entry).id === id),
    );
  }
  async reports(): Promise<Totals[]> {
    const groups = new Map<string, Totals>();
    for (const r of this.visible().filter((r) => r.workflowState === 'approved')) {
      const g = groups.get(r.department) ?? {
        department: r.department,
        records: 0,
        total: 0,
        exceptions: 0,
      };
      g.records++;
      g.total = Math.round((g.total + r.amount) * 100) / 100;
      g.exceptions += r.status === 'exception' ? 1 : 0;
      groups.set(r.department, g);
    }
    return [...groups.values()].sort((a, b) => a.department.localeCompare(b.department));
  }
  reset() {
    this.store.records = seeds();
    this.store.events = [];
    this.store.nextId = 4;
  }
}
