# Requirements Document

## Introduction

The Drive File Browser feature transforms the existing Pratt Drive page into a Google Drive-like file browser interface. It allows users to browse a shared network drive's folder structure, navigate into folders, create new folders, upload files, and change folder colors. The feature also includes a dedicated "Upload Video to Plex" modal with drag-and-drop and browse functionality. Users can switch between multiple drives (My Drive, Shared Drive, Admin Drive) using toggle tabs, and delete files or folders via a context menu with confirmation. The frontend uses mock data for now, with backend integration planned for a later phase. All styling follows the existing Retro Tron Ares theme.

## Glossary

- **File_Browser**: The main component that displays the folder/file hierarchy and handles user navigation
- **Drive_Item**: A single entry in the file browser, representing either a folder or a file
- **Folder**: A Drive_Item that can contain other Drive_Items and supports color customization
- **File**: A Drive_Item representing a document with a type-specific icon (PDF, DOC, MP3, etc.)
- **Breadcrumb_Bar**: A navigation component showing the current path and allowing quick navigation to parent folders
- **Toolbar**: The action bar at the top of the file browser containing buttons for creating folders, uploading files, and uploading video to Plex
- **Drive_Toggle**: A row of toggle buttons below the Toolbar that switches between different drives (My Drive, Shared Drive, Admin Drive)
- **Confirmation_Modal**: A modal dialog that asks the user to confirm a destructive action (e.g., deleting an item)
- **Plex_Upload_Modal**: A modal dialog with drag-and-drop and browse functionality for uploading video files to Plex
- **Color_Picker**: A UI element that allows users to change the color of a folder
- **Context_Menu**: A right-click menu that provides actions for a Drive_Item (Change Color for folders, Delete for all items)
- **Mock_Data**: Static in-page data representing a folder/file hierarchy used until backend endpoints are available
- **Auth_Context**: The application-wide authentication context providing user identity and role information (including admin status)

## Requirements

### Requirement 1: Folder and File Browsing

**User Story:** As a user, I want to browse folders and files on the shared drive, so that I can find and access the content I need.

#### Acceptance Criteria

1. WHEN the Drive page loads, THE File_Browser SHALL display the root-level Drive_Items from Mock_Data for the currently active drive
2. WHEN a user clicks on a Folder, THE File_Browser SHALL navigate into that Folder and display its contents
3. THE Breadcrumb_Bar SHALL display the current navigation path from root to the current Folder
4. WHEN a user clicks a segment in the Breadcrumb_Bar, THE File_Browser SHALL navigate to that Folder
5. THE File_Browser SHALL display each Drive_Item with an appropriate icon based on its type (folder, PDF, DOC, MP3, image, video, or generic file)
6. THE File_Browser SHALL display each Drive_Item with its name and file size (for files)
7. WHEN the current Folder contains no Drive_Items, THE File_Browser SHALL display an empty state message

### Requirement 2: Create New Folder

**User Story:** As a user, I want to create new folders in the current directory, so that I can organize files on the shared drive.

#### Acceptance Criteria

1. WHEN a user clicks the "New Folder" button in the Toolbar, THE File_Browser SHALL display an inline input field for the folder name
2. WHEN a user submits a non-empty folder name, THE File_Browser SHALL create a new Folder in the current directory with that name
3. WHEN a user submits an empty or whitespace-only folder name, THE File_Browser SHALL cancel the folder creation and remove the input field
4. WHEN a new Folder is created, THE File_Browser SHALL add the Folder to the current directory listing immediately

### Requirement 3: File Upload

**User Story:** As a user, I want to upload files to the current directory, so that I can add content to the shared drive.

#### Acceptance Criteria

1. WHEN a user clicks the "Upload File" button in the Toolbar, THE File_Browser SHALL open a native file picker dialog
2. WHEN a user selects one or more files from the file picker, THE File_Browser SHALL add the selected files as Drive_Items in the current directory
3. THE File_Browser SHALL assign the correct file type icon based on the uploaded file's extension

### Requirement 4: Folder Color Customization

**User Story:** As a user, I want to change the color of folders, so that I can visually organize and distinguish folders.

#### Acceptance Criteria

1. WHEN a user right-clicks on a Folder, THE Context_Menu SHALL display a "Change Color" option
2. WHEN a user selects "Change Color", THE Color_Picker SHALL display a set of predefined color options
3. WHEN a user selects a color from the Color_Picker, THE File_Browser SHALL update the Folder icon to reflect the chosen color
4. THE File_Browser SHALL persist the folder color in the Mock_Data state for the duration of the session

### Requirement 5: Upload Video to Plex Modal

**User Story:** As a user, I want to upload video files to Plex through a dedicated modal, so that I can add media to the Plex server.

