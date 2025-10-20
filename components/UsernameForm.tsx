"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  validateUsername,
  checkUsernameExists,
  createUser,
  setStoredUsername,
} from "@/lib/auth";

export default function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Debounced duplicate check
  useEffect(() => {
    const trimmed = username.trim();

    // Reset states
    setError("");
    setIsAvailable(null);

    // Don't check if empty or invalid format
    if (!trimmed) return;

    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setError(validation.error || "");
      return;
    }

    // Debounce the duplicate check
    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const exists = await checkUsernameExists(trimmed);
        if (exists) {
          setError("Username already taken");
          setIsAvailable(false);
        } else {
          setIsAvailable(true);
        }
      } catch (err) {
        setError("Error checking username. Please try again.");
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = username.trim();

    // Validate
    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setError(validation.error || "");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Create user in database
      const result = await createUser(trimmed);

      if (!result.success) {
        setError(result.error || "Failed to create user");
        setIsSubmitting(false);
        return;
      }

      // Save to localStorage
      setStoredUsername(trimmed);

      // Navigate to game
      router.push("/game");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isValid = username.trim().length >= 3 && isAvailable && !error;

  return (
    <form onSubmit={handleSubmit} className="username-form">
      <div className="form-header">
        <h1 className="form-title">Night Drive</h1>
        <p className="form-subtitle">Enter your username to start playing</p>
      </div>

      <div className="input-wrapper">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          className="username-input"
          autoFocus
          maxLength={20}
          disabled={isSubmitting}
        />
        {isChecking && (
          <div className="input-status checking">Checking...</div>
        )}
        {isAvailable && !isChecking && (
          <div className="input-status available">Available!</div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        type="submit"
        className="submit-button"
        disabled={!isValid || isSubmitting || isChecking}
      >
        {isSubmitting ? "Creating..." : "Start Game"}
      </button>

      <div className="form-hint">
        Username must be 3-20 characters (letters, numbers, _, -)
      </div>
    </form>
  );
}
