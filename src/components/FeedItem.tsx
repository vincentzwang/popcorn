"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { tierColor, tierLabel, scoreColor } from "@/lib/scoring";
import type { Tier } from "@/lib/scoring";
import TimeAgo from "@/components/TimeAgo";

export interface FeedEntry {
  id: number;
  tier: Tier;
  score: number | null;
  review: string | null;
  created_at: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  username: string;
  like_count: number;
  comment_count: number;
  liked_by_me: number; // 0 or 1 from SQLite
}

interface RatingComment {
  id: number;
  body: string;
  created_at: string;
  username: string;
  user_id: number;
}

const tierEmoji: Record<Tier, string> = { liked: "😍", fine: "😐", disliked: "👎" };
const tierBadge: Record<Tier, string> = {
  liked:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  fine:     "bg-amber-500/15 text-amber-400 border-amber-500/20",
  disliked: "bg-red-500/15 text-red-400 border-red-500/20",
};


export default function FeedItem({ entry }: { entry: FeedEntry }) {
  const { data: session } = useSession();
  const myUsername = (session?.user as { username?: string })?.username;
  const myId = session?.user ? Number((session.user as { id: string }).id) : null;

  const [liked, setLiked]               = useState(Boolean(entry.liked_by_me));
  const [likeCount, setLikeCount]       = useState(entry.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]         = useState<RatingComment[] | null>(null);
  const [commentCount, setCommentCount] = useState(entry.comment_count);
  const [body, setBody]                 = useState("");
  const [posting, setPosting]           = useState(false);
  const [likeAnim, setLikeAnim]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load comments lazily when panel opens
  useEffect(() => {
    if (!showComments || comments !== null) return;
    fetch(`/api/rating-comments?umId=${entry.id}`)
      .then(r => r.json())
      .then(d => setComments(d));
  }, [showComments, comments, entry.id]);

  // Focus input when comments open
  useEffect(() => {
    if (showComments && inputRef.current) inputRef.current.focus();
  }, [showComments]);

  async function toggleLike() {
    if (!session) return;
    const wasLiked = liked;
    // Optimistic
    setLiked(!wasLiked);
    setLikeCount(c => c + (wasLiked ? -1 : 1));
    if (!wasLiked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 500); }
    await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ umId: entry.id }),
    });
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    const res = await fetch("/api/rating-comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ umId: entry.id, body }),
    });
    if (res.ok) {
      const c: RatingComment = await res.json();
      setComments(prev => [...(prev ?? []), c]);
      setCommentCount(n => n + 1);
      setBody("");
    }
    setPosting(false);
  }

  async function deleteComment(id: number) {
    await fetch("/api/rating-comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: id }),
    });
    setComments(prev => (prev ?? []).filter(c => c.id !== id));
    setCommentCount(n => n - 1);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] transition hover:border-white/10">

      {/* ── Main row ── */}
      <div className="flex items-center gap-3 px-3 py-3">
        <Link href={`/movies/${entry.tmdb_id}`} className="shrink-0">
          <div className="relative h-12 w-8 overflow-hidden rounded-lg bg-white/5">
            <SafeImage src={posterUrl(entry.poster_path, "w92")} alt={entry.title} fill className="object-cover" />
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug">
            <Link href={`/profile/${entry.username}`}
              className="font-semibold text-amber-400/90 hover:text-amber-400">
              {entry.username}
            </Link>
            <span className="text-white/30"> rated </span>
            <Link href={`/movies/${entry.tmdb_id}`}
              className="font-medium text-white/80 hover:text-white">
              {entry.title}
            </Link>
          </p>
          {entry.review && (
            <p className="mt-0.5 truncate text-xs text-white/30 italic">&ldquo;{entry.review}&rdquo;</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {entry.score !== null && (
              <span className={`text-sm font-bold ${scoreColor(entry.score)}`}>{entry.score.toFixed(1)}</span>
            )}
            <span className={`rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${tierBadge[entry.tier]}`}>
              {tierEmoji[entry.tier]} {tierLabel(entry.tier)}
            </span>
          </div>
          <TimeAgo date={entry.created_at} className="mt-0.5 text-[11px] text-white/20" />
        </div>
      </div>

      {/* ── Reaction bar ── */}
      <div className="flex items-center gap-1 border-t border-white/5 px-2 py-1.5">
        {/* Like */}
        <button
          onClick={toggleLike}
          disabled={!session}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition select-none
            ${liked
              ? "text-red-400 hover:text-red-300"
              : "text-white/30 hover:text-white/60 disabled:cursor-default"
            }`}
        >
          <span className={`text-base transition-transform ${likeAnim ? "scale-125" : "scale-100"}`}>
            {liked ? "❤️" : "🤍"}
          </span>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(p => !p)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition
            ${showComments ? "text-white/60" : "text-white/30 hover:text-white/60"}`}
        >
          <span className="text-base">💬</span>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        {/* Link to movie */}
        <Link href={`/movies/${entry.tmdb_id}`}
          className="ml-auto rounded-lg px-2.5 py-1 text-[11px] text-white/20 transition hover:text-white/50">
          View movie →
        </Link>
      </div>

      {/* ── Inline comment thread ── */}
      {showComments && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          {/* Existing comments */}
          {comments === null ? (
            <div className="text-xs text-white/25 py-1">Loading…</div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-white/20">No discussion yet — start the conversation.</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <Link href={`/profile/${c.username}`} className="shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold uppercase text-white/50">
                      {c.username[0]}
                    </div>
                  </Link>
                  <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/profile/${c.username}`}
                        className="text-xs font-semibold text-amber-400/70 hover:text-amber-400">
                        {c.username}
                      </Link>
                      <div className="flex items-center gap-2">
                        <TimeAgo date={c.created_at} className="text-[10px] text-white/20" />
                        {myId === c.user_id && (
                          <button onClick={() => deleteComment(c.id)}
                            className="text-[10px] text-white/15 hover:text-red-400 transition">×</button>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-white/65">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          {session ? (
            <form onSubmit={postComment} className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                {myUsername?.[0]?.toUpperCase()}
              </div>
              <input
                ref={inputRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={`Reply to ${entry.username}…`}
                maxLength={280}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
              />
              <button type="submit" disabled={!body.trim() || posting}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40">
                {posting ? "…" : "Post"}
              </button>
            </form>
          ) : (
            <Link href="/signin" className="block text-center text-xs text-white/25 hover:text-white/50 py-1">
              Sign in to comment
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
