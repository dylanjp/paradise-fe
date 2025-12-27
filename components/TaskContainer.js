import React, { useState, useCallback, useMemo } from 'react';
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TaskRow from './TaskRow';
import AddTaskButtons from './AddTaskButtons';
import { validateComponentProps, validateTaskArray, handleEmptyState } from '../src/lib/taskStateValidation';
import styles from './TaskContainer.module.css';

// Helper functions for hierarchical task relationships
const isSection = (task, allTasks) => {
  return allTasks.some(t => t.parentId === task.id);
};

// DropZone component for visual drop feedback
const DropZone = ({ taskId, isVisible }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropzone-${taskId}`,
  });

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div 
      ref={setNodeRef}
      className={`${styles.dropZone} ${isOver ? styles.dropZoneActive : ''}`}
    >
      <div className={styles.dropZoneContent}>
        <span className={styles.dropZoneText}>Drop here to make it a child task</span>
      </div>
    </div>
  );
};

const TaskContainer = ({ 
  title, 
  tasks = [], 
  onTaskComplete, 
  onTaskReorder, 
  onTaskRename,
  onAddTask,
  newTaskId,
  className = '' 
}) => {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Longer delay to distinguish from scrolling
        tolerance: 5, // Smaller tolerance for easier activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Validate props first
  const propsValidation = validateComponentProps(
    { title, tasks, onTaskComplete, onTaskReorder, className },
    ['title', 'tasks']
  );

  // Validate tasks array and memoize valid tasks
  const tasksValidation = validateTaskArray(tasks);
  
  // Use only valid tasks - memoized to prevent unnecessary re-renders
  const validTasks = useMemo(() => {
    return tasksValidation.validTasks || [];
  }, [tasksValidation.validTasks]);

  // Create items array that includes both tasks and drop zones - MUST be before early returns
  const allItems = useMemo(() => {
    const items = [...validTasks.map(task => task.id)];
    // Add drop zone IDs for root tasks that aren't sections
    validTasks.forEach(task => {
      if (!task.parentId && !isSection(task, validTasks)) {
        items.push(`dropzone-${task.id}`);
      }
    });
    return items;
  }, [validTasks]);

  // Define callbacks after validation but before early returns
  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    // Reset drag state
    setActiveId(null);

    if (!active || !over || active.id === over.id) {
      return;
    }

    const draggedTaskId = active.id;
    let targetTaskId = over.id;
    
    // Check if we're dropping into a drop zone
    const isDropZoneDrop = over.id && over.id.toString().includes('dropzone-');
    let actualTargetTaskId = targetTaskId;
    
    if (isDropZoneDrop) {
      // Extract the parent task ID from the drop zone ID
      actualTargetTaskId = over.id.toString().replace('dropzone-', '');
    }
    
    const draggedTask = validTasks.find(task => task.id === draggedTaskId);
    const targetTask = validTasks.find(task => task.id === actualTargetTaskId);
    
    if (!draggedTask) {
      console.error('TaskContainer: Could not find dragged task', { draggedTaskId });
      return;
    }
    
    if (!targetTask) {
      console.error('TaskContainer: Could not find target task', { targetTaskId, actualTargetTaskId, isDropZoneDrop });
      return;
    }

    // Check if dragged task is a section
    const draggedIsSection = isSection(draggedTask, validTasks);
    
    // Prevent sections from being dragged under other parents
    if (draggedIsSection && targetTask.parentId) {
      console.log('TaskContainer: Prevented dragging section under another parent');
      return;
    }

    const oldIndex = validTasks.findIndex(task => task.id === draggedTaskId);
    const newIndex = validTasks.findIndex(task => task.id === actualTargetTaskId);
    
    // Determine new parent relationship
    let newParentId = draggedTask.parentId; // Keep current parent by default
    
    if (isDropZoneDrop) {
      // Dropping into a drop zone - make it a child of the target task
      if (targetTask && !targetTask.parentId && !draggedIsSection) {
        newParentId = actualTargetTaskId;
        console.log('TaskContainer: Making task a child via drop zone', { draggedTaskId, newParentId });
      }
    } else {
      // Regular drop logic (more conservative)
      if (!draggedIsSection) {
        // Case 1: Dragging onto a child task - become a sibling
        if (targetTask.parentId) {
          newParentId = targetTask.parentId;
        }
        // Case 2: Dragging a child task onto a root task - remove from parent (make it root)
        else if (draggedTask.parentId && !targetTask.parentId) {
          newParentId = null;
        }
        // Case 3: Root to root - keep as root
        else if (!draggedTask.parentId && !targetTask.parentId) {
          newParentId = null;
        }
      } else {
        // Sections always stay at root level
        newParentId = null;
      }
    }

    // For drop zone drops, we don't need to reorder, just change parent
    let reorderedTasks;
    if (isDropZoneDrop) {
      // Just update the parent, don't change order
      reorderedTasks = validTasks.map(task => {
        if (task.id === draggedTaskId) {
          return {
            ...task,
            parentId: newParentId || undefined
          };
        }
        return task;
      });
    } else {
      // Perform the basic reorder
      reorderedTasks = arrayMove(validTasks, oldIndex, newIndex);
      
      // Update the dragged task's parent
      reorderedTasks = reorderedTasks.map(task => {
        if (task.id === draggedTaskId) {
          return {
            ...task,
            parentId: newParentId || undefined
          };
        }
        return task;
      });
    }

    // Rebuild in proper hierarchical order
    const finalTasks = [];
    const processedIds = new Set();
    
    // Process root tasks and their children
    reorderedTasks.forEach(task => {
      if (!task.parentId && !processedIds.has(task.id)) {
        // Add root task
        finalTasks.push(task);
        processedIds.add(task.id);
        
        // Add all children of this root task
        const children = reorderedTasks
          .filter(t => t.parentId === task.id)
          .sort((a, b) => {
            // Maintain relative order from the updated list
            const aIndex = reorderedTasks.findIndex(t => t.id === a.id);
            const bIndex = reorderedTasks.findIndex(t => t.id === b.id);
            return aIndex - bIndex;
          });
        
        children.forEach(child => {
          if (!processedIds.has(child.id)) {
            finalTasks.push(child);
            processedIds.add(child.id);
          }
        });
      }
    });
    
    // Update order values
    let rootOrder = 1;
    const finalTasksWithOrder = finalTasks.map(task => {
      if (!task.parentId) {
        return { ...task, order: rootOrder++ };
      } else {
        const siblings = finalTasks.filter(t => t.parentId === task.parentId);
        const siblingIndex = siblings.findIndex(s => s.id === task.id);
        return { ...task, order: siblingIndex + 1 };
      }
    });
    
    // Validate the reordered tasks
    const reorderValidation = validateTaskArray(finalTasksWithOrder);
    if (!reorderValidation.isValid) {
      console.error('TaskContainer: Reordered tasks validation failed', reorderValidation.errors);
      return;
    }

    if (onTaskReorder) {
      onTaskReorder(finalTasksWithOrder);
    }
  }, [validTasks, onTaskReorder]);

  const handleTaskComplete = useCallback((taskId) => {
    try {
      // Validate taskId before calling the handler
      if (!taskId || typeof taskId !== 'string') {
        console.error('TaskContainer: Invalid task ID for completion', { taskId });
        return;
      }

      // Verify task exists
      const taskExists = validTasks.some(task => task.id === taskId);
      if (!taskExists) {
        console.error('TaskContainer: Attempted to complete non-existent task', { taskId });
        return;
      }

      if (onTaskComplete) {
        onTaskComplete(taskId);
      }
    } catch (error) {
      console.error('TaskContainer: Error during task completion:', error);
    }
  }, [validTasks, onTaskComplete]);

  // Handle validation errors
  if (!propsValidation.isValid) {
    console.error('TaskContainer props validation failed:', propsValidation.errors);
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.errorState}>
          <p className={styles.errorText}>Invalid component configuration</p>
        </div>
      </div>
    );
  }

  if (!tasksValidation.isValid) {
    console.error('TaskContainer received invalid tasks:', tasksValidation.errors);
  }

  const emptyState = handleEmptyState(validTasks, 'tasks');

  return (
    <div className={`${styles.container} ${className}`}>
      <h2 className={styles.title}>{title || 'Tasks'}</h2>
      
      {emptyState.isEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>{emptyState.message}</p>
          <p className={styles.emptySubtext}>{emptyState.suggestion}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allItems} strategy={verticalListSortingStrategy}>
            <div className={styles.taskList}>
              {validTasks.map((task) => {
                const taskIsSection = isSection(task, validTasks);
                const indentLevel = task.parentId ? 1 : 0;
                const isNewTask = newTaskId === task.id;
                
                return (
                  <div key={task.id} className={styles.taskWrapper}>
                    <TaskRow
                      task={task}
                      onComplete={handleTaskComplete}
                      onRename={onTaskRename}
                      isSection={taskIsSection}
                      indentLevel={indentLevel}
                      isNewTask={isNewTask}
                    />
                    {/* Static drop zone for root tasks that aren't sections */}
                    {!task.parentId && !taskIsSection && activeId && activeId !== task.id && (
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
                  task={validTasks.find(t => t.id === activeId)}
                  onComplete={() => {}}
                  onRename={() => {}}
                  isSection={isSection(validTasks.find(t => t.id === activeId), validTasks)}
                  indentLevel={0}
                  isNewTask={false}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      
      {/* Add task buttons at the bottom - always show regardless of empty state */}
      <AddTaskButtons
        onAddTask={onAddTask}
      />
    </div>
  );
};

export default TaskContainer;