# Implementation Plan: Drive File Browser

## Overview

Transform the existing Pratt Drive page from a project-card layout into a Google Drive-like file browser with multiple drive support and item deletion. Implementation proceeds bottom-up: mock data and utility functions first, then individual components, then wiring everything together in the page. All components use Next.js App Router with `"use client"`, React hooks, CSS Modules, and the Tron Ares theme.

## Tasks

- [x] 1. Create mock data and utility functions
  - [x] 1.1 Create the mock drive data file at `data/driveData.js`
    - Define the flat map structure keyed by item ID
    - Include root folder with children: Documents (blue), Music (purple), Videos (orange), Photos (green) folders, plus loose files (report.pdf, notes.doc, readme.txt)
    - Documents folder contains: budget.pdf, proposal.doc, spreadsheet.xlsx
    - Music folder contains: track1.mp3, track2.mp3
    - Videos folder contains: demo.mp4
    - Photos folder contains: vacation.jpg, screenshot.png
    - Include at least two levels of nesting depth
    - Include folders with different custom colors
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 1.2 Create a utility helper file at `src/lib/driveUtils.js`
    - `getIconForType(type, fileType)` — returns the correct react-icons/fa icon component and default color based on item type and file extension
    - `getFileExtension(filename)` — extracts extension from a filename string
    - `generateId()` — generates a simple unique ID for new items
    - `buildBreadcrumbPath(driveData, folderId)` — walks up parentId chain to build the breadcrumb array from root to current folder
    - _Requirements: 1.5, 1.3, 3.3_

- [x] 2. Build the Toolbar component
  - [x] 2.1 Create `components/DriveToolbar.js` and `components/DriveToolbar.module.css`
    - Render "New Folder" button, "Upload File" button on the left
    - Render "Upload Video to Plex" button on the right
    - Use PrimaryButton styling pattern (black bg, red border, orange hover glow)
    - Accept `onNewFolder`, `onUploadFile`, `onPlexUpload` props
    - _Requirements: 2.1, 3.1, 5.1_

- [x] 3. Build the BreadcrumbBar component
  - [x] 3.1 Create `components/BreadcrumbBar.js` and `components/BreadcrumbBar.module.css`
    - Render path segments separated by " > "
    - Each segment except the last is clickable and calls `onNavigate(folderId)`
    - Last segment is styled as current (non-clickable, brighter color)
    - TechMono font, red text, orange hover on clickable segments
    - _Requirements: 1.3, 1.4_

- [x] 4. Build the DriveItemCard component
  - [x] 4.1 Create `components/DriveItemCard.js` and `components/DriveItemCard.module.css`
    - Render icon (from `getIconForType`), item name, and file size (for files)
    - Folder icons use the folder's `color` property
    - Card styling: black bg, red border, glow on hover, fadeInUp animation
    - Accept `item`, `onClick`, `onContextMenu` props
    - Double-click or single-click on folders triggers navigation
    - Right-click on folders triggers context menu
    - _Requirements: 1.5, 1.6, 4.1_

- [x] 5. Build the ContextMenu and ColorPicker components
  - [x] 5.1 Create `components/DriveContextMenu.js` and `components/DriveContextMenu.module.css`
    - Positioned absolutely at the right-click coordinates
    - Shows "Change Color" option
    - Closes on click outside or Escape key
    - Black bg, red border styling
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 Create `components/ColorPicker.js` and `components/ColorPicker.module.css`
    - Display predefined color swatches as small colored circles
    - Colors: red, orange, blue, green, purple, yellow, pink, white
    - Clicking a swatch calls `onSelectColor(color)` and closes
    - Integrate into ContextMenu as a sub-panel
    - _Requirements: 4.2, 4.3_

