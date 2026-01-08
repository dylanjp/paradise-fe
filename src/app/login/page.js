"use client";

/**
 * Login Page Component
 * Provides a login form with Tron retro styling for user authentication.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getRedirectDestination } from "../../../components/RouteGuard";
import styles from "./login.module.css";

/**
 * Login page with Tron retro styling
 * Requirement 4.1: Display username and password input fields with Tron retro styling
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const destination = getRedirectDestination() || "/";
      router.push(destination);
    }
  }, [isAuthenticated, authLoading, router]);

  /**
   * Handle form submission
   * Requirement 4.2: Display loading indicator during submission
   * Requirement 4.3: Display generic error message on failure
   * Requirement 4.4: Redirect to intended destination or home on success
   */
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      // Clear previous errors
      setError(null);

      // Validate inputs
      if (!username.trim() || !password) {
        setError("Please enter both username and password");
        return;
      }

      // Start submission
      setIsSubmitting(true);

      try {
        const result = await login(username.trim(), password);

        if (result.success) {
          // Requirement 4.4: Redirect to intended destination or home on success
          const destination = getRedirectDestination() || "/";
          router.push(destination);
        } else {
          // Requirement 4.3: Display generic error message
          // The AuthContext already returns generic messages
          setError(result.error || "Invalid username or password");
        }
      } catch {
        // Requirement 4.3: Generic error message for unexpected errors
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, password, login, router],
  );

  /**
   * Handle Enter key press for form submission
   * Requirement 4.5: Support keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !isSubmitting) {
        handleSubmit(e);
      }
    },
    [handleSubmit, isSubmitting],
  );

  // Show nothing while checking auth state
  if (authLoading) {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginContainer}>
          <h1 className={styles.title}>Loading...</h1>
        </div>
      </div>
    );
  }

  // Don't render form if already authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <h1 className={styles.title}>Login</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Error message display */}
          {error && (
            <div
              className={styles.errorContainer}
              role="alert"
              aria-live="polite"
            >
              <p className={styles.errorMessage}>{error}</p>
            </div>
          )}

          {/* Username input */}
          <div className={styles.inputGroup}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter username"
              disabled={isSubmitting}
              autoComplete="username"
              autoFocus
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
            />
          </div>

          {/* Password input */}
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter password"
              disabled={isSubmitting}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className={styles.loading}>
                <span className={styles.spinner} aria-hidden="true" />
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
