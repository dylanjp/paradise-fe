# Implementation Plan: Media Cache Drive

## Overview

Add a read-only "Media Cache" drive option to the existing drive page. The implementation extends the toggle row, data map, toolbar, context menu suppression, and file grid with conditional read-only behavior keyed off `activeDrive === "mediaCache"`. Each component receives an `isMediaCache` flag to hide or disable write-oriented UI elements.

## Tasks

- [x] 1. Add Media Cache drive data source
  - [x] 1.1 Add `mediaCacheDriveData` export to `data/driveData.js`
    - Create a new exported constant `mediaCacheDriveData` with root folder and sample media content (movies folder, music folder, images folder, and a readme file)
    - Each item must conform to the existing schema: `id`, `name`, `type`, `fileType`, `size`, `color`, `children`, `parentId`
    - Include nested children inside folders to support folder navigation
    - _Requirements: 2.1, 2.3_

- [x] 2. Add Media Cache toggle option to DriveToggle
  - [x] 2.1 Add `mediaCache` entry to `DRIVE_OPTIONS` in `components/DriveToggle.js`
    - Add `{ key: "mediaCache", label: "Media Cache" }` to the `DRIVE_OPTIONS` array
    - Update the filter logic so `mediaCache` is always visible (only `adminDrive` is gated by `showAdminDrive`)
    - _Requirements: 1.1, 1.4_

- [x] 3. Integrate Media Cache into DrivePage
  - [x] 3.1 Wire up Media Cache data and state in `src/app/drive/page.js`
    - Import `mediaCacheDriveData` from `data/driveData.js`
    - Add `"mediaCache": "Media Cache"` to `DRIVE_LABELS`
    - Add `mediaCache: mediaCacheDriveData` to the initial `driveDataMap` state
    - Derive `const isMediaCache = activeDrive === "mediaCache"`
    - _Requirements: 1.2, 1.3, 2.1, 7.1, 7.2_

  - [x] 3.2 Pass `isMediaCache` prop to DriveToolbar and FileGrid
    - Pass `isMediaCache` to `DriveToolbar` component
    - Pass `isMediaCache` to `FileGrid` component
    - _Requirements: 3.1, 3.2, 3.3, 5.1_

  - [x] 3.3 Guard write actions in DrivePage when Media Cache is active
    - Guard `setNewFolderMode(true)` call in the `onNewFolder` handler: no-op when `isMediaCache`
    - Guard `handleContextMenu`: no-op when `isMediaCache` (suppress context menu entirely)
    - Add file download handling: when `isMediaCache` and a file item is clicked, trigger a download action
    - _Requirements: 4.3, 5.2, 6.1_

- [x] 4. Hide toolbar actions in Media Cache mode
  - [x] 4.1 Update `components/DriveToolbar.js` to accept and use `isMediaCache` prop
    - Accept `isMediaCache` prop (default `false`)
    - When `isMediaCache` is true, render an empty toolbar (hide "New Folder", "Upload File", and "Upload Video to Plex" buttons)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Suppress new folder mode and handle file clicks in FileGrid
  - [x] 5.1 Update `components/FileGrid.js` to accept and use `isMediaCache` prop
    - Accept `isMediaCache` prop (default `false`)
    - Suppress `newFolderMode` inline input rendering when `isMediaCache` is true
    - For file items in media cache mode, attach an `onClick` handler that triggers download (passed from DrivePage via `onFileClick` prop)
    - _Requirements: 5.1, 6.1, 6.2_

- [x] 6. Checkpoint
  - Ensure all components render correctly, ask the user if questions arise.
  - Verify: toggle shows "Media Cache", toolbar hides actions, context menu is suppressed, folder navigation works, file click triggers download, page title shows "Media Cache".

## Notes

- This project does not use any testing framework. No tests, test files, or test dependencies should be created.
- Each task references specific requirements for traceability.
- The checkpoint ensures incremental validation through manual verification.
- The implementation follows the existing component patterns with minimal changes — no new components or abstraction layers are introduced.
