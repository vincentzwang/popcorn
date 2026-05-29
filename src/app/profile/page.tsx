"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfileRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
    if (status === "authenticated") {
      const username = (session?.user as { username?: string })?.username;
      if (username) router.push(`/profile/${username}`);
    }
  }, [session, status, router]);

  return null;
}
