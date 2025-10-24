"use client";

import { useEffect, useState } from "react";
import { getTopScores, getTopScoresWeekly, getTopScoresMonthly, getTopScoresDaily, ScoreWithUsername } from "@/lib/scores";
import { getCountryFlag } from "@/lib/geo";

type LeaderboardTab = "allTime" | "monthly" | "weekly" | "daily";

export default function Leaderboard() {
  const [scores, setScores] = useState<ScoreWithUsername[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("daily");

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      let topScores: ScoreWithUsername[] = [];

      switch (activeTab) {
        case "daily":
          topScores = await getTopScoresDaily(10);
          break;
        case "weekly":
          topScores = await getTopScoresWeekly(10);
          break;
        case "monthly":
          topScores = await getTopScoresMonthly(10);
          break;
        case "allTime":
        default:
          topScores = await getTopScores(10);
          break;
      }

      setScores(topScores);
      setLoading(false);
    }

    fetchScores();
  }, [activeTab]);

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

      <div className="leaderboard-tabs">
        <button
          className={`leaderboard-tab ${activeTab === "daily" ? "leaderboard-tab--active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          Daily
        </button>
        <button
          className={`leaderboard-tab ${activeTab === "weekly" ? "leaderboard-tab--active" : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          Weekly
        </button>
        <button
          className={`leaderboard-tab ${activeTab === "monthly" ? "leaderboard-tab--active" : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          Monthly
        </button>
        <button
          className={`leaderboard-tab ${activeTab === "allTime" ? "leaderboard-tab--active" : ""}`}
          onClick={() => setActiveTab("allTime")}
        >
          All Time
        </button>
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
