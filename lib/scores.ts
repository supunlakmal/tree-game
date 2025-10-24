import { supabase } from "./supabase";

export interface Score {
  id: string;
  user_id: string;
  score: number;
  created_at: string;
}

export interface ScoreWithUsername extends Score {
  username: string;
  country?: string;
}

/**
 * Saves a game score for a user
 */
export async function saveScore(username: string, score: number): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get the user_id from the username
    const { data: userData, error: userError } = await supabase.from("users").select("id").eq("username", username).single();

    if (userError || !userData) {
      console.error("Error finding user:", userError);
      return { success: false, error: "User not found" };
    }

    // Insert the score
    const { error: insertError } = await supabase.from("scores").insert([{ user_id: userData.id, score }]);

    if (insertError) {
      console.error("Error saving score:", insertError);
      return { success: false, error: "Failed to save score" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving score:", error);
    return { success: false, error: "An error occurred while saving score" };
  }
}

/**
 * Gets all scores for a specific user, ordered by date (newest first)
 */
export async function getUserScores(username: string, limit = 10): Promise<Score[]> {
  try {
    // Get user_id from username
    const { data: userData, error: userError } = await supabase.from("users").select("id").eq("username", username).single();

    if (userError || !userData) {
      console.error("Error finding user:", userError);
      return [];
    }

    // Get scores for this user
    const { data, error } = await supabase.from("scores").select("*").eq("user_id", userData.id).order("created_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("Error fetching user scores:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching user scores:", error);
    return [];
  }
}

/**
 * Gets the highest score for a specific user
 */
export async function getUserHighScore(username: string): Promise<number> {
  try {
    // Get user_id from username
    const { data: userData, error: userError } = await supabase.from("users").select("id").eq("username", username).single();

    if (userError || !userData) {
      return 0;
    }

    // Get highest score
    const { data, error } = await supabase.from("scores").select("score").eq("user_id", userData.id).order("score", { ascending: false }).limit(1).single();

    if (error || !data) {
      return 0;
    }

    return data.score;
  } catch (error) {
    console.error("Error fetching high score:", error);
    return 0;
  }
}

/**
 * Gets user's rank based on their highest score
 */
export async function getUserRank(username: string): Promise<number> {
  try {
    // Get user's highest score
    const highScore = await getUserHighScore(username);

    if (highScore === 0) {
      return 0;
    }

    // Count how many users have a higher score
    const { count, error } = await supabase.from("scores").select("score", { count: "exact", head: true }).gt("score", highScore);

    if (error) {
      console.error("Error calculating rank:", error);
      return 0;
    }

    // Rank is count + 1 (1-indexed)
    return (count || 0) + 1;
  } catch (error) {
    console.error("Error calculating rank:", error);
    return 0;
  }
}

/**
 * Gets the top scores across all users (each user's highest score)
 * Returns users ordered by their highest score descending
 *
 * Uses the optimized database function `get_top_scores` which:
 * - Returns only the highest score per user (no duplicates)
 * - Handles ties by returning the earliest score timestamp
 * - Performs all filtering and sorting in the database (efficient)
 */
export async function getTopScores(limit: number = 100): Promise<ScoreWithUsername[]> {
  try {
    // Call the database function which returns pre-joined and filtered results
    const { data, error } = await supabase.rpc("get_top_scores", { score_limit: limit });

    if (error) {
      console.error("Error fetching top scores:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    console.log(data);

    // The database function already returns the correct format with username included
    // Type assertion is safe here as the database function guarantees this structure
    return data as ScoreWithUsername[];
  } catch (error) {
    console.error("Error fetching top scores:", error);
    return [];
  }
}

/**
 * Gets the top scores from the last 7 days across all users (each user's highest score in that period)
 * Returns users ordered by their highest score descending
 *
 * Uses the optimized database function `get_top_scores_weekly` which:
 * - Returns only scores from the last 7 days
 * - Returns only the highest score per user (no duplicates)
 * - Handles ties by returning the earliest score timestamp
 * - Performs all filtering and sorting in the database (efficient)
 */
export async function getTopScoresWeekly(limit: number = 100): Promise<ScoreWithUsername[]> {
  try {
    // Call the database function which returns pre-joined and filtered results
    const { data, error } = await supabase.rpc("get_top_scores_weekly", { score_limit: limit });

    if (error) {
      console.error("Error fetching weekly top scores:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // The database function already returns the correct format with username included
    // Type assertion is safe here as the database function guarantees this structure
    return data as ScoreWithUsername[];
  } catch (error) {
    console.error("Error fetching weekly top scores:", error);
    return [];
  }
}

/**
 * Gets the top scores from the last 30 days across all users (each user's highest score in that period)
 * Returns users ordered by their highest score descending
 *
 * Uses the optimized database function `get_top_scores_monthly` which:
 * - Returns only scores from the last 30 days
 * - Returns only the highest score per user (no duplicates)
 * - Handles ties by returning the earliest score timestamp
 * - Performs all filtering and sorting in the database (efficient)
 */
export async function getTopScoresMonthly(limit: number = 100): Promise<ScoreWithUsername[]> {
  try {
    // Call the database function which returns pre-joined and filtered results
    const { data, error } = await supabase.rpc("get_top_scores_monthly", { score_limit: limit });

    if (error) {
      console.error("Error fetching monthly top scores:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // The database function already returns the correct format with username included
    // Type assertion is safe here as the database function guarantees this structure
    return data as ScoreWithUsername[];
  } catch (error) {
    console.error("Error fetching monthly top scores:", error);
    return [];
  }
}

/**
 * Gets the top scores from the last 24 hours across all users (each user's highest score in that period)
 * Returns users ordered by their highest score descending
 *
 * Uses the optimized database function `get_top_scores_daily` which:
 * - Returns only scores from the last 24 hours
 * - Returns only the highest score per user (no duplicates)
 * - Handles ties by returning the earliest score timestamp
 * - Performs all filtering and sorting in the database (efficient)
 */
export async function getTopScoresDaily(limit: number = 100): Promise<ScoreWithUsername[]> {
  try {
    // Call the database function which returns pre-joined and filtered results
    const { data, error } = await supabase.rpc("get_top_scores_daily", { score_limit: limit });

    if (error) {
      console.error("Error fetching daily top scores:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // The database function already returns the correct format with username included
    // Type assertion is safe here as the database function guarantees this structure
    return data as ScoreWithUsername[];
  } catch (error) {
    console.error("Error fetching daily top scores:", error);
    return [];
  }
}
