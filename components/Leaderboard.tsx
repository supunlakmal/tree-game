"use client";

import { useEffect, useState } from "react";
import { getTopScores, ScoreWithUsername } from "@/lib/scores";
import { getCountryFlag } from "@/lib/geo";

export default function Leaderboard() {
  const [scores, setScores] = useState<ScoreWithUsername[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      const topScores = await getTopScores(10);
      setScores(topScores);
      setLoading(false);
    }

    fetchScores();
  }, []);

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  const getRankClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "rank-gold";
      case 2:
        return "rank-silver";
      case 3:
        return "rank-bronze";
      default:
        return "";
    }
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <span className="leaderboard-icon">🏆</span>
        <h2 className="leaderboard-title">Leaderboard</h2>
      </div>

      {loading ? (
        <div className="leaderboard-loading">Loading scores...</div>
      ) : scores.length === 0 ? (
        <div className="leaderboard-empty">
          <p>No scores yet!</p>
          <p className="leaderboard-empty-subtitle">Be the first to play</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {scores.map((score, index) => (
            <div key={score.id} className={`leaderboard-entry ${getRankClass(index + 1)}`} style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="leaderboard-rank">{getRankEmoji(index + 1)}</div>
              <div className="leaderboard-username">
                {score.country && <span className="country-flag">{getCountryFlag(score.country)} </span>}
                {score.username}
              </div>
              <div className="leaderboard-score">{score.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