#### Acceptance Criteria

1. THE Toolbar SHALL display an "Upload Video to Plex" button positioned in the top-right area
2. WHEN a user clicks the "Upload Video to Plex" button, THE Plex_Upload_Modal SHALL open with a drag-and-drop zone and a browse button
3. WHEN a user drags a file over the drop zone, THE Plex_Upload_Modal SHALL provide visual feedback indicating the drop zone is active
4. WHEN a user drops a file onto the drop zone, THE Plex_Upload_Modal SHALL display the selected file name in the modal
5. WHEN a user clicks the browse button, THE Plex_Upload_Modal SHALL open a native file picker dialog
6. WHEN a user selects a file via the browse button, THE Plex_Upload_Modal SHALL display the selected file name in the modal
7. WHEN a user clicks a close or cancel button, THE Plex_Upload_Modal SHALL close and reset its state
8. THE Plex_Upload_Modal SHALL follow the Tron Ares modal styling pattern (black background, red border, red glow box-shadow, pop-in animation)

### Requirement 6: Tron Ares Themed Styling

**User Story:** As a user, I want the drive page to match the rest of the site's Retro Tron Ares styling, so that the experience is visually consistent.

#### Acceptance Criteria

1. THE File_Browser SHALL use the TechMono and Orbitron font families consistent with the existing site
2. THE File_Browser SHALL use the Tron Ares color palette (--tron-red-primary, --tron-orange-primary, and related CSS variables) for text, borders, and glowing effects
3. THE File_Browser SHALL use a black background with red/orange glowing borders consistent with other pages
4. THE File_Browser SHALL include the pageLoad fade-in animation on initial render
5. THE File_Browser SHALL include the Navbar and Background components consistent with other pages

### Requirement 7: Mock Data Structure

**User Story:** As a developer, I want well-structured mock data representing a folder/file hierarchy, so that the frontend can be developed independently of the backend.

#### Acceptance Criteria

1. THE Mock_Data SHALL represent a nested folder and file structure with at least two levels of depth
2. THE Mock_Data SHALL include files of various types: PDF, DOC, MP3, image, and video
3. THE Mock_Data SHALL include folders with different custom colors to demonstrate the color feature
4. WHEN the backend is integrated later, THE Mock_Data SHALL be replaceable with API responses without changing component logic

### Requirement 8: Drive Toggle Tabs

**User Story:** As a user, I want to switch between different drives (My Drive, Shared Drive, Admin Drive), so that I can access files organized across separate drive spaces.

#### Acceptance Criteria

1. THE Drive_Toggle SHALL render below the Toolbar button row as a row of toggle buttons
2. THE Drive_Toggle SHALL display three options: "My Drive", "Shared Drive", and "Admin Drive"
3. WHEN a user clicks a Drive_Toggle option, THE File_Browser SHALL switch to display the root-level contents of the selected drive
4. WHEN a user switches drives, THE File_Browser SHALL reset the current folder to the root of the selected drive and update the Breadcrumb_Bar accordingly
5. THE Drive_Toggle SHALL visually indicate which drive is currently active using the same toggle styling pattern as TaskToggle (active: red background with black text; inactive: black background with red text and reduced opacity)
6. WHILE the user is not an admin (as determined by Auth_Context isAdmin), THE Drive_Toggle SHALL hide the "Admin Drive" option
7. WHILE the user is an admin (as determined by Auth_Context isAdmin), THE Drive_Toggle SHALL display all three drive options including "Admin Drive"
8. THE Mock_Data SHALL include separate folder/file hierarchies for each drive (My Drive, Shared Drive, Admin Drive)

### Requirement 9: Delete Items

**User Story:** As a user, I want to delete files and folders from the drive, so that I can remove content I no longer need.

#### Acceptance Criteria

1. WHEN a user right-clicks on any Drive_Item (folder or file), THE Context_Menu SHALL display a "Delete" option
2. WHEN a user selects "Delete" from the Context_Menu, THE Confirmation_Modal SHALL open asking the user to confirm the deletion
3. THE Confirmation_Modal SHALL display the name of the item being deleted
4. WHEN a user confirms the deletion in the Confirmation_Modal, THE File_Browser SHALL remove the Drive_Item from the drive data and remove its ID from the parent Folder's children array
5. WHEN a user cancels the deletion in the Confirmation_Modal, THE File_Browser SHALL close the modal and leave the drive data unchanged
6. WHEN a Folder is deleted, THE File_Browser SHALL remove the Folder and all of its descendant Drive_Items from the drive data
7. THE Confirmation_Modal SHALL follow the Tron Ares modal styling pattern (black background, red border, red glow box-shadow)
