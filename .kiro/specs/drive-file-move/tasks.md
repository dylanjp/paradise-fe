# Implementation Plan: Drive File Move

## Overview

Add drag-and-drop move functionality to the MyDrive page using the HTML5 Drag and Drop API. Implementation follows the existing top-down data flow: DrivePage owns all state and passes drag/drop handlers down to DriveItemCard and BreadcrumbBar. The existing ConfirmModal is generalized to support both delete and move confirmation. The driveService gets a new `moveItem` function calling the backend PUT endpoint.

## Tasks

- [x] 1. Add `moveItem` function to driveService and update error messages
  - Add `moveItem(userId, driveKey, itemId, parentId)` to `src/lib/driveService.js` that sends a PUT request to `/users/{userId}/drives/{driveKey}/items/{itemId}/move` with `{ parentId }` body
  - Update `ERROR_MESSAGES` map: change `DRIVE_ITEM_CONFLICT` to the move-specific message ("An item with that name already exists in the destination folder, or the move would create a circular reference."), add `DRIVE_ROOT_MOVE` ("The root folder cannot be moved."), and add `DRIVE_ACCESS_DENIED` ("You do not have permission to move this item.")
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Generalize ConfirmModal to support move confirmation
  - [x] 2.1 Update ConfirmModal component to accept optional `title`, `message`, and `confirmLabel` props
    - Add `title` prop (default: `"Confirm Delete"`), `message` prop (default: existing delete message using `itemName`), and `confirmLabel` prop (default: `"Delete"`)
    - Replace hardcoded title, message, and button label with the prop values
    - Keep full backward compatibility with existing delete usage (all new props are optional with defaults)
    - _Requirements: 3.1, 3.4, 3.5_

  - [x] 2.2 Add `confirmButton` CSS class to ConfirmModal.module.css
    - Add a `.confirmButton` class styled identically to `.deleteButton` for use by the move confirmation
    - _Requirements: 3.5_

- [x] 3. Add drag-and-drop CSS classes for visual feedback
  - [x] 3.1 Add drag visual styles to DriveItemCard.module.css
    - Add `.dragging` class that dims the card (e.g., `opacity: 0.4`) to indicate the item is being moved
    - Add `.dragOver` class that highlights the card border/background (e.g., `border-color: #ff6600; box-shadow: 0 0 15px #ff6600`) to indicate a valid drop target
    - _Requirements: 6.1, 6.2_

  - [x] 3.2 Add drag-over highlight style to BreadcrumbBar.module.css
    - Add `.dragOver` class on breadcrumb segments (e.g., `background: rgba(255, 102, 0, 0.2); border-radius: 4px; color: #ff6600`) to indicate a valid drop target
    - _Requirements: 6.3_

