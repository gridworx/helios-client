/**
 * Better Auth Client - ACTIVE
 *
 * This file provides the better-auth client for session-based authentication.
 * Uses httpOnly cookies for XSS-resistant session management.
 *
 * Features:
 * - Email/password sign-in via signInWithEmail()
 * - Session management with automatic cookie handling
 * - Sign out via signOutUser()
 * - Future: SSO providers (Azure AD, Google, Okta)
 *
 * Migration (2025-12-26):
 * Passwords migrated from organization_users to auth_accounts table.
 * better-auth now handles authentication with httpOnly session cookies.
 */

import { createAuthClient } from 'better-auth/react';
import { API_BASE_URL } from '../config/api';

/**
 * Create the auth client connected to our backend
 *
 * The baseURL points to the backend's auth handler.
 * Since better-auth uses httpOnly cookies, credentials are automatically included.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL || window.location.origin,
});

/**
 * Export individual methods for convenience
 */
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;

/**
 * Extended user type with Helios-specific fields
 */
export interface HeliosUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  organizationId: string;
  isExternalAdmin?: boolean;
  defaultView?: 'admin' | 'user';
  isActive?: boolean;
  department?: string;
}

/**
 * Session with user info
 */
export interface HeliosSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: HeliosUser;
}

/**
 * Get the current session with full user details
 * Returns null if not authenticated
 */
export async function getSession(): Promise<HeliosSession | null> {
  try {
    const session = await authClient.getSession();

    if (!session?.data?.session || !session?.data?.user) {
      return null;
    }

    // Map to our extended user type
    const user = session.data.user as any;

    return {
      session: {
        id: session.data.session.id,
        userId: session.data.session.userId,
        expiresAt: new Date(session.data.session.expiresAt),
        ipAddress: session.data.session.ipAddress,
        userAgent: session.data.session.userAgent,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isExternalAdmin: user.isExternalAdmin,
        defaultView: user.defaultView,
        isActive: user.isActive,
        department: user.department,
      },
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Email/password sign in
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Success status and error message if failed
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  error?: string;
  user?: HeliosUser;
}> {
  try {
    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Sign in failed',
      };
    }

    // Get the full session with user details
    const session = await getSession();

    return {
      success: true,
      user: session?.user,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<{ success: boolean }> {
  try {
    await signOut();
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false };
  }
}

/**
 * Export the full client for advanced use cases
 */
export default authClient;
