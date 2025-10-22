"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserDisplay from "@/components/UserDisplay";
import { MobileControls } from "@/components/MobileControls";
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
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousOverscrollBehavior) {
        document.body.style.overscrollBehavior = previousOverscrollBehavior;
      } else {
        document.body.style.removeProperty("overscroll-behavior");
      }
    };
  }, []);

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

  useEffect(() => {
    const detectTouchDevice = () => {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
      }

      const nav = navigator as Navigator & { msMaxTouchPoints?: number };
      const hasTouchPoints =
        (typeof nav.maxTouchPoints === "number" && nav.maxTouchPoints > 0) ||
        (typeof nav.msMaxTouchPoints === "number" && nav.msMaxTouchPoints > 0);

      const pointerCoarse =
        typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : false;

      const userAgentIndicatesMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      return Boolean(pointerCoarse || hasTouchPoints || userAgentIndicatesMobile);
    };

    const updateTouchState = () => {
      setIsTouchDevice(detectTouchDevice());
    };

    updateTouchState();

    window.addEventListener("resize", updateTouchState);
    window.addEventListener("orientationchange", updateTouchState);

    return () => {
      window.removeEventListener("resize", updateTouchState);
      window.removeEventListener("orientationchange", updateTouchState);
    };
  }, []);

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

  const controlsMessage = isTouchDevice
    ? "Tap the on-screen arrows to drive | 2 minute timed game"
    : "Drive with arrow keys or WASD | 2 minute timed game";

  const timeProgress = Math.max(0, Math.min(1, timeRemaining / GAME_DURATION_SECONDS));

  return (
    <>
      <div className={`game-hud${gameOver ? " game-hud--compact" : ""}`}>
        {!gameOver && (
          <div className={`hud-chip hud-chip--timer ${getTimerClass()}`}>
            <div className="game-timer__header" aria-live="polite">
              <span className="timer-icon">Time</span>
              <span className="timer-value">{formatTime(timeRemaining)}</span>
            </div>
            <div
              className="game-timer__progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={GAME_DURATION_SECONDS}
              aria-valuenow={timeRemaining}
            >
              <div className="game-timer__progress-fill" style={{ transform: `scaleX(${timeProgress})` }} />
            </div>
          </div>
        )}

        <div className="hud-cluster">
          {!gameOver && (
            <div className="hud-chip hud-chip--hits">
              <span className="hit-counter-label">Hits</span>
              <span className="hit-counter-value">{hitCount}</span>
            </div>
          )}

          <div className="hud-chip hud-chip--player">
            <UserDisplay username={username} variant="hud" />
          </div>
        </div>
      </div>

      <div ref={containerRef} className="game-container" />
      <div className="controls">{controlsMessage}</div>

      {isTouchDevice && !gameOver && <MobileControls engineRef={engineRef} />}

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