- [x] 4. Implement drag source and drop target behavior on DriveItemCard
  - Add `draggable`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop`, `isDragOver`, and `isDragging` props to DriveItemCard
  - Set `draggable` attribute on the card div based on the `draggable` prop
  - Attach `onDragStart` handler that sets `e.dataTransfer` with item ID and name
  - Attach `onDragOver` handler that calls `e.preventDefault()` only for valid folder targets (not self, not files)
  - Attach `onDragLeave` and `onDrop` handlers
  - Apply `.dragging` CSS class when `isDragging` is true
  - Apply `.dragOver` CSS class when `isDragOver` is true
  - _Requirements: 1.1, 1.2, 1.4, 6.1, 6.2, 6.4_

- [x] 5. Implement drop target behavior on BreadcrumbBar
  - Add `onSegmentDragOver`, `onSegmentDragLeave`, `onSegmentDrop`, `dragOverSegmentId`, and `isMediaCache` props to BreadcrumbBar
  - Attach `onDragOver`, `onDragLeave`, and `onDrop` handlers to each breadcrumb segment (both buttons and the current span)
  - Do not allow drops on the last segment (current folder) — skip `e.preventDefault()` in `onDragOver` for the last segment
  - Do not attach any drop handlers when `isMediaCache` is true
  - Apply `.dragOver` CSS class to the segment matching `dragOverSegmentId`
  - _Requirements: 2.1, 2.2, 2.3, 5.3, 6.3, 6.4_

- [x] 6. Checkpoint
  - Ensure all component changes compile without errors, ask the user if questions arise.

- [x] 7. Wire drag-and-drop state and handlers into DrivePage
  - [x] 7.1 Add drag state and handler functions to DrivePage
    - Add `dragSourceId` state (`useState(null)`) and `moveConfirm` state (`useState(null)` with shape `{ itemId, itemName, destinationId, destinationName }`)
    - Implement `handleDragStart(e, itemId)` — sets `dragSourceId`, writes item ID and name to `e.dataTransfer.setData`
    - Implement `handleDragEnd()` — clears `dragSourceId`
    - Implement `handleDropOnFolder(destinationId)` — validates the drop (source exists, destination is a folder, not self), reads item name and folder name from `driveData`, sets `moveConfirm`
    - Implement `handleDropOnBreadcrumb(segmentId, segmentName)` — validates the drop (source exists, segment is not current folder), sets `moveConfirm`
    - Implement `cancelMove()` — clears `moveConfirm`
    - _Requirements: 1.1, 1.3, 1.5, 1.6, 2.2, 5.1, 5.2_

  - [x] 7.2 Implement `confirmMove` handler with API call and local state update
    - Call `driveService.moveItem(username, activeDrive, moveConfirm.itemId, moveConfirm.destinationId)`
    - On success: remove old item ID from old parent's children, delete old item entry (and descendants if folder), add new item to destination folder's children, set new item entry in driveData using the response
    - On 404: show "This item no longer exists." and call `refreshDriveContents()`
    - On 409: show "An item with that name already exists in the destination folder, or the move would create a circular reference."
    - On 400: show "The root folder cannot be moved."
    - On 403: show "You do not have permission to move this item."
    - If the moved item was a folder and `currentFolderId` is no longer in `driveData` after the update, navigate to the nearest valid ancestor using `buildBreadcrumbPath`
    - Clear `moveConfirm` after the operation
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 7.3 Pass drag/drop props to FileGrid, DriveItemCard, and BreadcrumbBar
    - Pass `dragSourceId`, `isMediaCache`, and drag handler callbacks to FileGrid
    - FileGrid manages `dragOverItemId` state and passes per-card `isDragging`, `isDragOver`, `draggable`, and drag event handlers to each DriveItemCard
    - Pass `onSegmentDragOver`, `onSegmentDragLeave`, `onSegmentDrop`, `dragOverSegmentId`, and `isMediaCache` to BreadcrumbBar
    - _Requirements: 1.2, 2.1, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 7.4 Render move ConfirmModal in DrivePage
    - Add a second ConfirmModal instance (or conditionally render) for move confirmation with `title="Confirm Move"`, `message="Are you sure you want to move {itemName} to {destinationName}?"`, `confirmLabel="Yes"`, `onConfirm={confirmMove}`, `onCancel={cancelMove}`
    - Ensure the existing delete ConfirmModal continues to work unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. Update FileGrid to thread drag/drop props to DriveItemCard
  - Accept `dragSourceId`, `isMediaCache`, and drag handler callbacks from DrivePage
  - Add local `dragOverItemId` state to track which folder card is currently hovered
  - For each DriveItemCard: set `draggable={!isMediaCache}`, compute `isDragging` (item.id === dragSourceId), compute `isDragOver` (item.id === dragOverItemId), and wire `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop` handlers
  - Only allow `onDragOver` to set `dragOverItemId` for folder items that are not the drag source
  - Clear `dragOverItemId` on `onDragLeave` and `onDrop`
  - _Requirements: 1.2, 1.4, 1.5, 1.6, 5.1, 5.2, 6.1, 6.2, 6.4_

- [x] 9. Final checkpoint
  - Ensure all components compile and wire together correctly, ask the user if questions arise.

## Notes

- This project does not use a testing framework — correctness is verified through manual testing and code review
- Each task references specific requirements for traceability
- The existing ConfirmModal delete usage must remain backward-compatible after generalization
- Item IDs are path-based and change after a move — the local state update must handle old ID removal and new ID insertion
