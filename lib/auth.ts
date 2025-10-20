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
 * - If username exists: allows login (updates country if provided and not set)
 * - If username doesn't exist: creates new user with country
 *
 * @param username - The username to login/register
 * @param country - Optional 2-letter country code (e.g., "US", "GB")
 */
export async function loginOrRegister(username: string, country?: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = username.trim()

    // Check if user exists
    const exists = await checkUsernameExists(trimmed)

    if (exists) {
      // User exists - allow login
      // Optionally update country if provided and user doesn't have one
      if (country) {
        await updateUserCountry(trimmed, country)
      }
      return { success: true }
    }

    // User doesn't exist - create new user with country
    const insertData: { username: string; country?: string } = { username: trimmed }
    if (country) {
      insertData.country = country
    }

    const { error } = await supabase
      .from('users')
      .insert([insertData])

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
 * Updates user's country if not already set
 */
export async function updateUserCountry(username: string, country: string): Promise<void> {
  try {
    // Only update if country is not already set
    const { data: userData } = await supabase
      .from('users')
      .select('country')
      .eq('username', username)
      .single()

    if (userData && !userData.country) {
      await supabase
        .from('users')
        .update({ country })
        .eq('username', username)

      console.log(`Updated country for ${username}: ${country}`)
    }
  } catch (error) {
    console.error('Error updating user country:', error)
    // Don't throw - this is not critical
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
