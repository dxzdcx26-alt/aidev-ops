"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/shared";
import { Zap, Lock, User, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";

/**
 * Login View — production-grade login UI.
 *
 * Security properties preserved:
 *   - Session-based auth (HttpOnly, Secure, SameSite cookies)
 *   - Server-side password verification (scrypt)
 *   - Rate limiting (middleware, 5/min for /api/auth/login)
 *   - No client-side credential storage
 *   - Generic error messages (never reveals whether username or password was wrong)
 *
 * UI improvements:
 *   - Empty username/password by default (no "admin" placeholder)
 *   - No implementation details exposed (removed "check server logs" text)
 *   - Password show/hide toggle
 *   - Loading state with disabled submit (prevents double-submit)
 *   - Enter key submission (native form behavior)
 *   - Accessible labels and ARIA attributes
 *   - Responsive (mobile + desktop)
 *   - Cyberpunk dark visual language preserved
 */

type ErrorCode = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "SESSION_EXPIRED" | "SERVER_UNAVAILABLE" | "MISSING_FIELDS";

type ErrorInfo = {
  code: ErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

/**
 * Map HTTP response to a user-facing error.
 * Per spec: "Never reveal whether the username or password specifically was incorrect."
 * All auth failures return the same generic message.
 */
function mapError(status: number, data: { error?: string; code?: string; retryAfterMs?: number }): ErrorInfo | null {
  // Rate limited (429) — from middleware
  if (status === 429) {
    const retryAfter = data.retryAfterMs ? Math.ceil(data.retryAfterMs / 1000) : undefined;
    return {
      code: "RATE_LIMITED",
      message: retryAfter
        ? `Too many attempts. Please try again in ${retryAfter} seconds.`
        : "Too many attempts. Please try again later.",
      retryAfterSeconds: retryAfter,
    };
  }

  // Missing fields (400)
  if (status === 400) {
    return {
      code: "MISSING_FIELDS",
      message: "Please enter both username and password.",
    };
  }

  // Invalid credentials (401) — generic message, never reveals which field is wrong
  if (status === 401) {
    // Check if it's session expiry (AUTH_INVALID from middleware) or invalid login
    if (data.code === "AUTH_INVALID") {
      return {
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      };
    }
    return {
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password.",
    };
  }

  // Server error (5xx)
  if (status >= 500) {
    return {
      code: "SERVER_UNAVAILABLE",
      message: "The server is temporarily unavailable. Please try again in a moment.",
    };
  }

  // Fallback
  if (status !== 200) {
    return {
      code: "SERVER_UNAVAILABLE",
      message: "Unable to sign in. Please try again.",
    };
  }

  return null;
}

export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Focus username field on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double-submit
    if (loading) return;

    // Client-side validation — empty fields
    if (!username.trim() || !password) {
      setError({
        code: "MISSING_FIELDS",
        message: "Please enter both username and password.",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorInfo = mapError(res.status, data);
        if (errorInfo) {
          setError(errorInfo);
          // Clear password field on any auth error (security best practice)
          setPassword("");
        } else {
          setError({
            code: "SERVER_UNAVAILABLE",
            message: "Unable to sign in. Please try again.",
          });
          setPassword("");
        }
        return;
      }

      // Success — call onLogin callback
      onLogin();
    } catch {
      // Network error / server unreachable
      setError({
        code: "SERVER_UNAVAILABLE",
        message: "Unable to connect to the server. Please check your connection and try again.",
      });
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center neon-purple mb-3">
            <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-center">
            Aidev Ops
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            AI Dev V4 · sign in to continue
          </p>
        </div>

        <GlassCard className="p-5 sm:p-6" glow="purple">
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in form">
            {/* Username field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-mono uppercase tracking-wide">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder=""
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={loading}
                  className="pl-10 font-mono"
                  aria-required="true"
                  aria-invalid={error?.code === "INVALID_CREDENTIALS" || error?.code === "MISSING_FIELDS"}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
            </div>

            {/* Password field with show/hide toggle */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wide">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="pl-10 pr-10 font-mono"
                  aria-required="true"
                  aria-invalid={error?.code === "INVALID_CREDENTIALS" || error?.code === "MISSING_FIELDS"}
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                id="login-error"
                role="alert"
                aria-live="assertive"
                className={`p-3 rounded-md border text-xs flex items-start gap-2 ${
                  error.code === "RATE_LIMITED"
                    ? "bg-warning/10 border-warning/30 text-warning"
                    : error.code === "SESSION_EXPIRED"
                    ? "bg-info/10 border-info/30 text-info"
                    : error.code === "SERVER_UNAVAILABLE"
                    ? "bg-warning/10 border-warning/30 text-warning"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error.message}</span>
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span>Sign In</span>
                </>
              )}
            </Button>
          </form>

          {/* Security footer — no implementation details exposed */}
          <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            <span>Secure session authentication</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
