import type { Call } from "./types.js";

export interface CallStore {
  insert(c: Call): Promise<Call>;
  get(id: string): Promise<Call | null>;
  updateState(id: string, state: Call["state"], patch?: Partial<Call>): Promise<Call>;
  markOutcome(id: string, outcome: Call["outcome"], patch?: Partial<Call>): Promise<Call>;
  listByLead(lead_id: string): Promise<Call[]>;
}

export class InMemoryCallStore implements CallStore {
  private rows = new Map<string, Call>();
  async insert(c: Call): Promise<Call> {
    this.rows.set(c.id, c);
    return c;
  }
  async get(id: string): Promise<Call | null> {
    return this.rows.get(id) ?? null;
  }
  async updateState(id: string, state: Call["state"], patch: Partial<Call> = {}): Promise<Call> {
    const cur = this.rows.get(id);
    if (!cur) throw new Error("call not found");
    const next = { ...cur, ...patch, state };
    this.rows.set(id, next);
    return next;
  }
  async markOutcome(id: string, outcome: Call["outcome"], patch: Partial<Call> = {}): Promise<Call> {
    const cur = this.rows.get(id);
    if (!cur) throw new Error("call not found");
    const next = { ...cur, ...patch, outcome };
    this.rows.set(id, next);
    return next;
  }
  async listByLead(lead_id: string): Promise<Call[]> {
    return [...this.rows.values()].filter((c) => c.lead_id === lead_id);
  }
}
