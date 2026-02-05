/**
 * Rate Limiting Utility
 * Prevents API abuse by limiting requests per IP/user
 */

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Max requests per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (for production, use Redis)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Strict limits for auth endpoints
  login: { interval: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  createLogin: { interval: 60 * 60 * 1000, maxRequests: 10 }, // 10 per hour

  // Medium limits for uploads
  upload: { interval: 60 * 1000, maxRequests: 20 }, // 20 per minute

  // Generous limits for read operations
  api: { interval: 60 * 1000, maxRequests: 100 }, // 100 per minute

  // Very strict for password reset
  passwordReset: { interval: 60 * 60 * 1000, maxRequests: 3 }, // 3 per hour
} as const;

/**
 * Check if request is rate limited
 * @param identifier - Usually IP address or user ID
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const key = identifier;

  let entry = store.get(key);

  // Create new entry or reset if interval passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.interval,
    };
    store.set(key, entry);
  }

  // Increment counter
  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const reset = entry.resetTime;
  const retryAfter = allowed ? undefined : Math.ceil((reset - now) / 1000);

  return { allowed, remaining, reset, retryAfter };
}

/**
 * Get client identifier from request
 * Uses IP address or user ID
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string
): Promise<Response | null> {
  const identifier = getClientIdentifier(request, userId);
  const { allowed, remaining, reset, retryAfter } = checkRateLimit(identifier, config);

  // Add rate limit headers
  const headers = new Headers({
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  });

  if (!allowed) {
    headers.set('Retry-After', retryAfter!.toString());
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please try again later.',
        retryAfter: retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...Object.fromEntries(headers),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null; // Allow request
}

/**
 * Clear rate limit for a specific identifier (useful for testing)
 */
export function clearRateLimit(identifier: string): void {
  store.delete(identifier);
}

/**
 * Get current rate limit status for identifier
 */
export function getRateLimitStatus(identifier: string, config: RateLimitConfig): {
  count: number;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const entry = store.get(identifier);
  const now = Date.now();

  if (!entry || now > entry.resetTime) {
    return {
      count: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.interval,
    };
  }

  return {
    count: entry.count,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}
