"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import DailyProgressBar from "@/components/DailyProgressBar";
import DailyTasksModal from "@/components/DailyTasksModal";
import TaskToggle from "@/components/TaskToggle";
import TaskContainer from "@/components/TaskContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTaskManager } from "@/hooks/useTaskManager";
import { useDailyTaskManager } from "@/hooks/useDailyTaskManager";
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

  // Daily task management
  const {
    dailyTasks,
    progressPercentage,
    toggleTask,
    addTask: addDailyTask,
  } = useDailyTaskManager();

  // Modal open/close state
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

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
          <DailyProgressBar 
            percentage={progressPercentage} 
            onClick={handleOpenModal}
            isClickable={true}
          />
        </ErrorBoundary>

        <ErrorBoundary title="Daily Tasks Modal Error">
          <DailyTasksModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            tasks={dailyTasks}
            onToggleTask={toggleTask}
            onAddTask={addDailyTask}
          />
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
