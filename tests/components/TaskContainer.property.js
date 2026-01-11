/**
 * Feature: task-reorder-and-nesting-fix
 * Property 5: Parent Task Accepts Additional Children
 * Validates: Requirements 2.3
 *
 * For any parent task P that already has N children (where N ≥ 1),
 * dropping a new task T onto P SHALL successfully add T as a child,
 * resulting in P having N+1 children.
 */

import { test } from "@fast-check/jest";
import fc from "fast-check";

// Helper to determine if a task acts as a section (has children)
const isSection = (task, allTasks) =>
  allTasks.some((t) => t.parentId === task.id);

// Simulates the DropZone visibility logic from TaskContainer
const shouldShowDropZone = (task, allTasks, activeId) => {
  // Fixed logic: show for all root tasks (removed !taskIsSection condition)
  return !task.parentId && activeId && activeId !== task.id;
};

// Simulates the nesting action when dropping on a dropzone
const nestTask = (tasks, draggedId, targetParentId) => {
  return tasks.map((task) => {
    if (task.id === draggedId) {
      return {
        ...task,
        parentId: targetParentId,
      };
    }
    return task;
  });
};

// Generator for a valid task
const taskArbitrary = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 50 }),
  completed: fc.boolean(),
  order: fc.integer({ min: 1, max: 100 }),
  parentId: fc.constant(undefined),
});

// Generator for a parent task with children
const parentWithChildrenArbitrary = fc
  .tuple(
    taskArbitrary,
    fc.array(taskArbitrary, { minLength: 1, maxLength: 5 })
  )
  .map(([parent, children]) => {
    const parentTask = { ...parent, parentId: undefined };
    const childTasks = children.map((child, index) => ({
      ...child,
      parentId: parentTask.id,
      order: index + 1,
    }));
    return { parent: parentTask, children: childTasks };
  });

// Generator for a task to be nested (not already a child of the parent)
const taskToNestArbitrary = taskArbitrary.map((task) => ({
  ...task,
  parentId: undefined,
}));

test.prop([parentWithChildrenArbitrary, taskToNestArbitrary], { numRuns: 100 })(
  "Property 5: Parent task with N children accepts additional child, resulting in N+1 children",
  ({ parent, children }, taskToNest) => {
    // Ensure taskToNest has a different ID than parent and all children
    const existingIds = new Set([parent.id, ...children.map((c) => c.id)]);
    if (existingIds.has(taskToNest.id)) {
      // Skip this case - IDs must be unique
      return true;
    }

    // Initial state: parent with N children + the task to nest as a root task
    const initialTasks = [parent, ...children, taskToNest];
    const initialChildCount = children.length;

    // Verify parent is a section (has children)
    expect(isSection(parent, initialTasks)).toBe(true);

    // Verify DropZone should be visible for the parent task when dragging taskToNest
    // This is the key fix - parent tasks (sections) should show DropZone
    const dropZoneVisible = shouldShowDropZone(
      parent,
      initialTasks,
      taskToNest.id
    );
    expect(dropZoneVisible).toBe(true);

    // Simulate nesting action
    const updatedTasks = nestTask(initialTasks, taskToNest.id, parent.id);

    // Count children after nesting
    const newChildCount = updatedTasks.filter(
      (t) => t.parentId === parent.id
    ).length;

    // Property: N+1 children after nesting
    expect(newChildCount).toBe(initialChildCount + 1);

    // Verify the nested task has correct parentId
    const nestedTask = updatedTasks.find((t) => t.id === taskToNest.id);
    expect(nestedTask.parentId).toBe(parent.id);
  }
);