- [x] 6. Build the PlexUploadModal component
  - [x] 6.1 Create `components/PlexUploadModal.js` and `components/PlexUploadModal.module.css`
    - Modal overlay: fixed, rgba(0,0,0,0.85), centered, z-index 1000
    - Modal box: black bg, 2px solid #f80206 border, box-shadow 0 0 20px #f80206, modalPopIn animation
    - Title: "Upload Video to Plex"
    - Drag-and-drop zone with dashed border, FaCloudUploadAlt icon, instructional text
    - Visual feedback on drag over (border color change, glow)
    - "Browse" button that triggers a hidden file input
    - Display selected file name after drop or browse selection
    - Close/Cancel button that resets state (selectedFile = null, isDragOver = false)
    - Close on Escape key and backdrop click
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 7. Checkpoint - Verify all original components render correctly
  - Ensure all components render correctly in isolation, ask the user if questions arise.

- [x] 8. Build the FileGrid component and wire up the DrivePage
  - [x] 8.1 Create `components/FileGrid.js` and `components/FileGrid.module.css`
    - CSS Grid layout matching existing `.grid` pattern
    - Render DriveItemCard for each item in the current folder
    - When `newFolderMode` is true, render an inline input card at the start of the grid
    - Handle new folder name submission (Enter key) and cancellation (Escape key or empty submit)
    - Show empty state message when folder has no items
    - _Requirements: 1.1, 1.7, 2.1, 2.3_
  - [x] 8.2 Rewrite `src/app/drive/page.js` to wire all components together
    - Import and use: Navbar, Background, DriveToolbar, BreadcrumbBar, FileGrid, DriveContextMenu, ColorPicker, PlexUploadModal
    - Initialize state: driveData (from mock), currentFolderId, breadcrumbPath, contextMenu, plexModalOpen, newFolderMode
    - Implement `navigateToFolder` — update currentFolderId and rebuild breadcrumb path using `buildBreadcrumbPath`
    - Implement `createFolder` — add new folder to driveData, update parent's children array
    - Implement `handleFileUpload` — add file entries from native file picker to driveData
    - Implement `changeFolderColor` — update folder's color in driveData
    - Implement `getCurrentItems` — return children of current folder from driveData
    - Close context menu on any click outside
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.4, 3.2, 4.3, 4.4, 6.5_
  - [x] 8.3 Update `src/app/drive/drive.module.css` to support the new file browser layout
    - Remove old `.grid` project card styles
    - Add styles for the overall page layout with toolbar, breadcrumb, and file grid sections
    - Maintain existing `.page`, `.pageBackground`, `.pageContent`, `.title` styles
    - Ensure pageLoad animation still applies
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Final checkpoint - Verify complete integration of original features
  - Ensure all features work together: navigation, folder creation, file upload, color change, Plex modal. Ask the user if questions arise.

- [x] 10. Add multi-drive mock data and utility
  - [x] 10.1 Update `data/driveData.js` to export three separate drive data sets
    - Change from single default export to named exports: `myDriveData`, `sharedDriveData`, `adminDriveData`
    - Keep existing data as `myDriveData`
    - Add `sharedDriveData` with root "Shared Drive", containing: "Team Projects" folder (with project-plan.doc, timeline.xlsx), "Company Docs" folder (with handbook.pdf, policies.doc), and a shared-notes.txt file
    - Add `adminDriveData` with root "Admin Drive", containing: "System Logs" folder (with server-log.txt, error-log.txt), "Config" folder (with settings.json), and a backup-manifest.pdf file
    - Maintain the same flat-map-by-ID structure for each drive
    - Also export a default that is `myDriveData` for backward compatibility during transition
    - _Requirements: 8.8, 7.1, 7.2, 7.3_
  - [x] 10.2 Add `collectDescendants(driveData, itemId)` utility to `src/lib/driveUtils.js`
    - Recursively collects all descendant IDs of a given item (including the item itself)
    - For files, returns just `[itemId]`
    - For folders, returns `[itemId, ...all nested children IDs]`
    - _Requirements: 9.6_

- [x] 11. Build the DriveToggle component
  - [x] 11.1 Create `components/DriveToggle.js` and `components/DriveToggle.module.css`
    - Follow the same pattern as `components/TaskToggle.js` and `components/TaskToggle.module.css`
    - Accept props: `activeDrive` (string), `onDriveChange` (function), `showAdminDrive` (boolean)
    - Render toggle buttons for "My Drive", "Shared Drive", and conditionally "Admin Drive"
    - Map drive keys to labels: myDrive → "My Drive", sharedDrive → "Shared Drive", adminDrive → "Admin Drive"
    - Active button: red background, black text; Inactive: black background, red text, reduced opacity
    - Orange hover glow on inactive buttons, red glow on active hover
    - Use TechMono font, match TaskToggle sizing and spacing
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7_

