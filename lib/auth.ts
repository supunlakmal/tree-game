import { supabase } from './supabase'

const USERNAME_STORAGE_KEY = 'game_username'

/**
 * Validates username format
 * Rules: 3-20 characters, alphanumeric, underscores, and hyphens only
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim()

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' }
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' }
  }

  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }

  return { valid: true }
}

/**
 * Checks if username already exists in the database
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .ilike('username', username)
      .single()

    if (error) {
      // If error is "PGRST116" (no rows returned), username is available
      if (error.code === 'PGRST116') {
        return false
      }
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Error checking username:', error)
    throw error
  }
}

/**
 * Creates a new user in the database
 */
export async function createUser(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('users')
      .insert([{ username: username.trim() }])

    if (error) {
      // Handle duplicate username error
      if (error.code === '23505') {
        return { success: false, error: 'Username already taken' }
      }
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error: 'Failed to create user. Please try again.' }
  }
}

/**
 * Login or register a user (unified authentication flow)
 * - If username exists: allows login (returns success)
 * - If username doesn't exist: creates new user
 */
export async function loginOrRegister(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = username.trim()

    // Check if user exists
    const exists = await checkUsernameExists(trimmed)

    if (exists) {
      // User exists - allow login
      return { success: true }
    }

    // User doesn't exist - create new user
    const { error } = await supabase
      .from('users')
      .insert([{ username: trimmed }])

    if (error) {
      // Handle duplicate username error (race condition)
      if (error.code === '23505') {
        // Username was created between our check and insert - treat as successful login
        return { success: true }
      }
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error in loginOrRegister:', error)
    return { success: false, error: 'Failed to authenticate. Please try again.' }
  }
}

/**
 * Updates the last_played timestamp for a user
 */
export async function updateLastPlayed(username: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ last_played: new Date().toISOString() })
      .eq('username', username)
  } catch (error) {
    console.error('Error updating last played:', error)
    // Don't throw - this is not critical
  }
}

/**
 * Gets the stored username from localStorage
 */
export function getStoredUsername(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USERNAME_STORAGE_KEY)
}

/**
 * Saves username to localStorage
 */
export function setStoredUsername(username: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERNAME_STORAGE_KEY, username)
}

/**
 * Removes username from localStorage
 */
export function clearStoredUsername(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USERNAME_STORAGE_KEY)
}
