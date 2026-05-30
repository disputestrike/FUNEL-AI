import type {
  Comment,
  Game,
  GameEntry,
  Hub,
  Match,
  Mentor,
  Post,
  Reaction,
  XpRecord,
} from "./types.js";

export interface CommunityStore {
  /* Hubs */
  upsertHub(h: Hub): Promise<Hub>;
  listHubs(): Promise<Hub[]>;
  getHubBySlug(slug: string): Promise<Hub | null>;

  /* Posts + comments + reactions */
  insertPost(p: Post): Promise<Post>;
  listPostsInHub(hub_id: string, limit: number): Promise<Post[]>;
  getPost(post_id: string): Promise<Post | null>;
  insertComment(c: Comment): Promise<Comment>;
  listComments(post_id: string): Promise<Comment[]>;
  insertReaction(r: Reaction): Promise<Reaction>;

  /* XP */
  insertXp(x: XpRecord): Promise<XpRecord>;
  listXpForUser(user_id: string): Promise<XpRecord[]>;
  /** Sum within a window — used by anti-farming. */
  sumXpForUserInWindow(user_id: string, sinceIso: string, sources: string[]): Promise<number>;
  /** Total XP per user, used for level lookup. */
  totalXpForUser(user_id: string): Promise<number>;

  /* Mentor + match */
  upsertMentor(m: Mentor): Promise<Mentor>;
  getMentor(user_id: string): Promise<Mentor | null>;
  listAvailableMentors(args: { industry?: string | null; country?: string | null }): Promise<Mentor[]>;
  insertMatch(m: Match): Promise<Match>;
  endMatch(id: string, ended_by: Match["ended_by"], at: string): Promise<Match>;
  getActiveMatchForMentee(mentee_user_id: string): Promise<Match | null>;

  /* Games */
  insertGame(g: Game): Promise<Game>;
  getActiveGame(): Promise<Game | null>;
  insertGameEntry(e: GameEntry): Promise<GameEntry>;
  listGameEntries(game_id: string): Promise<GameEntry[]>;
}

export class InMemoryCommunityStore implements CommunityStore {
  private hubs = new Map<string, Hub>();
  private posts = new Map<string, Post>();
  private comments = new Map<string, Comment>();
  private reactions = new Map<string, Reaction>();
  private xp = new Map<string, XpRecord>();
  private mentors = new Map<string, Mentor>();
  private matches = new Map<string, Match>();
  private games = new Map<string, Game>();
  private gameEntries = new Map<string, GameEntry>();

  async upsertHub(h: Hub): Promise<Hub> {
    this.hubs.set(h.id, h);
    return h;
  }
  async listHubs(): Promise<Hub[]> {
    return [...this.hubs.values()];
  }
  async getHubBySlug(slug: string): Promise<Hub | null> {
    for (const h of this.hubs.values()) if (h.slug === slug) return h;
    return null;
  }

  async insertPost(p: Post): Promise<Post> {
    this.posts.set(p.id, p);
    return p;
  }
  async listPostsInHub(hub_id: string, limit: number): Promise<Post[]> {
    return [...this.posts.values()]
      .filter((p) => p.hub_id === hub_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async getPost(post_id: string): Promise<Post | null> {
    return this.posts.get(post_id) ?? null;
  }
  async insertComment(c: Comment): Promise<Comment> {
    this.comments.set(c.id, c);
    const p = this.posts.get(c.post_id);
    if (p) this.posts.set(p.id, { ...p, comments: p.comments + 1 });
    return c;
  }
  async listComments(post_id: string): Promise<Comment[]> {
    return [...this.comments.values()].filter((c) => c.post_id === post_id);
  }
  async insertReaction(r: Reaction): Promise<Reaction> {
    this.reactions.set(r.id, r);
    if (r.post_id) {
      const p = this.posts.get(r.post_id);
      if (p) this.posts.set(p.id, { ...p, reactions: p.reactions + 1 });
    }
    return r;
  }

  async insertXp(x: XpRecord): Promise<XpRecord> {
    this.xp.set(x.id, x);
    return x;
  }
  async listXpForUser(user_id: string): Promise<XpRecord[]> {
    return [...this.xp.values()].filter((r) => r.user_id === user_id);
  }
  async sumXpForUserInWindow(user_id: string, sinceIso: string, sources: string[]): Promise<number> {
    const t = new Date(sinceIso).valueOf();
    return [...this.xp.values()]
      .filter((r) => r.user_id === user_id && new Date(r.created_at).valueOf() >= t && sources.includes(r.source))
      .reduce((sum, r) => sum + r.amount, 0);
  }
  async totalXpForUser(user_id: string): Promise<number> {
    return [...this.xp.values()]
      .filter((r) => r.user_id === user_id)
      .reduce((sum, r) => sum + r.amount, 0);
  }

  async upsertMentor(m: Mentor): Promise<Mentor> {
    this.mentors.set(m.user_id, m);
    return m;
  }
  async getMentor(user_id: string): Promise<Mentor | null> {
    return this.mentors.get(user_id) ?? null;
  }
  async listAvailableMentors(args: { industry?: string | null; country?: string | null }): Promise<Mentor[]> {
    return [...this.mentors.values()].filter(
      (m) => m.status === "active" && m.active_mentees < 5,
    );
  }
  async insertMatch(m: Match): Promise<Match> {
    this.matches.set(m.id, m);
    return m;
  }
  async endMatch(id: string, ended_by: Match["ended_by"], at: string): Promise<Match> {
    const m = this.matches.get(id);
    if (!m) throw new Error("match not found");
    const next = { ...m, ended_at: at, ended_by };
    this.matches.set(id, next);
    return next;
  }
  async getActiveMatchForMentee(mentee_user_id: string): Promise<Match | null> {
    for (const m of this.matches.values()) {
      if (m.mentee_user_id === mentee_user_id && !m.ended_at) return m;
    }
    return null;
  }

  async insertGame(g: Game): Promise<Game> {
    this.games.set(g.id, g);
    return g;
  }
  async getActiveGame(): Promise<Game | null> {
    for (const g of this.games.values()) if (g.status === "open") return g;
    return null;
  }
  async insertGameEntry(e: GameEntry): Promise<GameEntry> {
    this.gameEntries.set(e.id, e);
    return e;
  }
  async listGameEntries(game_id: string): Promise<GameEntry[]> {
    return [...this.gameEntries.values()].filter((e) => e.game_id === game_id);
  }
}
