# Requirements Document

## Introduction

This feature adds the ability to move files and folders within the MyDrive page. Users can drag and drop items into destination folders within the current view, or onto breadcrumb segments to move items up the folder hierarchy. A confirmation modal prompts the user before executing the move. The feature uses the existing backend move endpoint and respects the same permission model already in place for uploads and deletes (e.g., mediaCache is read-only).

## Glossary

- **Drive_Page**: The MyDrive page component that displays drive contents, breadcrumbs, and toolbars
- **Drive_Item**: A file or folder object stored in the drive, identified by a unique ID
- **File_Grid**: The grid component that renders Drive_Items as cards in the current folder
- **Breadcrumb_Bar**: The navigation bar showing the current folder path from root to the active folder
- **Move_Confirmation_Modal**: A dialog that asks the user to confirm or cancel a move operation before it executes
- **Drive_Service**: The client-side service module that makes API calls to the backend
- **Drag_Source**: The Drive_Item currently being dragged by the user
- **Drop_Target**: The folder card or breadcrumb segment that a Drag_Source is dropped onto
- **Media_Cache**: A read-only drive where users cannot create, delete, upload, or move items

## Requirements

### Requirement 1: Drag and Drop Items onto Folder Cards

**User Story:** As a user, I want to drag files and folders onto other folder cards in the File_Grid, so that I can move items into those folders.

#### Acceptance Criteria

1. WHEN a user initiates a drag on a Drive_Item card, THE Drive_Page SHALL begin a drag operation carrying the Drag_Source item ID and name.
2. WHEN a Drag_Source is dragged over a folder card in the File_Grid, THE File_Grid SHALL visually highlight that folder card as a valid Drop_Target.
3. WHEN a Drag_Source is dropped onto a folder card, THE Drive_Page SHALL open the Move_Confirmation_Modal displaying the Drag_Source name and the Drop_Target folder name.
4. WHEN a Drag_Source is dragged over a file card (non-folder), THE File_Grid SHALL NOT highlight that card as a valid Drop_Target.
5. WHEN a Drag_Source is dropped onto a non-folder card or empty space, THE Drive_Page SHALL cancel the drop and take no action.
6. WHEN a user drags a folder over itself, THE Drive_Page SHALL NOT treat that folder as a valid Drop_Target.

### Requirement 2: Drag and Drop Items onto Breadcrumb Segments

**User Story:** As a user, I want to drag files and folders onto breadcrumb segments, so that I can move items to parent folders higher in the hierarchy.

#### Acceptance Criteria

1. WHEN a Drag_Source is dragged over a breadcrumb segment in the Breadcrumb_Bar, THE Breadcrumb_Bar SHALL visually highlight that segment as a valid Drop_Target.
2. WHEN a Drag_Source is dropped onto a breadcrumb segment, THE Drive_Page SHALL open the Move_Confirmation_Modal displaying the Drag_Source name and the breadcrumb folder name.
3. WHEN a Drag_Source is dragged over the current folder breadcrumb segment (the last segment), THE Breadcrumb_Bar SHALL NOT highlight it as a valid Drop_Target because the item is already in that folder.

### Requirement 3: Move Confirmation Modal

**User Story:** As a user, I want to confirm or cancel a move operation before it executes, so that I can avoid accidental moves.

#### Acceptance Criteria

1. WHEN the Move_Confirmation_Modal is open, THE Move_Confirmation_Modal SHALL display the message "Are you sure you want to move {item name} to {destination folder name}?".
2. WHEN the user clicks "Yes" in the Move_Confirmation_Modal, THE Drive_Page SHALL call the Drive_Service move endpoint and close the modal.
3. WHEN the user clicks "Cancel" in the Move_Confirmation_Modal, THE Drive_Page SHALL close the modal and take no further action.
4. WHEN the Move_Confirmation_Modal is open, THE Move_Confirmation_Modal SHALL close when the user presses the Escape key.
5. THE Move_Confirmation_Modal SHALL match the existing visual style of the delete ConfirmModal component.

### Requirement 4: Move API Integration

**User Story:** As a user, I want the move operation to persist on the backend, so that my file organization is saved.

#### Acceptance Criteria

1. WHEN the user confirms a move, THE Drive_Service SHALL send a PUT request to `/users/{userId}/drives/{driveKey}/items/{itemId}/move` with the destination folder ID as `parentId` in the request body.
2. WHEN the backend returns a successful response (200), THE Drive_Page SHALL update the local drive data by removing the item from its old parent's children, adding the returned item to the destination folder's children, and updating the item entry using the new ID from the response.
3. WHEN the backend returns a 404 error, THE Drive_Page SHALL display the message "This item no longer exists." and refresh the drive contents.
4. WHEN the backend returns a 409 error, THE Drive_Page SHALL display the message "An item with that name already exists in the destination folder, or the move would create a circular reference.".
5. WHEN the backend returns a 400 error, THE Drive_Page SHALL display the message "The root folder cannot be moved.".
6. WHEN the backend returns a 403 error, THE Drive_Page SHALL display the message "You do not have permission to move this item.".
7. IF the moved item was a folder and the user is currently viewing a descendant of that folder, THEN THE Drive_Page SHALL navigate to the current folder's nearest valid ancestor after the local state update.

### Requirement 5: Permission Enforcement

**User Story:** As a user, I want the move feature to respect drive permissions, so that read-only drives remain protected.

#### Acceptance Criteria

1. WHILE the active drive is Media_Cache, THE Drive_Page SHALL disable all drag-and-drop move interactions.
2. WHILE the active drive is Media_Cache, THE File_Grid SHALL NOT allow any Drive_Item to be dragged.
3. WHILE the active drive is Media_Cache, THE Breadcrumb_Bar SHALL NOT accept any drop events.

### Requirement 6: Drag Visual Feedback

**User Story:** As a user, I want clear visual feedback during drag operations, so that I can see what I am moving and where I can drop it.

#### Acceptance Criteria

1. WHEN a drag operation is in progress, THE Drag_Source card SHALL appear visually dimmed to indicate it is being moved.
2. WHEN a valid Drop_Target folder card is hovered during a drag, THE Drop_Target card SHALL display a highlighted border or background to indicate it accepts the drop.
3. WHEN a valid Drop_Target breadcrumb segment is hovered during a drag, THE Drop_Target segment SHALL display a highlighted style to indicate it accepts the drop.
4. WHEN the drag operation ends (drop or cancel), THE Drive_Page SHALL remove all drag-related visual indicators.
