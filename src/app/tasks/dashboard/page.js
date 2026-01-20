"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import RouteGuard from "@/components/RouteGuard";
import TaskSelector from "@/components/TaskSelector";
import YearSelector from "@/components/YearSelector";
import ContributionChart from "@/components/ContributionChart";
import { useAuth } from "@/src/context/AuthContext";
import { useDailyTaskManager } from "@/hooks/useDailyTaskManager";
import { TaskService } from "@/src/lib/taskService";
import { extractYears } from "@/src/lib/chartUtils";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  // Auth context for userId
  const { username, isLoading: isAuthLoading } = useAuth();

  // Only use the userId once auth has finished loading
  const userId = isAuthLoading
    ? null
    : username || process.env.NEXT_PUBLIC_PARADISE_USER_ID || "default-user";

  // Daily tasks from existing hook
  const {
    dailyTasks,
    isLoading: isTasksLoading,
    error: tasksError,
  } = useDailyTaskManager(userId);

  // Dashboard-specific state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [completions, setCompletions] = useState([]);
  const [isLoadingCompletions, setIsLoadingCompletions] = useState(false);
  const [completionsError, setCompletionsError] = useState(null);

  // Perfect days state - Requirements: 1.1, 1.3, 5.1
  // View mode: 'perfect-days' (default) or 'task-completions'
  const [viewMode, setViewMode] = useState('perfect-days');
  const [perfectDays, setPerfectDays] = useState([]);
  const [isLoadingPerfectDays, setIsLoadingPerfectDays] = useState(false);
  const [perfectDaysError, setPerfectDaysError] = useState(null);

  // Extract available years - Requirements: 3.2
  // For perfect-days mode, provide a reasonable historical range (current year + 4 previous years)
  // For task-completions mode, use years from completion data
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    if (viewMode === 'perfect-days') {
      // Provide a reasonable historical range for perfect days view
      // Current year plus 4 previous years (5 years total)
      const historicalRange = [];
      for (let i = 0; i < 5; i++) {
        historicalRange.push(currentYear - i);
      }
      return historicalRange;
    } else {
      // For task completions, use years from the data
      const years = extractYears(completions);
      // Always include current year if no data
      if (years.length === 0) {
        return [currentYear];
      }
      return years;
    }
  }, [completions, viewMode]);

  // Fetch perfect days for a given year - Requirements: 1.1, 5.1
  const fetchPerfectDays = useCallback(async (userIdParam, year) => {
    if (!userIdParam) return;

    setIsLoadingPerfectDays(true);
    setPerfectDaysError(null);

    try {
      const data = await TaskService.getPerfectDays(userIdParam, year);
      setPerfectDays(data || []);
    } catch (error) {
      setPerfectDaysError(error.message);
      setPerfectDays([]);
    } finally {
      setIsLoadingPerfectDays(false);
    }
  }, []);

  // Filter completions by selected year for chart
  const filteredCompletions = useMemo(() => {
    return completions.filter((date) => {
      const year = new Date(date).getFullYear();
      return year === selectedYear;
    });
  }, [completions, selectedYear]);

  // Filter perfect days by selected year for chart
  const filteredPerfectDays = useMemo(() => {
    return perfectDays.filter((date) => {
      const year = new Date(date).getFullYear();
      return year === selectedYear;
    });
  }, [perfectDays, selectedYear]);

  // Fetch perfect days when year changes in perfect-days mode - Requirements: 3.1, 3.3
  // Also fetch on initial mount when userId becomes available
  useEffect(() => {
    if (!userId) return;
    
    // Only fetch perfect days when in perfect-days view mode
    // This ensures we fetch when:
    // 1. Component mounts (viewMode defaults to 'perfect-days')
    // 2. User changes year while in perfect-days mode
    // 3. User switches back to perfect-days mode (handled by task selection effect)
    if (viewMode === 'perfect-days') {
      fetchPerfectDays(userId, selectedYear);
    }
  }, [userId, fetchPerfectDays, selectedYear, viewMode]);

  // Fetch completions when task selection changes
  // Also switch view mode based on task selection - Requirements: 1.3
  useEffect(() => {
    if (!selectedTaskId || !userId) {
      setCompletions([]);
      setCompletionsError(null);
      // Switch to perfect-days view when no task is selected
      setViewMode('perfect-days');
      return;
    }

    // Switch to task-completions view when a task is selected
    setViewMode('task-completions');

    const fetchCompletions = async () => {
      setIsLoadingCompletions(true);
      setCompletionsError(null);

      try {
        const data = await TaskService.getDailyTaskCompletions(userId, selectedTaskId);
        setCompletions(data || []);
        
        // Update selected year to most recent year with data
        const years = extractYears(data || []);
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0]);
        }
      } catch (error) {
        setCompletionsError(error.message);
        setCompletions([]);
      } finally {
        setIsLoadingCompletions(false);
      }
    };

    fetchCompletions();
  }, [selectedTaskId, userId]);

  // Retry handler for failed operations
  const handleRetryCompletions = useCallback(() => {
    if (selectedTaskId && userId) {
      setCompletionsError(null);
      // Trigger re-fetch by toggling task selection
      const taskId = selectedTaskId;
      setSelectedTaskId(null);
      setTimeout(() => setSelectedTaskId(taskId), 0);
    }
  }, [selectedTaskId, userId]);

  // Retry handler for perfect days - Requirements: 5.2, 5.3
  const handleRetryPerfectDays = useCallback(() => {
    setPerfectDaysError(null);
    fetchPerfectDays(userId, selectedYear);
  }, [userId, selectedYear, fetchPerfectDays]);

  // Year selection handler - Requirements: 3.1
  // Maintains year selection when switching between view modes
  const handleYearSelect = useCallback((year) => {
    setSelectedYear(year);
    // The useEffect will handle fetching perfect days when in perfect-days mode
  }, []);

  // Combined loading state
  const isLoading = isAuthLoading || isTasksLoading;

  // Get selected task description for display
  const selectedTask = dailyTasks.find((t) => t.id === selectedTaskId);

  return (
    <RouteGuard>
      <div className={styles.page}>
        <div className={styles.pageBackground}>
          <Background />
        </div>

        <Navbar />

        <div className={styles.pageContent}>
          <h1 className={styles.title}>Daily Task Dashboard</h1>

          {/* Error Display for Tasks */}
          {tasksError && (
            <div className={styles.errorContainer}>
              <h3 className={styles.errorTitle}>Error Loading Tasks</h3>
              <p className={styles.errorMessage}>{tasksError}</p>
              <button
                className={styles.retryButton}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className={styles.loadingContainer}>
              <span className={styles.loadingText}>Loading tasks...</span>
            </div>
          )}

          {/* Main Content - only show when not loading */}
          {!isLoading && !tasksError && (
            <>
              {/* Selectors Row */}
              <div className={styles.selectorsRow}>
                <TaskSelector
                  tasks={dailyTasks}
                  selectedId={selectedTaskId}
                  onSelect={setSelectedTaskId}
                />
                <YearSelector
                  years={availableYears}
                  selected={selectedYear}
                  onSelect={handleYearSelect}
                />
              </div>

              {/* Error Display for Completions */}
              {completionsError && viewMode === 'task-completions' && (
                <div className={styles.errorContainer}>
                  <h3 className={styles.errorTitle}>Error Loading Completion History</h3>
                  <p className={styles.errorMessage}>{completionsError}</p>
                  <button
                    className={styles.retryButton}
                    onClick={handleRetryCompletions}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Error Display for Perfect Days - Requirements: 5.2 */}
              {perfectDaysError && viewMode === 'perfect-days' && (
                <div className={styles.errorContainer}>
                  <h3 className={styles.errorTitle}>Error Loading Perfect Days</h3>
                  <p className={styles.errorMessage}>{perfectDaysError}</p>
                  <button
                    className={styles.retryButton}
                    onClick={handleRetryPerfectDays}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading Completions State */}
              {isLoadingCompletions && viewMode === 'task-completions' && (
                <div className={styles.loadingContainer}>
                  <span className={styles.loadingText}>Loading completion history...</span>
                </div>
              )}

              {/* Loading Perfect Days State - Requirements: 5.1 */}
              {isLoadingPerfectDays && viewMode === 'perfect-days' && (
                <div className={styles.loadingContainer}>
                  <span className={styles.loadingText}>Loading perfect days...</span>
                </div>
              )}

              {/* Perfect Days Chart - Requirements: 1.1, 1.2, 1.4 */}
              {viewMode === 'perfect-days' && !isLoadingPerfectDays && !perfectDaysError && (
                <div className={styles.chartSection}>
                  <h2 className={styles.chartTitle}>Perfect Days</h2>
                  <ContributionChart
                    year={selectedYear}
                    completionDates={filteredPerfectDays}
                  />
                  <div className={styles.chartStats}>
                    <span className={styles.statItem}>
                      {filteredPerfectDays.length} perfect days in {selectedYear}
                    </span>
                  </div>
                </div>
              )}

              {/* Task Completions Chart */}
              {viewMode === 'task-completions' && selectedTaskId && !isLoadingCompletions && !completionsError && (
                <div className={styles.chartSection}>
                  {selectedTask && (
                    <h2 className={styles.chartTitle}>{selectedTask.description}</h2>
                  )}
                  <ContributionChart
                    year={selectedYear}
                    completionDates={filteredCompletions}
                  />
                  <div className={styles.chartStats}>
                    <span className={styles.statItem}>
                      {filteredCompletions.length} completions in {selectedYear}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
