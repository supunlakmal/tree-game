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
      <div className="landing-shell">
        <header className="landing-hero">
          <div className="landing-logo">Night Drive</div>
          <p className="landing-tagline">Race sunsets, dodge dunes, climb the leaderboard.</p>
        </header>
        <div className="landing-content">
          <section className="landing-pane landing-pane--form">
            <UsernameForm />
          </section>
          <section className="landing-pane landing-pane--leaderboard">
            <Leaderboard />
          </section>
        </div>
      </div>
    </div>
  );
}
