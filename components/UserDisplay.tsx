"use client";

import { useRouter } from "next/navigation";
import { clearStoredUsername } from "@/lib/auth";

interface UserDisplayProps {
  username: string;
  variant?: "overlay" | "hud";
}

export default function UserDisplay({ username, variant = "overlay" }: UserDisplayProps) {
  const router = useRouter();

  const handleChangeUsername = () => {
    clearStoredUsername();
    router.push("/");
  };

  const containerClassName = variant === "hud" ? "user-display user-display--hud" : "user-display user-display--overlay";

  return (
    <div className={containerClassName}>
      <div className="user-info">
        <span className="user-label">Player:</span>
        <span className="user-name">{username}</span>
      </div>
      <button onClick={handleChangeUsername} className="change-username-btn" title="Change Username">
        Change
      </button>
    </div>
  );
}
