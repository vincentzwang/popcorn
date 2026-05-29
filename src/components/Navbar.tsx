"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  const username = (session?.user as { username?: string })?.username;

  // Poll for unread notifications every 30s
  useEffect(() => {
    if (!session) return;
    const poll = () => fetch("/api/notifications").then(r => r.json()).then(d => setUnread(d.unread ?? 0)).catch(() => {});
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [session]);

  // Reset badge when viewing notifications page
  useEffect(() => { if (pathname === "/notifications") setUnread(0); }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const NavLink = ({ href, label }: { href: string; label: string }) => (
    <div className="relative">
      <Link href={href} onClick={() => setMenuOpen(false)}
        className={`text-sm transition ${isActive(href) ? "font-medium text-white" : "text-white/40 hover:text-white/80"}`}>
        {label}
      </Link>
      {isActive(href) && (
        <span className="absolute -bottom-[13px] left-0 right-0 h-px rounded-full bg-amber-500" />
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#13110d]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo + desktop nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight">
            <span className="text-amber-400">🍿</span>
            <span className="text-white">popcorn</span>
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            <NavLink href="/" label="Home" />
            <NavLink href="/showtimes" label="Showtimes" />
            <NavLink href="/browse/action" label="Browse" />
            {session && <NavLink href="/friends" label="Friends" />}
            {session && <NavLink href="/tonight" label="Tonight" />}
            {session && <NavLink href="/stats" label="Stats" />}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Link href="/search" className="hidden rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-400 sm:block">
                + Rate
              </Link>
              {/* Notification bell */}
              <Link href="/notifications" className="relative p-1.5 text-white/40 transition hover:text-white/80">
                <span className="text-base">🔔</span>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              {/* Avatar dropdown */}
              <div className="relative">
                <button onClick={() => setOpen(!open)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold uppercase text-white transition hover:bg-white/20">
                  {username?.[0] ?? "?"}
                </button>
                {open && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#18181b] py-1 shadow-2xl">
                    <div className="border-b border-white/5 px-4 py-2.5">
                      <p className="text-sm font-medium text-white">{username}</p>
                    </div>
                    {[
                      { href: username ? `/profile/${username}` : "/profile", icon: "👤", label: "My profile" },
                      { href: "/notifications", icon: "🔔", label: `Notifications${unread > 0 ? ` (${unread})` : ""}` },
                      { href: "/stats", icon: "📊", label: "My stats" },
                      { href: "/search", icon: "🎬", label: "Rate a movie", cls: "sm:hidden" },
                    ].map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 ${item.cls ?? ""}`}>
                        {item.icon} {item.label}
                      </Link>
                    ))}
                    {/* Mobile-only nav links */}
                    <div className="border-t border-white/5 sm:hidden">
                      {[
                        { href: "/friends", icon: "👥", label: "Friends" },
                        { href: "/showtimes", icon: "🎟️", label: "Showtimes" },
                        { href: "/browse/action", icon: "🔍", label: "Browse" },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5">
                          {item.icon} {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-white/5 mt-1">
                      <button onClick={() => { setOpen(false); signOut(); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/50 transition hover:bg-white/5">
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/signin" className="hidden text-sm text-white/50 transition hover:text-white sm:block">Sign in</Link>
              <Link href="/signup" className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-400">Join free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
