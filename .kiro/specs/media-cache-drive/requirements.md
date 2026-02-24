# Requirements Document

## Introduction

This feature adds a "Media Cache" toggle option to the drive page's toggle row alongside the existing "My Drive", "Shared Drive", and "Admin Drive" options. The Media Cache drive provides a read-only file browsing experience where users can navigate folders and download files but cannot upload files, create folders, or modify the file structure in any way. This serves as a cached media library for consumption only.

## Glossary

- **Drive_Page**: The main page component at `src/app/drive/page.js` that renders the drive UI including the toggle row, toolbar, breadcrumb bar, and file grid.
- **Drive_Toggle**: The toggle row component (`DriveToggle.js`) that renders selectable drive options as buttons.
- **Drive_Toolbar**: The toolbar component (`DriveToolbar.js`) that renders action buttons such as "New Folder", "Upload File", and "Upload Video to Plex".
- **File_Grid**: The grid component (`FileGrid.js`) that displays folder and file items for the active drive.
- **Context_Menu**: The right-click context menu component (`DriveContextMenu.js`) that provides item-level actions such as "Change Color" and "Delete".
- **Media_Cache_Drive**: A new drive option representing a read-only cached media library where users can browse and download files but cannot create, upload, or delete items.
- **Active_Drive**: The currently selected drive option in the Drive_Toggle, determining which drive data and permissions are applied.

## Requirements

### Requirement 1: Add Media Cache Toggle Option

**User Story:** As a user, I want to see a "Media Cache" option in the drive toggle row, so that I can switch to the cached media library view.

#### Acceptance Criteria

1. THE Drive_Toggle SHALL display a "Media Cache" button in the toggle row after the existing drive options.
2. WHEN the user clicks the "Media Cache" button, THE Drive_Toggle SHALL set the Active_Drive to "mediaCache".
3. WHEN the Active_Drive changes to "mediaCache", THE Drive_Page SHALL reset the current folder to the Media_Cache_Drive root and update the breadcrumb path accordingly.
4. THE Drive_Toggle SHALL render the "Media Cache" button to all users regardless of admin status.

### Requirement 2: Media Cache Drive Data Source

**User Story:** As a user, I want the Media Cache drive to display its own set of files and folders, so that I can browse the cached media library.

#### Acceptance Criteria

1. THE Drive_Page SHALL maintain a separate data source for the Media_Cache_Drive in the drive data map.
2. WHEN the Active_Drive is "mediaCache", THE File_Grid SHALL display the files and folders from the Media_Cache_Drive data source.
3. THE Media_Cache_Drive data source SHALL use the same data structure as the existing drive data sources (id, name, type, fileType, size, color, children, parentId).

### Requirement 3: Disable Upload Actions in Media Cache Mode

**User Story:** As a user, I want upload actions to be unavailable when viewing the Media Cache drive, so that I understand the media cache is read-only.

#### Acceptance Criteria

1. WHILE the Active_Drive is "mediaCache", THE Drive_Toolbar SHALL hide or disable the "Upload File" button.
2. WHILE the Active_Drive is "mediaCache", THE Drive_Toolbar SHALL hide or disable the "New Folder" button.
3. WHEN the Active_Drive changes from "mediaCache" to another drive, THE Drive_Toolbar SHALL restore all action buttons to their enabled state.

### Requirement 4: Disable Context Menu Modifications in Media Cache Mode

**User Story:** As a user, I want modification actions in the context menu to be unavailable in Media Cache mode, so that I cannot alter the cached media structure.

#### Acceptance Criteria

1. WHILE the Active_Drive is "mediaCache", THE Context_Menu SHALL hide the "Delete" option for all items.
2. WHILE the Active_Drive is "mediaCache", THE Context_Menu SHALL hide the "Change Color" option for folder items.
3. WHILE the Active_Drive is "mediaCache" and no actionable menu items remain, THE Drive_Page SHALL suppress the Context_Menu from appearing on right-click.

### Requirement 5: Disable New Folder Creation in Media Cache Mode

**User Story:** As a user, I want folder creation to be blocked in Media Cache mode, so that the cached media structure remains unmodified.

#### Acceptance Criteria

1. WHILE the Active_Drive is "mediaCache", THE File_Grid SHALL prevent the new folder inline input from appearing.
2. WHILE the Active_Drive is "mediaCache", THE Drive_Page SHALL ignore any programmatic attempts to enter new folder creation mode.

### Requirement 6: Allow File Download in Media Cache Mode

**User Story:** As a user, I want to be able to download files from the Media Cache drive, so that I can access cached media content locally.

#### Acceptance Criteria

1. WHILE the Active_Drive is "mediaCache", THE File_Grid SHALL allow users to click on files to initiate a download action.
2. WHILE the Active_Drive is "mediaCache", THE File_Grid SHALL allow users to navigate into folders by clicking on folder items.
3. WHILE the Active_Drive is "mediaCache", THE Drive_Page SHALL maintain breadcrumb navigation for folder traversal within the Media_Cache_Drive.

### Requirement 7: Media Cache Page Title

**User Story:** As a user, I want the page title to reflect the active drive, so that I know I am viewing the Media Cache.

#### Acceptance Criteria

1. WHEN the Active_Drive is "mediaCache", THE Drive_Page SHALL display "Media Cache" as the page title.
2. WHEN the Active_Drive changes away from "mediaCache", THE Drive_Page SHALL display the corresponding drive label as the page title.
