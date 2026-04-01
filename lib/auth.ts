import { sql } from './db';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(
  process.env.STACK_SECRET_SERVER_KEY || 'fallback-secret-key-change-in-production'
);

const COOKIE_NAME = 'auth-token';

export interface SessionPayload {
  userId: string;
  email: string;
  workspaceId?: string;
  iat: number;
  exp: number;
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Create JWT token
export async function createToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 24 * 60 * 60) // 24 hours
    .sign(SECRET_KEY);
  
  return token;
}

// Verify JWT token
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, SECRET_KEY);
    const payload = verified.payload as SessionPayload;
    
    // Check if user has been force logged out
    if (payload.userId) {
      const forceLogoutUser = await sql`
        SELECT force_logout_at FROM users WHERE id = ${payload.userId}
      `;
      
      if (forceLogoutUser.length > 0 && forceLogoutUser[0].force_logout_at) {
        const forceLogoutTime = new Date(forceLogoutUser[0].force_logout_at).getTime() / 1000;
        if (payload.iat < forceLogoutTime) {
          // Token was issued before force logout, invalidate it
          console.log('[v0] Token invalidated due to user force logout');
          return null;
        }
      }
      
      // Check global force logout
      try {
        const globalSettings = await sql`
          SELECT setting_value FROM system_settings WHERE setting_key = 'force_logout_at'
        `;
        
        if (globalSettings.length > 0 && globalSettings[0].setting_value?.timestamp) {
          const globalForceLogoutTime = new Date(globalSettings[0].setting_value.timestamp).getTime() / 1000;
          if (payload.iat < globalForceLogoutTime) {
            // Token was issued before global force logout, invalidate it
            console.log('[v0] Token invalidated due to global force logout');
            return null;
          }
        }
      } catch {
        // Global settings table might not exist yet, continue
      }
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

// Set auth cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });
}

// Get session from cookie
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  return verifyToken(token);
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Register new user
export async function registerUser(
  email: string,
  password: string,
  name: string,
  companyName: string
) {
  try {
    const hashedPassword = await hashPassword(password);
    
    // Create user in database (we'll store password in auth_passwords table)
    const result = await sql`
      INSERT INTO users (id, email, name, company_name, role, subscription_tier, subscription_status)
      VALUES (gen_random_uuid(), ${email}, ${name}, ${companyName}, 'owner', 'free', 'active')
      RETURNING id, email, name, company_name
    `;
    
    if (result.length === 0) {
      throw new Error('Failed to create user');
    }

    const user = result[0];

    // Store password separately for security
    await sql`
      INSERT INTO auth_passwords (user_id, password_hash)
      VALUES (${user.id}, ${hashedPassword})
    `;

    return { success: true, user };
  } catch (error: any) {
    if (error.message.includes('duplicate key')) {
      return { success: false, error: 'Email already exists' };
    }
    return { success: false, error: error.message };
  }
}

// Login user
export async function loginUser(email: string, password: string) {
  try {
    const result = await sql`
      SELECT u.id, u.email, u.name, ap.password_hash
      FROM users u
      LEFT JOIN auth_passwords ap ON u.id = ap.user_id
      WHERE u.email = ${email} AND u.deleted_at IS NULL
    `;

    if (result.length === 0) {
      return { success: false, error: 'Invalid email or password' };
    }

    const user = result[0];
    const passwordMatch = await verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      return { success: false, error: 'Invalid email or password' };
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
    });

    return { success: true, token, user: { id: user.id, email: user.email, name: user.name } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get user by ID
export async function getUserById(userId: string) {
  try {
    const result = await sql`
      SELECT * FROM users WHERE id = ${userId} AND deleted_at IS NULL
    `;

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    return null;
  }
}

// Create session (wrapper for createToken)
export async function createSession(userId: string): Promise<string> {
  return createToken({ userId, email: '' });
}

// Verify session (wrapper for verifyToken)
export async function verifySession(token: string): Promise<string | null> {
  const payload = await verifyToken(token);
  return payload?.userId || null;
}
