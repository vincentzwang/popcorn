"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface User { username: string; }

interface Props {
  value: string;
  onChange: (username: string) => void;
}

export default function WatchedWithPicker({ value, onChange }: Props) {
  const { data: session } = useSession();
  const [follows, setFollows] = useState<User[]>([]);
  const [expanded, setExpanded] = useState(Boolean(value));

  useEffect(() => {
    if (!session) return;
    fetch("/api/users")
      .then(r => r.json())
      .then((users: Array<{ username: string; isFollowing: boolean }>) => {
        setFollows(users.filter(u => u.isFollowing).slice(0, 10));
      });
  }, [session]);

  if (!session) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => { setExpanded(p => !p); if (expanded) onChange(""); }}
        className={`flex items-center gap-2 text-sm font-medium transition ${
          value || expanded ? "text-amber-400" : "text-white/40 hover:text-white/70"
        }`}
      >
        <span className="text-base">🎟️</span>
        {value ? `Watched with @${value}` : "Watched with someone?"}
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange(""); setExpanded(false); }}
            className="ml-1 text-xs text-white/30 hover:text-red-400"
          >×</span>
        )}
      </button>

      {(expanded || value) && (
        <div className="mt-3 space-y-3">
          {/* Quick-pick chips */}
          {follows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {follows.map(u => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => onChange(value === u.username ? "" : u.username)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    value === u.username
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {u.username}
                </button>
              ))}
            </div>
          )}

          {/* Manual input */}
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Or type a username…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
          />
        </div>
      )}
    </div>
  );
}
