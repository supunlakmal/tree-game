"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserDisplay from "@/components/UserDisplay";
import { clearStoredUsername, getStoredUsername, updateLastPlayed, updateUserCountry } from "@/lib/auth";
import { detectUserCountry } from "@/lib/geo";
import { GAME_DURATION_SECONDS } from "@/lib/game/config";
import { useGameEngine } from "@/lib/game/useGameEngine";
import { saveScore } from "@/lib/scores";

export default function Game() {
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hitCounterRef = useRef(0);

  const [username, setUsername] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION_SECONDS);
  const [hitCount, setHitCount] = useState(0);

  useEffect(() => {
    const storedUsername = getStoredUsername();
    if (!storedUsername) {
      router.push("/");
      return;
    }

    setUsername(storedUsername);
    setTimeRemaining(GAME_DURATION_SECONDS);
    setHitCount(0);
    hitCounterRef.current = 0;

    updateLastPlayed(storedUsername);

    detectUserCountry()
      .then((country) => {
        if (country) {
          updateUserCountry(storedUsername, country);
        }
      })
      .catch(() => {
        // Country detection is best effort only.
      });
  }, [router]);

  const handleHit = useCallback((hits: number) => {
    hitCounterRef.current = hits;
    setHitCount(hits);
  }, []);

  const engineRef = useGameEngine({
    containerRef,
    onHit: handleHit,
    enabled: Boolean(username),
  });

  const endGame = useCallback(async () => {
    if (gameOver) {
      return;
    }

    const score = hitCounterRef.current;
    setFinalScore(score);
    setGameOver(true);

    engineRef.current?.stop();

    if (username) {
      const result = await saveScore(username, score);
      setScoreSaved(result.success);
    }
  }, [engineRef, gameOver, username]);

  useEffect(() => {
    if (!username || gameOver) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          void endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [username, gameOver, endGame]);

  if (!username) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerClass = () => {
    if (timeRemaining > 60) return "timer-green";
    if (timeRemaining > 30) return "timer-yellow";
    return "timer-red";
  };

  return (
    <>
      <UserDisplay username={username} />

      {!gameOver && (
        <div className={`game-timer ${getTimerClass()}`}>
          <div className="timer-icon">Timer</div>
          <div className="timer-value">{formatTime(timeRemaining)}</div>
        </div>
      )}

      {!gameOver && (
        <div className="hit-counter">
          <div className="hit-counter-label">Hits</div>
          <div className="hit-counter-value">{hitCount}</div>
        </div>
      )}

      <div ref={containerRef} className="game-container" />
      <div className="controls">Drive with arrow keys or WASD | 2 minute timed game</div>

      {gameOver && (
        <div className="game-over-modal">
          <div className="game-over-content">
            <h2 className="game-over-title">Game Over!</h2>
            <div className="final-score">
              <span className="score-label">Final Score:</span>
              <span className="score-value">{finalScore}</span>
            </div>
            {scoreSaved ? <p className="save-status success">Score saved successfully!</p> : <p className="save-status error">Failed to save score</p>}
            <div className="game-over-actions">
              <button
                onClick={() => {
                  setGameOver(false);
                  setFinalScore(0);
                  setScoreSaved(false);
                  hitCounterRef.current = 0;
                  window.location.reload();
                }}
                className="play-again-button"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  engineRef.current?.dispose();
                  clearStoredUsername();
                  router.push("/");
                }}
                className="home-button"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
