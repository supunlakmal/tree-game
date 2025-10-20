"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UsernameForm from "@/components/UsernameForm";
import Leaderboard from "@/components/Leaderboard";
import { getStoredUsername } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  // Redirect to game if already logged in
  useEffect(() => {
    const username = getStoredUsername();
    if (username) {
      router.push("/game");
    }
  }, [router]);

  return (
    <div className="landing-container">
      <div className="landing-background"></div>
      <div className="landing-overlay"></div>
      <div className="landing-content">
        <UsernameForm />
        <Leaderboard />
      </div>
    </div>
  );
}
