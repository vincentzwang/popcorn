"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import WatchedWithPicker from "@/components/WatchedWithPicker";

type Tier = "liked" | "fine" | "disliked";

const TIER_CONFIG = {
  liked:    { label: "Liked",    emoji: "😍", desc: "You enjoyed it",  cls: "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300", sel: "border-emerald-500 bg-emerald-500/25 text-emerald-200" },
  fine:     { label: "Fine",     emoji: "😐", desc: "It was okay",     cls: "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300",       sel: "border-amber-500 bg-amber-500/25 text-amber-200" },
  disliked: { label: "Disliked", emoji: "👎", desc: "Not for you",     cls: "border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300",               sel: "border-red-500 bg-red-500/25 text-red-200" },
};

interface UMInfo {
  id: number; tier: Tier; review: string | null;
  title: string; poster_path: string | null; release_year: number | null;
  score: number | null;
}

function EditInner() {
  const { umId } = useParams<{ umId: string }>();
  const searchParams = useSearchParams();
  const tmdbId = searchParams.get("tmdbId");
  const { data: session, status } = useSession();
  const router = useRouter();

  const [info, setInfo] = useState<UMInfo | null>(null);
  const [tier, setTier] = useState<Tier>("liked");
  const [review, setReview] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/compare/info?ids=${umId}`)
      .then((r) => r.json())
      .then((d: UMInfo[]) => {
        const m = d[0] as (UMInfo & { watched_with_username?: string }) | undefined;
        if (m) { setInfo(m); setTier(m.tier as Tier); setReview(m.review ?? ""); setWatchedWith(m.watched_with_username ?? ""); }
        setLoading(false);
      });
  }, [umId, status]);

  async function handleSave() {
    if (!info) return;
    setSaving(true);

    if (tier === info.tier) {
      // Same tier — just update review
      await fetch("/api/rate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umId: Number(umId), review, watchedWith }),
      });
      router.push(tmdbId ? `/movies/${tmdbId}` : "/profile");
      return;
    }

    // Tier changed — delete old, re-rate in new tier
    await fetch("/api/rate", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ umId: Number(umId) }),
    });

    const res = await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: Number(tmdbId), tier, review, watchedWith: watchedWith || undefined }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { alert(data.error ?? "Error saving"); return; }

    if (data.done) {
      router.push(tmdbId ? `/movies/${tmdbId}` : "/profile");
    } else {
      router.push(`/compare?umId=${data.umId}&compareWith=${data.compareWith}&low=${data.low}&high=${data.high}&tier=${tier}`);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this rating? This can't be undone.")) return;
    setDeleting(true);
    await fetch("/api/rate", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ umId: Number(umId) }),
    });
    router.push(tmdbId ? `/movies/${tmdbId}` : "/profile");
  }

  if (loading || !info) {
    return <div className="flex min-h-[60vh] items-center justify-center text-white/30">Loading…</div>;
  }

  const tierChanged = tier !== info.tier;

  return (
    <div className="mx-auto max-w-lg">
      {/* Back */}
      <Link href={tmdbId ? `/movies/${tmdbId}` : "/profile"} className="mb-6 inline-flex items-center gap-1 text-sm text-white/40 transition hover:text-white/70">
        ← Back
      </Link>

      <h1 className="mb-6 text-xl font-bold text-white">Edit rating</h1>

      {/* Movie card */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5">
          <SafeImage src={posterUrl(info.poster_path, "w92")} alt={info.title} fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{info.title}</p>
          <p className="text-sm text-white/40">{info.release_year}</p>
          {info.score !== null && <p className="text-xs text-white/30">Current score: {info.score.toFixed(1)}</p>}
        </div>
      </div>

      {/* Tier picker */}
      <p className="mb-3 text-sm font-medium text-white/50">How was it?</p>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG[Tier]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setTier(key)}
            className={`rounded-xl border px-3 py-4 text-center transition ${tier === key ? cfg.sel : cfg.cls}`}
          >
            <div className="mb-1 text-2xl">{cfg.emoji}</div>
            <div className="text-sm font-semibold">{cfg.label}</div>
            <div className="mt-0.5 text-xs opacity-60">{cfg.desc}</div>
          </button>
        ))}
      </div>

      {/* Tier-change notice */}
      {tierChanged && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Changing tier will start a new round of comparisons to re-rank this movie.
        </div>
      )}

      {/* Watched with */}
      <div className="mb-5">
        <WatchedWithPicker value={watchedWith} onChange={setWatchedWith} />
      </div>

      {/* Review */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-white/50">
          Review <span className="text-white/25">(optional)</span>
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Share your thoughts…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-amber-500 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : tierChanged ? "Save & re-rank →" : "Save changes"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {deleting ? "…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

export default function EditPage() {
  return <Suspense><EditInner /></Suspense>;
}
