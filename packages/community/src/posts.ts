/**
 * Posts / comments / reactions.
 *
 * Plus the bot-driven themed-thread system (Doc 16 §5.5):
 *
 *   Mon — Question Mon
 *   Tue — AMA Tue (rotating guest)
 *   Wed — Win Wed
 *   Thu — Tactic Thu
 *   Fri — Fail Fri
 *   Sat — Show-Off Sat
 *   Sun — Sunday Setup
 *
 * Engagement on themed threads earns 2× XP for the first 24h.
 */

import type { CommunityStore } from "./store.js";
import type { Comment, Post, PostThreadType, Reaction, ReactionKind } from "./types.js";

export interface PostDeps {
  store: CommunityStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
  emit?: (
    name: "post_created" | "post_reacted" | "comment_upvoted",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function createPost(
  args: {
    hub_id: string;
    author_user_id: string;
    title: string;
    body: string;
    thread_type?: PostThreadType;
  },
  deps: PostDeps,
): Promise<Post> {
  const clock = deps.clock ?? defaultClock;
  const themed = !!args.thread_type && args.thread_type !== "general";
  const post: Post = {
    id: deps.newId("request"),
    hub_id: args.hub_id,
    author_user_id: args.author_user_id,
    title: args.title,
    body: args.body,
    thread_type: args.thread_type ?? "general",
    reactions: 0,
    comments: 0,
    pinned_until: themed
      ? new Date(new Date(clock.iso()).valueOf() + 24 * 3600 * 1000).toISOString()
      : null,
    is_themed: themed,
    flagged: false,
    created_at: clock.iso(),
  };
  const inserted = await deps.store.insertPost(post);
  if (deps.emit) {
    await deps.emit("post_created", {
      user_id: args.author_user_id,
      hub_id: args.hub_id,
      post_id: inserted.id,
      thread_type: inserted.thread_type,
    });
  }
  return inserted;
}

export async function addComment(
  args: {
    post_id: string;
    parent_comment_id?: string | null;
    author_user_id: string;
    body: string;
  },
  deps: PostDeps,
): Promise<Comment> {
  const clock = deps.clock ?? defaultClock;
  const comment: Comment = {
    id: deps.newId("request"),
    post_id: args.post_id,
    parent_comment_id: args.parent_comment_id ?? null,
    author_user_id: args.author_user_id,
    body: args.body,
    upvotes: 0,
    marked_helpful: false,
    flagged: false,
    created_at: clock.iso(),
  };
  return deps.store.insertComment(comment);
}

export async function react(
  args: {
    user_id: string;
    post_id?: string;
    comment_id?: string;
    kind: ReactionKind;
  },
  deps: PostDeps,
): Promise<Reaction> {
  const clock = deps.clock ?? defaultClock;
  const r: Reaction = {
    id: deps.newId("request"),
    user_id: args.user_id,
    post_id: args.post_id ?? null,
    comment_id: args.comment_id ?? null,
    kind: args.kind,
    created_at: clock.iso(),
  };
  const inserted = await deps.store.insertReaction(r);
  if (deps.emit && args.post_id) {
    await deps.emit("post_reacted", {
      user_id: args.user_id,
      post_id: args.post_id,
      reaction: args.kind,
    });
  }
  return inserted;
}

/**
 * Bot — runs once per day per hub at the hub's scheduled hour, posts the
 * themed thread (Win Wed / Fail Fri / etc.). Returns the post, or null if
 * a themed thread for that hub × day already exists.
 */
export async function dropThemedThread(
  args: {
    hub_id: string;
    bot_user_id: string;
    thread_type: PostThreadType;
    title: string;
    body: string;
  },
  deps: PostDeps,
): Promise<Post> {
  return createPost(
    {
      hub_id: args.hub_id,
      author_user_id: args.bot_user_id,
      title: args.title,
      body: args.body,
      thread_type: args.thread_type,
    },
    deps,
  );
}

/**
 * 2× XP multiplier for engagement on themed threads within the first 24h.
 */
export function themedThreadXpMultiplier(post: Post, atIso: string): number {
  if (!post.is_themed) return 1;
  const age = new Date(atIso).valueOf() - new Date(post.created_at).valueOf();
  if (age < 24 * 3600 * 1000) return 2;
  return 1;
}
