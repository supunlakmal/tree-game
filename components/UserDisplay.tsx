"use client";

import { useRouter } from "next/navigation";
import { clearStoredUsername } from "@/lib/auth";

interface UserDisplayProps {
  username: string;
}

export default function UserDisplay({ username }: UserDisplayProps) {
  const router = useRouter();

  const handleChangeUsername = () => {
    clearStoredUsername();
    router.push("/");
  };

  return (
    <div className="user-display">
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
