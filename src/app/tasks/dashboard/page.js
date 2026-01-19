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

  // Extract available years from completion data
  const availableYears = useMemo(() => {
    const years = extractYears(completions);
    // Always include current year if no completions
    if (years.length === 0) {
      return [new Date().getFullYear()];
    }
    return years;
  }, [completions]);

  // Filter completions by selected year for chart
  const filteredCompletions = useMemo(() => {
    return completions.filter((date) => {
      const year = new Date(date).getFullYear();
      return year === selectedYear;
    });
  }, [completions, selectedYear]);

  // Fetch completions when task selection changes
  useEffect(() => {
    if (!selectedTaskId || !userId) {
      setCompletions([]);
      setCompletionsError(null);
      return;
    }

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
                  onSelect={setSelectedYear}
                />
              </div>

              {/* Error Display for Completions */}
              {completionsError && (
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

              {/* Loading Completions State */}
              {isLoadingCompletions && (
                <div className={styles.loadingContainer}>
                  <span className={styles.loadingText}>Loading completion history...</span>
                </div>
              )}

              {/* Empty State - No task selected */}
              {!selectedTaskId && !isLoadingCompletions && (
                <div className={styles.emptyState}>
                  <p>Select a task above to view its completion history</p>
                </div>
              )}

              {/* Contribution Chart */}
              {selectedTaskId && !isLoadingCompletions && !completionsError && (
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
