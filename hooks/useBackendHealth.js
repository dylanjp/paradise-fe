import { useState, useEffect, useCallback } from "react";
import apiClient from "@/src/lib/apiClient";

/**
 * Custom hook for backend health check functionality
 * Checks the /heartbeat endpoint to determine if the backend is operational
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.4
 *
 * @returns {Object} Health check state and actions
 * @returns {boolean|null} isHealthy - null = checking, true = healthy, false = down
 * @returns {boolean} isLoading - true while initial health check is in progress
 * @returns {boolean} isRetrying - true while retry is in progress
 * @returns {Function} checkHealth - Function to trigger health check
 * @returns {Function} retry - Function to retry health check
 */
export function useBackendHealth() {
  const [isHealthy, setIsHealthy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Performs the health check by calling the /heartbeat endpoint
   * Sets isHealthy to true on 200 OK, false on any error or non-200 response
   */
  const checkHealth = useCallback(async () => {
    try {
      await apiClient.get("/heartbeat");
      // 200 OK response - backend is healthy
      setIsHealthy(true);
    } catch {
      // Non-200 response or network error - backend is down
      setIsHealthy(false);
    }
  }, []);

  /**
   * Retries the health check
   * Sets isRetrying to true during the retry attempt
   */
  const retry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await checkHealth();
    } finally {
      setIsRetrying(false);
    }
  }, [checkHealth]);

  // Auto-call checkHealth on mount
  useEffect(() => {
    const performInitialCheck = async () => {
      await checkHealth();
      setIsLoading(false);
    };

    performInitialCheck();
  }, [checkHealth]);

  return {
    isHealthy,
    isLoading,
    isRetrying,
    checkHealth,
    retry,
  };
}

export default useBackendHealth;
