/**
 * Navbar Component Tests
 *
 * Property-based tests for admin UI visibility
 * Feature: user-authentication, Property 8: Admin UI Hidden From Non-Admins
 * Validates: Requirements 3.3
 */

import React from "react";
import { test, fc } from "@fast-check/jest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Create a mutable mock state object
let mockAuthState = {
  isAuthenticated: false,
  username: null,
  roles: [],
  isLoading: false,
};

// Mock the AuthContext module
jest.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    ...mockAuthState,
    login: jest.fn(),
    logout: jest.fn(),
    hasRole: (role) => mockAuthState.roles.includes(role),
    isAdmin: () => mockAuthState.roles.includes("ROLE_ADMIN"),
  }),
  AuthProvider: ({ children }) => children,
}));

// Import Navbar after mocking
import Navbar from "../../components/Navbar";

describe("Navbar Admin UI Visibility", () => {
  afterEach(() => {
    // Clean up DOM after each test
    cleanup();
  });

  beforeEach(() => {
    // Reset mock state before each test
    mockAuthState = {
      isAuthenticated: false,
      username: null,
      roles: [],
      isLoading: false,
    };
  });

  /**
   * Property 8: Admin UI Hidden From Non-Admins
   *
   * For any user without ROLE_ADMIN in their roles array, admin-only UI elements
   * (admin navigation links, admin panel access) should not be rendered or visible.
   *
   * Validates: Requirements 3.3
   */
  test.prop(
    [
      fc.boolean(), // isAuthenticated
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_GUEST", "ROLE_VIEWER"), {
        maxLength: 3,
      }), // non-admin roles
    ],
    { numRuns: 100 },
  )(
    "Feature: user-authentication, Property 8: Admin UI Hidden From Non-Admins - non-admin users should not see admin link",
    (isAuthenticated, nonAdminRoles) => {
      // Clean up any previous renders
      cleanup();

      // Setup: User without ROLE_ADMIN
      mockAuthState = {
        isAuthenticated,
        username: isAuthenticated ? "testuser" : null,
        roles: nonAdminRoles,
        isLoading: false,
      };

      // Render the Navbar
      render(<Navbar />);

      // Assert: Admin link should NOT be visible for non-admin users
      const adminLinks = screen.queryAllByTitle("Admin Panel");
      expect(adminLinks).toHaveLength(0);

      // Also check that "Admin Panel" text is not in the mobile menu
      const adminPanelTexts = screen.queryAllByText("Admin Panel");
      expect(adminPanelTexts).toHaveLength(0);
    },
  );

  test.prop(
    [
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_GUEST"), {
        minLength: 0,
        maxLength: 2,
      }), // additional roles
    ],
    { numRuns: 100 },
  )(
    "Feature: user-authentication, Property 8: Admin UI Hidden From Non-Admins - admin users should see admin link",
    (additionalRoles) => {
      // Clean up any previous renders
      cleanup();

      // Setup: User WITH ROLE_ADMIN
      mockAuthState = {
        isAuthenticated: true,
        username: "adminuser",
        roles: ["ROLE_ADMIN", ...additionalRoles],
        isLoading: false,
      };

      // Render the Navbar
      render(<Navbar />);

      // Assert: Admin link SHOULD be visible for admin users (at least one - desktop version)
      const adminLinks = screen.getAllByTitle("Admin Panel");
      expect(adminLinks.length).toBeGreaterThan(0);
    },
  );

  test.prop(
    [
      fc.boolean(), // isAuthenticated
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_GUEST", "ROLE_VIEWER"), {
        maxLength: 3,
      }), // non-admin roles
    ],
    { numRuns: 100 },
  )(
    "Feature: user-authentication, Property 8: Logout button visibility matches authentication state",
    (isAuthenticated, roles) => {
      // Clean up any previous renders
      cleanup();

      // Setup
      mockAuthState = {
        isAuthenticated,
        username: isAuthenticated ? "testuser" : null,
        roles,
        isLoading: false,
      };

      // Render the Navbar
      render(<Navbar />);

      // Assert: Logout button should only be visible when authenticated
      const logoutButtons = screen.queryAllByTitle("Logout");

      if (isAuthenticated) {
        expect(logoutButtons.length).toBeGreaterThan(0);
      } else {
        expect(logoutButtons).toHaveLength(0);
      }
    },
  );
});
