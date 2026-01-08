"use client";

/**
 * Admin Panel Page
 * Protected admin interface for user management.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { useState, useEffect, useCallback } from "react";
import RouteGuard from "../../../components/RouteGuard";
import Navbar from "../../../components/Navbar";
import Background from "../../../components/Background";
import PrimaryButton from "../../../components/PrimaryButton";
import { get, post, put, del, ApiError } from "../../lib/apiClient";
import styles from "./admin.module.css";

/**
 * User Management Admin Panel
 * Displays list of users and provides CRUD operations
 */
function AdminPanel() {
  // User list state
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    roles: ["ROLE_USER"],
  });
  const [createError, setCreateError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Password reset modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Role management modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [roleError, setRoleError] = useState(null);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success message state
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Fetches the list of users from the backend
   * Requirement 6.1: Display list of all users
   */
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await get("/admin/users");
      setUsers(response.users || response || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /**
   * Creates a new user
   * Requirement 6.2: Create new user
   */
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      await post("/admin/users", createForm);
      setSuccessMessage("User created successfully");
      setShowCreateModal(false);
      setCreateForm({ username: "", password: "", roles: ["ROLE_USER"] });
      await fetchUsers();
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : "Failed to create user",
      );
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Resets a user's password
   * Requirement 6.3: Reset user password
   */
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!passwordResetUser) return;

    setIsResettingPassword(true);
    setPasswordError(null);

    try {
      await put(`/admin/users/${passwordResetUser.id}/password`, {
        newPassword: newPassword,
      });
      setSuccessMessage("Password reset successfully");
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : "Failed to reset password",
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  /**
   * Updates a user's roles
   * Requirement 6.4: Assign roles to user
   */
  const handleRoleUpdate = async (e) => {
    e.preventDefault();
    if (!roleEditUser) return;

    setIsUpdatingRoles(true);
    setRoleError(null);

    try {
      await put(`/admin/users/${roleEditUser.id}/roles`, {
        roles: selectedRoles,
      });
      setSuccessMessage("Roles updated successfully");
      setShowRoleModal(false);
      setRoleEditUser(null);
      setSelectedRoles([]);
      await fetchUsers();
    } catch (err) {
      setRoleError(
        err instanceof ApiError ? err.message : "Failed to update roles",
      );
    } finally {
      setIsUpdatingRoles(false);
    }
  };

  /**
   * Toggles a user's enabled status
   * Requirement 6.5: Disable/enable user
   */
  const handleToggleStatus = async (user) => {
    try {
      await put(`/admin/users/${user.id}/status`, {
        enabled: !user.enabled,
      });
      setSuccessMessage(
        `User ${user.enabled ? "disabled" : "enabled"} successfully`,
      );
      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to update user status",
      );
    }
  };

  /**
   * Deletes a user
   * Requirement 6.5: Delete user
   */
  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);
    try {
      await del(`/admin/users/${deleteUser.id}`);
      setSuccessMessage("User deleted successfully");
      setShowDeleteConfirm(false);
      setDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  // Modal openers
  const openPasswordModal = (user) => {
    setPasswordResetUser(user);
    setNewPassword("");
    setPasswordError(null);
    setShowPasswordModal(true);
  };

  const openRoleModal = (user) => {
    setRoleEditUser(user);
    setSelectedRoles([...user.roles]);
    setRoleError(null);
    setShowRoleModal(true);
  };

  const openDeleteConfirm = (user) => {
    setDeleteUser(user);
    setShowDeleteConfirm(true);
  };

  // Role checkbox handler
  const handleRoleToggle = (role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  // Create form role toggle
  const handleCreateRoleToggle = (role) => {
    setCreateForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  return (
    <div className={styles.adminPage}>
      <div className={styles.pageBackground}>
        <Background />
      </div>

      <Navbar />

      <div className={styles.adminContainer}>
        <h1 className={styles.title}>User Management</h1>

        {/* Success Message */}
        {successMessage && (
          <div className={styles.successMessage}>{successMessage}</div>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button
              className={styles.dismissButton}
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Bar */}
        <div className={styles.actionBar}>
          <PrimaryButton onClick={() => setShowCreateModal(true)}>
            Create User
          </PrimaryButton>
          <PrimaryButton onClick={fetchUsers} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </PrimaryButton>
        </div>

        {/* User List */}
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <span className={styles.loadingText}>Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>No users found</div>
        ) : (
          <div className={styles.userList}>
            {users.map((user) => (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  <span className={styles.username}>{user.username}</span>
                  <div className={styles.roleTags}>
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className={`${styles.roleTag} ${
                          role === "ROLE_ADMIN" ? styles.adminRole : ""
                        }`}
                      >
                        {role.replace("ROLE_", "")}
                      </span>
                    ))}
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      user.enabled ? styles.enabled : styles.disabled
                    }`}
                  >
                    {user.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className={styles.userActions}>
                  <button
                    className={styles.actionButton}
                    onClick={() => openPasswordModal(user)}
                    title="Reset Password"
                  >
                    Reset Password
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => openRoleModal(user)}
                    title="Manage Roles"
                  >
                    Roles
                  </button>
                  <button
                    className={`${styles.actionButton} ${
                      user.enabled ? styles.disableButton : styles.enableButton
                    }`}
                    onClick={() => handleToggleStatus(user)}
                    title={user.enabled ? "Disable User" : "Enable User"}
                  >
                    {user.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={() => openDeleteConfirm(user)}
                    title="Delete User"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Create New User</h2>
            <form onSubmit={handleCreateUser} className={styles.form}>
              {createError && (
                <div className={styles.modalError}>{createError}</div>
              )}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="create-username">
                  Username
                </label>
                <input
                  id="create-username"
                  type="text"
                  className={styles.input}
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  required
                  disabled={isCreating}
                  autoComplete="off"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="create-password">
                  Password
                </label>
                <input
                  id="create-password"
                  type="password"
                  className={styles.input}
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  required
                  disabled={isCreating}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Roles</label>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes("ROLE_USER")}
                      onChange={() => handleCreateRoleToggle("ROLE_USER")}
                      disabled={isCreating}
                    />
                    <span>USER</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes("ROLE_ADMIN")}
                      onChange={() => handleCreateRoleToggle("ROLE_ADMIN")}
                      disabled={isCreating}
                    />
                    <span>ADMIN</span>
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <PrimaryButton type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create User"}
                </PrimaryButton>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && passwordResetUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Reset Password</h2>
            <p className={styles.modalSubtitle}>
              Resetting password for:{" "}
              <strong>{passwordResetUser.username}</strong>
            </p>
            <form onSubmit={handlePasswordReset} className={styles.form}>
              {passwordError && (
                <div className={styles.modalError}>{passwordError}</div>
              )}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isResettingPassword}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.modalActions}>
                <PrimaryButton type="submit" disabled={isResettingPassword}>
                  {isResettingPassword ? "Resetting..." : "Reset Password"}
                </PrimaryButton>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isResettingPassword}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {showRoleModal && roleEditUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Manage Roles</h2>
            <p className={styles.modalSubtitle}>
              Editing roles for: <strong>{roleEditUser.username}</strong>
            </p>
            <form onSubmit={handleRoleUpdate} className={styles.form}>
              {roleError && (
                <div className={styles.modalError}>{roleError}</div>
              )}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Roles</label>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("ROLE_USER")}
                      onChange={() => handleRoleToggle("ROLE_USER")}
                      disabled={isUpdatingRoles}
                    />
                    <span>USER</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("ROLE_ADMIN")}
                      onChange={() => handleRoleToggle("ROLE_ADMIN")}
                      disabled={isUpdatingRoles}
                    />
                    <span>ADMIN</span>
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <PrimaryButton type="submit" disabled={isUpdatingRoles}>
                  {isUpdatingRoles ? "Updating..." : "Update Roles"}
                </PrimaryButton>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowRoleModal(false)}
                  disabled={isUpdatingRoles}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Confirm Delete</h2>
            <p className={styles.modalSubtitle}>
              Are you sure you want to delete user{" "}
              <strong>{deleteUser.username}</strong>?
            </p>
            <p className={styles.warningText}>This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Admin Page wrapped with RouteGuard requiring ROLE_ADMIN
 * Requirement 6.1: Admin panel accessible only to users with ROLE_ADMIN
 */
export default function AdminPage() {
  return (
    <RouteGuard requiredRoles={["ROLE_ADMIN"]} fallbackPath="/">
      <AdminPanel />
    </RouteGuard>
  );
}
