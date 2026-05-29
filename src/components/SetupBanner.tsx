"use client";
import { useState, useEffect } from "react";

export default function SetupBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json())
      .then((d) => setShow(!d.hasTmdbKey))
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-sm text-amber-300">
          <strong>Missing TMDB API key</strong> — movie posters and search won&apos;t work fully.{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200"
          >
            Get a free key
          </a>{" "}
          then add{" "}
          <code className="rounded bg-black/30 px-1 font-mono text-xs">
            TMDB_API_KEY=your_key
          </code>{" "}
          to <code className="rounded bg-black/30 px-1 font-mono text-xs">.env.local</code> and restart.
        </p>
        <button
          onClick={() => setShow(false)}
          className="shrink-0 text-amber-400/60 transition hover:text-amber-400"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
