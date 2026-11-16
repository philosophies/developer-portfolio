export type State = 'draft' | 'submitted' | 'approved' | 'rejected';
export type Actor = { subject: string; role: 'operator' | 'reviewer' };
export type Entry = {
  id: number;
  externalId: string;
  department: string;
  occurredOn: string;
  amount: number;
  status: 'valid' | 'exception';
  ownerId: string;
  workflowState: State;
  version: number;
};
export type Input = Pick<Entry, 'externalId' | 'department' | 'occurredOn' | 'amount' | 'status'>;
export type Audit = {
  id: number;
  actorId: string;
  action: string;
  reason: string | null;
  before: string | null;
  after: string;
  at: string;
};
export type Totals = { department: string; records: number; total: number; exceptions: number };
export type Page = { items: Entry[]; nextAfterId: number | null };
export interface Client {
  list(after?: number): Promise<Page>;
  create(input: Input): Promise<Entry>;
  submit(entry: Entry): Promise<Entry>;
  review(entry: Entry, approve: boolean, reason: string): Promise<Entry>;
  correct(entry: Entry, input: Input, reason: string): Promise<Entry>;
  history(id: number): Promise<Audit[]>;
  reports(): Promise<Totals[]>;
}
export class Problem extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function permissions(entry: Entry, actor: Actor) {
  const owner = entry.ownerId === actor.subject;
  return {
    submit: owner && entry.workflowState === 'draft',
    correct: owner && entry.workflowState !== 'submitted',
    review: actor.role === 'reviewer' && !owner && entry.workflowState === 'submitted',
  };
}
export function validate(input: Input) {
  if (
    !input.externalId.trim() ||
    input.externalId.length > 100 ||
    !input.department.trim() ||
    input.department.trim().length > 80 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ||
    !Number.isFinite(input.amount) ||
    input.amount < 0 ||
    input.amount > 9999999999.99 ||
    Number(input.amount.toFixed(2)) !== input.amount ||
    !['valid', 'exception'].includes(input.status)
  )
    throw new Problem(
      400,
      'Check the record fields and use a non-negative amount with at most two decimal places.',
    );
  const date = new Date(input.occurredOn + 'T00:00:00Z');
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== input.occurredOn ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2100
  )
    throw new Problem(400, 'Use a real date between 1900 and 2100.');
}
export function reasonRequired(reason: string) {
  if (reason.trim().length < 3 || reason.length > 500)
    throw new Problem(400, 'Provide a reason with 3–500 characters.');
}
export function decodeDisplayActor(token: string): Actor | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const bytes = Uint8Array.from(
      atob(part.replaceAll('-', '+').replaceAll('_', '/')),
      (character) => character.charCodeAt(0),
    );
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof raw.sub !== 'string') return null;
    const roles = Array.isArray(raw.role) ? raw.role : [raw.role];
    return { subject: raw.sub, role: roles.includes('reviewer') ? 'reviewer' : 'operator' };
  } catch {
    return null;
  }
}
// Display-only claims never authorize requests. The server verifies every access token.