- [x] 12. Extend ContextMenu with Delete option and build ConfirmModal
  - [x] 12.1 Update `components/DriveContextMenu.js` to support Delete action
    - Add new props: `itemType` ("folder" | "file"), `onDelete` (function)
    - Show "Change Color" menu item only when `itemType === "folder"`
    - Always show "Delete" menu item for all item types
    - Add a visual separator (thin border line) between "Change Color" and "Delete" when both are shown
    - _Requirements: 9.1, 4.1_
  - [x] 12.2 Create `components/ConfirmModal.js` and `components/ConfirmModal.module.css`
    - Accept props: `isOpen` (boolean), `itemName` (string), `onConfirm` (function), `onCancel` (function)
    - Modal overlay: fixed position, rgba(0,0,0,0.85) background, centered, z-index 1000
    - Modal box: black bg, 2px solid #f80206 border, box-shadow 0 0 20px #f80206, modalPopIn animation
    - Title: "Confirm Delete" in Orbitron font
    - Message: "Are you sure you want to delete {itemName}?" in TechMono font
    - "Delete" button with red/danger styling, "Cancel" button with standard styling
    - Close on Escape key (treat as cancel), close on backdrop click (treat as cancel)
    - Do not render anything when `isOpen` is false
    - _Requirements: 9.2, 9.3, 9.5, 9.7_

- [x] 13. Wire drive toggle, delete, and confirm modal into DrivePage
  - [x] 13.1 Update `src/app/drive/page.js` to integrate multi-drive support
    - Import `useAuth` from AuthContext
    - Import `myDriveData`, `sharedDriveData`, `adminDriveData` from updated driveData.js
    - Import DriveToggle and ConfirmModal components
    - Import `collectDescendants` from driveUtils
    - Add `driveDataMap` state initialized with all three drive data sets
    - Add `activeDrive` state initialized to "myDrive"
    - Add `deleteConfirm` state (null or { itemId, itemName })
    - Derive active drive data from `driveDataMap[activeDrive]`
    - Update all existing functions (navigateToFolder, createFolder, handleFileUpload, changeFolderColor, getCurrentItems) to operate on the active drive's data within driveDataMap
    - Implement `switchDrive(driveKey)` — sets activeDrive, resets currentFolderId to "root", rebuilds breadcrumb for new drive root name
    - Update `handleContextMenu` to show context menu for both folders AND files (remove the folder-only check)
    - Implement `deleteItem(itemId)` — sets deleteConfirm with item ID and name
    - Implement `confirmDelete()` — uses collectDescendants to get all IDs to remove, removes item ID from parent's children array, deletes all collected IDs from drive data, if user is inside the deleted folder navigate to parent, closes modal
    - Implement `cancelDelete()` — sets deleteConfirm to null
    - Render DriveToggle between Toolbar and BreadcrumbBar, passing `activeDrive`, `switchDrive`, and `isAdmin()` as `showAdminDrive`
    - Render ConfirmModal with deleteConfirm state
    - Pass `itemType` and `onDelete` to DriveContextMenu
    - Update page title to reflect active drive name
    - _Requirements: 8.3, 8.4, 8.6, 8.7, 9.1, 9.2, 9.4, 9.5, 9.6_

- [x] 14. Final checkpoint - Verify all new features
  - Ensure drive toggle switches between drives correctly, Admin Drive is hidden for non-admins, delete works for both files and folders with confirmation, and all existing features still work. Ask the user if questions arise.

## Notes

- No testing framework is used in this project — this is intentional
- All components use `"use client"` directive for Next.js App Router
- Icons come from `react-icons/fa` which is already installed
- Mock data is designed to be replaceable with API calls later
- Tasks 1-9 are already completed (original feature implementation)
- Tasks 10-14 implement the new Drive Toggle and Delete features
- Each task references specific requirements for traceability
