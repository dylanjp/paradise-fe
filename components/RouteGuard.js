"use client";

/**
 * Route Guard Component
 * Protects routes by checking authentication and authorization status.
 *
 * Requirements: 3.2, 3.4, 8.3
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../src/context/AuthContext";

// Key for storing intended destination in sessionStorage
const REDIRECT_KEY = "auth_redirect_destination";

/**
 * Stores the intended destination for post-login redirect
 * Requirement 8.3: Preserve intended destination for post-login redirect
 * @param {string} path - The path to store
 */
export function setRedirectDestination(path) {
  if (typeof window !== "undefined" && path && path !== "/login") {
    sessionStorage.setItem(REDIRECT_KEY, path);
  }
}

/**
 * Gets and clears the stored redirect destination
 * @returns {string|null} The stored path or null
 */
export function getRedirectDestination() {
  if (typeof window !== "undefined") {
    const destination = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return destination;
  }
  return null;
}

/**
 * RouteGuard component for protecting routes
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authorized
 * @param {string[]} [props.requiredRoles] - Optional array of roles required to access the route
 * @param {string} [props.fallbackPath="/"] - Path to redirect to if unauthorized (has auth but lacks roles)
 * @param {string} [props.loginPath="/login"] - Path to redirect to if unauthenticated
 */
export default function RouteGuard({
  children,
  requiredRoles = [],
  fallbackPath = "/",
  loginPath = "/login",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, roles } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Wait for auth state to load
    if (isLoading) {
      return;
    }

    // Check if user is authenticated
    // Requirement 3.2: Redirect unauthenticated users to login
    if (!isAuthenticated) {
      // Requirement 8.3: Preserve intended destination for post-login redirect
      setRedirectDestination(pathname);
      setAuthorized(false);
      router.push(loginPath);
      return;
    }

    // Check if user has required roles
    // Requirement 3.2: Redirect users without required roles
    // Requirement 3.4: Allow users with ROLE_ADMIN to access admin routes
    if (requiredRoles.length > 0) {
      // Check roles directly instead of using hasRole callback to avoid stale closure
      const hasAllRequiredRoles = requiredRoles.every((role) =>
        roles.includes(role),
      );

      if (!hasAllRequiredRoles) {
        setAuthorized(false);
        router.push(fallbackPath);
        return;
      }
    }

    // User is authenticated and has required roles
    setAuthorized(true);
  }, [
    isAuthenticated,
    isLoading,
    roles,
    requiredRoles,
    router,
    pathname,
    fallbackPath,
    loginPath,
  ]);

  // Show nothing while loading or checking authorization
  if (isLoading || !authorized) {
    return null;
  }

  // Render children if authorized
  return <>{children}</>;
}

/**
 * Higher-order component version of RouteGuard
 * Useful for wrapping page components
 *
 * @param {React.ComponentType} WrappedComponent - Component to wrap
 * @param {object} options - Guard options
 * @param {string[]} [options.requiredRoles] - Required roles
 * @param {string} [options.fallbackPath] - Fallback path for unauthorized
 * @param {string} [options.loginPath] - Login path for unauthenticated
 * @returns {React.ComponentType} Wrapped component with route guard
 */
export function withRouteGuard(WrappedComponent, options = {}) {
  const {
    requiredRoles = [],
    fallbackPath = "/",
    loginPath = "/login",
  } = options;

  return function GuardedComponent(props) {
    return (
      <RouteGuard
        requiredRoles={requiredRoles}
        fallbackPath={fallbackPath}
        loginPath={loginPath}
      >
        <WrappedComponent {...props} />
      </RouteGuard>
    );
  };
}
