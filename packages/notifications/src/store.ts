import type { AuditRow, Notification, NotificationStatus } from "./types.js";

export interface NotificationStore {
  insert(n: Notification): Promise<Notification>;
  updateStatus(id: string, status: NotificationStatus, patch?: Partial<Notification>): Promise<Notification>;
  findByIdempotency(workspace_id: string, idempotency_key: string): Promise<Notification | null>;
  listUnreadInApp(user_id: string, limit: number): Promise<Notification[]>;
  listPending(limit: number, now: string): Promise<Notification[]>;
  insertAudit(row: AuditRow): Promise<AuditRow>;
}

export class InMemoryNotificationStore implements NotificationStore {
  private rows = new Map<string, Notification>();
  private idempotent = new Map<string, string>(); // wid:key → id
  public audits: AuditRow[] = [];

  async insert(n: Notification): Promise<Notification> {
    this.rows.set(n.id, n);
    const key = (n.payload._idempotency_key as string | undefined) ?? n.id;
    this.idempotent.set(`${n.workspace_id}:${key}:${n.channel}:${n.event_type}`, n.id);
    return n;
  }
  async updateStatus(id: string, status: NotificationStatus, patch: Partial<Notification> = {}): Promise<Notification> {
    const cur = this.rows.get(id);
    if (!cur) throw new Error("not found");
    const next = { ...cur, ...patch, status };
    this.rows.set(id, next);
    return next;
  }
  async findByIdempotency(workspace_id: string, idempotency_key: string): Promise<Notification | null> {
    for (const [k, id] of this.idempotent) {
      if (k.startsWith(`${workspace_id}:${idempotency_key}:`)) {
        return this.rows.get(id) ?? null;
      }
    }
    return null;
  }
  async listUnreadInApp(user_id: string, limit: number): Promise<Notification[]> {
    return [...this.rows.values()]
      .filter((n) => n.user_id === user_id && n.channel === "in_app" && !n.read_at)
      .slice(0, limit);
  }
  async listPending(limit: number, now: string): Promise<Notification[]> {
    const t = new Date(now).valueOf();
    return [...this.rows.values()]
      .filter((n) =>
        n.status === "queued" ||
        (n.status === "failed" && n.next_attempt_at && new Date(n.next_attempt_at).valueOf() <= t),
      )
      .slice(0, limit);
  }
  async insertAudit(row: AuditRow): Promise<AuditRow> {
    this.audits.push(row);
    return row;
  }
}
