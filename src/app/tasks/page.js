"use client";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import DailyProgressBar from "@/components/DailyProgressBar";
import TaskToggle from "@/components/TaskToggle";
import TaskContainer from "@/components/TaskContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTaskManager } from "@/hooks/useTaskManager"; 
import styles from "./tasks.module.css";

// Initial Data passed in at top level
const INITIAL_TASKS = {
  personal: [
    { id: '1', description: 'Review morning routine', category: 'personal', completed: false, order: 1 },
    { id: '2', description: 'HEALTH & FITNESS', category: 'personal', completed: false, order: 2 }, 
    { id: '3', description: 'Go for morning walk', category: 'personal', completed: false, order: 1, parentId: '2' },
    { id: '4', description: 'Drink 8 glasses of water', category: 'personal', completed: false, order: 2, parentId: '2' },
  ],
  work: [
    { id: '9', description: 'Complete project documentation', category: 'work', completed: false, order: 1 },
    { id: '10', description: 'CODE REVIEW TASKS', category: 'work', completed: false, order: 2 }, 
    { id: '11', description: 'Review pull request #123', category: 'work', completed: false, order: 1, parentId: '10' },
  ]
};

// Simple clamp function replacing the complex validator
const clampProgress = (val) => Math.max(0, Math.min(100, Number(val) || 0));

export default function TasksPage() {
  const { 
    currentTasks, 
    activeCategory, 
    newTaskId,
    setCategory, 
    addTask, 
    completeTask, 
    reorderTasks, 
    renameTask 
  } = useTaskManager(INITIAL_TASKS);

  const dailyProgress = clampProgress(77); 
  const pageTitle = `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} TODO`;

  return (
    <div className={styles.page}>
      <div className={styles.pageBackground}>
        <Background />
      </div>

      <Navbar />

      <div className={styles.pageContent}>
        <h1 className={styles.title}>Tasks</h1>
        
        <ErrorBoundary title="Menu Error">
          <TaskToggle 
            activeCategory={activeCategory}
            onCategoryChange={setCategory}
          />
        </ErrorBoundary>

        <ErrorBoundary title="Progress Error">
          <DailyProgressBar percentage={dailyProgress} />
        </ErrorBoundary>

        <ErrorBoundary title="Task List Error">
          <TaskContainer
            title={pageTitle}
            tasks={currentTasks}
            onTaskComplete={completeTask}
            onTaskReorder={reorderTasks}
            onTaskRename={renameTask}
            onAddTask={() => addTask('')}
            newTaskId={newTaskId}
          />
          
          {/* Empty State Handling */}
          {currentTasks.length === 0 && (
            <div className={styles.emptyState}>
              <p>No tasks yet. Add one to get started!</p>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}