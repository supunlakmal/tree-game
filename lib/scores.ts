import { supabase } from './supabase'

export interface Score {
  id: string
  user_id: string
  score: number
  created_at: string
}

export interface ScoreWithUsername extends Score {
  username: string
}

interface ScoreWithUserRelation {
  id: string
  user_id: string
  score: number
  created_at: string
  users: {
    username: string
  }[]
}

/**
 * Saves a game score for a user
 */
export async function saveScore(username: string, score: number): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get the user_id from the username
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !userData) {
      console.error('Error finding user:', userError)
      return { success: false, error: 'User not found' }
    }

    // Insert the score
    const { error: insertError } = await supabase
      .from('scores')
      .insert([{ user_id: userData.id, score }])

    if (insertError) {
      console.error('Error saving score:', insertError)
      return { success: false, error: 'Failed to save score' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving score:', error)
    return { success: false, error: 'An error occurred while saving score' }
  }
}

/**
 * Gets all scores for a specific user, ordered by date (newest first)
 */
export async function getUserScores(username: string, limit = 10): Promise<Score[]> {
  try {
    // Get user_id from username
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !userData) {
      console.error('Error finding user:', userError)
      return []
    }

    // Get scores for this user
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user scores:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user scores:', error)
    return []
  }
}

/**
 * Gets the highest score for a specific user
 */
export async function getUserHighScore(username: string): Promise<number> {
  try {
    // Get user_id from username
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !userData) {
      return 0
    }

    // Get highest score
    const { data, error } = await supabase
      .from('scores')
      .select('score')
      .eq('user_id', userData.id)
      .order('score', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return 0
    }

    return data.score
  } catch (error) {
    console.error('Error fetching high score:', error)
    return 0
  }
}

/**
 * Gets top scores across all users (leaderboard)
 */
export async function getTopScores(limit = 10): Promise<ScoreWithUsername[]> {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select(`
        id,
        score,
        created_at,
        user_id,
        users!inner (
          username
        )
      `)
      .order('score', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching top scores:', error)
      return []
    }

    // Transform the data to flatten the user object
    return (data || []).map((item: ScoreWithUserRelation) => ({
      id: item.id,
      user_id: item.user_id,
      score: item.score,
      created_at: item.created_at,
      username: item.users[0].username
    }))
  } catch (error) {
    console.error('Error fetching top scores:', error)
    return []
  }
}

/**
 * Gets user's rank based on their highest score
 */
export async function getUserRank(username: string): Promise<number> {
  try {
    // Get user's highest score
    const highScore = await getUserHighScore(username)

    if (highScore === 0) {
      return 0
    }

    // Count how many users have a higher score
    const { count, error } = await supabase
      .from('scores')
      .select('score', { count: 'exact', head: true })
      .gt('score', highScore)

    if (error) {
      console.error('Error calculating rank:', error)
      return 0
    }

    // Rank is count + 1 (1-indexed)
    return (count || 0) + 1
  } catch (error) {
    console.error('Error calculating rank:', error)
    return 0
  }
}
