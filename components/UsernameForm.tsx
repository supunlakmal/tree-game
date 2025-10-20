"use client";

import { loginOrRegister, setStoredUsername, validateUsername } from "@/lib/auth";
import { detectUserCountry } from "@/lib/geo";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = username.trim();

    // Validate format only
    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setError(validation.error || "");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Detect user's country (non-blocking, continues even if fails)
      let country: string | null = null;
      try {
        setDetectingLocation(true);
        country = await detectUserCountry();
        setDetectingLocation(false);
      } catch (err) {
        console.warn("Country detection failed, continuing without it");
        setDetectingLocation(false);
      }

      // Login or register user with country
      const result = await loginOrRegister(trimmed, country);

      if (!result.success) {
        setError(result.error || "Failed to authenticate");
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

  const isValid = username.trim().length >= 3 && !error;

  return (
    <form onSubmit={handleSubmit} className="username-form">
      <div className="form-header">
        <h1 className="form-title">Night Drive</h1>
        <p className="form-subtitle">Enter your username to play</p>
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
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" className="submit-button" disabled={!isValid || isSubmitting}>
        {detectingLocation ? "Detecting location..." : isSubmitting ? "Loading..." : "Start Game"}
      </button>

      <div className="form-hint">Username must be 3-20 characters (letters, numbers, _, -)</div>
    </form>
  );
}
