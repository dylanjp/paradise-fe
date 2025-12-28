import React, { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import TaskRow from "./TaskRow";
import AddTaskButtons from "./AddTaskButtons";
import styles from "./TaskContainer.module.css";

// Helper to determine if a task acts as a section (has children)
const isSection = (task, allTasks) =>
  allTasks.some((t) => t.parentId === task.id);

// Simplified DropZone for hierarchical nesting
const DropZone = ({ taskId, isVisible }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `dropzone-${taskId}` });
  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={`${styles.dropZone} ${isOver ? styles.dropZoneActive : ""}`}
    >
      <div className={styles.dropZoneContent}>
        <span className={styles.dropZoneText}>Drop here to nest task</span>
      </div>
    </div>
  );
};

const TaskContainer = ({
  title = "Tasks",
  tasks = [],
  onTaskComplete,
  onTaskReorder,
  onTaskRename,
  onAddTask,
  newTaskId,
  className = "",
}) => {
  const [activeId, setActiveId] = useState(null);

  // Configuration for various input types
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Dnd-kit requires a flat list of IDs for the SortableContext
  const sortableIds = useMemo(() => {
    const ids = tasks.map((t) => t.id);
    // Add virtual IDs for drop zones to allow nesting
    tasks.forEach((t) => {
      if (!t.parentId && !isSection(t, tasks)) ids.push(`dropzone-${t.id}`);
    });
    return ids;
  }, [tasks]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id;
    const overId = over.id.toString();
    const isNestingAction = overId.includes("dropzone-");
    const targetId = isNestingAction ? overId.replace("dropzone-", "") : overId;

    const oldIndex = tasks.findIndex((t) => t.id === draggedId);
    const newIndex = tasks.findIndex((t) => t.id === targetId);

    // 1. Calculate new task order
    let updatedTasks = arrayMove(tasks, oldIndex, newIndex);

    // 2. Update parent/child relationships
    updatedTasks = updatedTasks.map((task) => {
      if (task.id === draggedId) {
        const targetTask = tasks.find((t) => t.id === targetId);
        return {
          ...task,
          // If dropped on a dropzone, nest it. If dropped on a root, make it root.
          parentId: isNestingAction
            ? targetId
            : targetTask?.parentId || undefined,
        };
      }
      return task;
    });

    onTaskReorder(updatedTasks);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <h2 className={styles.title}>{title}</h2>

      {tasks.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No tasks yet</p>
          <p className={styles.emptySubtext}>Add a task to get started</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.taskList}>
              {tasks.map((task) => {
                const taskIsSection = isSection(task, tasks);
                return (
                  <div key={task.id} className={styles.taskWrapper}>
                    <TaskRow
                      task={task}
                      onComplete={onTaskComplete}
                      onRename={onTaskRename}
                      isSection={taskIsSection}
                      indentLevel={task.parentId ? 1 : 0}
                      isNewTask={newTaskId === task.id}
                    />
                    {/* Nesting Helper: Only show for root tasks that aren't already sections */}
                    {!task.parentId &&
                      !taskIsSection &&
                      activeId &&
                      activeId !== task.id && (
                        <DropZone taskId={task.id} isVisible={true} />
                      )}
                  </div>
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <div className={styles.dragOverlay}>
                <TaskRow
                  task={tasks.find((t) => t.id === activeId)}
                  isOverlay
                  indentLevel={0}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <AddTaskButtons onAddTask={onAddTask} />
    </div>
  );
};

export default TaskContainer;
