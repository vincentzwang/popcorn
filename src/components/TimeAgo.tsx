"use client";

function fmt(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// suppressHydrationWarning tells React to ignore the text-content mismatch
// caused by Date.now() being called at different times on server vs client.
export default function TimeAgo({ date, className }: { date: string; className?: string }) {
  return (
    <span suppressHydrationWarning className={className}>
      {fmt(date)}
    </span>
  );
}
