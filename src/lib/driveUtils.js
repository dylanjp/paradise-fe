import {
  FaFolder,
  FaFilePdf,
  FaFileWord,
  FaFileAudio,
  FaFileVideo,
  FaFileImage,
  FaFileExcel,
  FaFileAlt,
  FaFileCsv,
  FaFileCode,
  FaMarkdown,
  FaProjectDiagram,
  FaFile,
} from "react-icons/fa";

const ICON_MAP = {
  pdf: { icon: FaFilePdf, color: "#e74c3c" },
  doc: { icon: FaFileWord, color: "#4a9eff" },
  docx: { icon: FaFileWord, color: "#4a9eff" },
  mp3: { icon: FaFileAudio, color: "#9b59b6" },
  wav: { icon: FaFileAudio, color: "#9b59b6" },
  ogg: { icon: FaFileAudio, color: "#9b59b6" },
  m4a: { icon: FaFileAudio, color: "#9b59b6" },
  flac: { icon: FaFileAudio, color: "#9b59b6" },
  aac: { icon: FaFileAudio, color: "#9b59b6" },
  mp4: { icon: FaFileVideo, color: "#ff6600" },
  avi: { icon: FaFileVideo, color: "#ff6600" },
  mkv: { icon: FaFileVideo, color: "#ff6600" },
  webm: { icon: FaFileVideo, color: "#ff6600" },
  mov: { icon: FaFileVideo, color: "#ff6600" },
  m4v: { icon: FaFileVideo, color: "#ff6600" },
  jpg: { icon: FaFileImage, color: "#00cc66" },
  jpeg: { icon: FaFileImage, color: "#00cc66" },
  png: { icon: FaFileImage, color: "#00cc66" },
  gif: { icon: FaFileImage, color: "#00cc66" },
  webp: { icon: FaFileImage, color: "#00cc66" },
  svg: { icon: FaFileImage, color: "#00cc66" },
  bmp: { icon: FaFileImage, color: "#00cc66" },
  avif: { icon: FaFileImage, color: "#00cc66" },
  xlsx: { icon: FaFileExcel, color: "#00cc66" },
  xls: { icon: FaFileExcel, color: "#00cc66" },
  csv: { icon: FaFileCsv, color: "#00cc66" },
  txt: { icon: FaFileAlt, color: "#cccccc" },
  md: { icon: FaMarkdown, color: "#00d4ff" },
  json: { icon: FaFileCode, color: "#ffb000" },
  canvas: { icon: FaProjectDiagram, color: "#00d4ff" },
};

const DEFAULT_FILE = { icon: FaFile, color: "#999999" };

/**
 * Returns the icon component and default color for a drive item.
 * For folders, uses FaFolder with a default blue color (caller should override with folder's color property).
 * For files, maps the fileType extension to the appropriate icon.
 */
export function getIconForType(type, fileType) {
  if (type === "folder") {
    return { icon: FaFolder, color: "#4a9eff" };
  }

  // Own keys only: extensions like "constructor" must not hit Object.prototype
  const key = typeof fileType === "string" ? fileType.toLowerCase() : "";
  if (key && Object.prototype.hasOwnProperty.call(ICON_MAP, key)) {
    return ICON_MAP[key];
  }

  return DEFAULT_FILE;
}

/**
 * Extracts the file extension from a filename string.
 * Returns an empty string if no extension is found.
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Walks up the parentId chain from the given folderId to root,
 * returning an array of { id, name } objects in root-first order.
 */
export function buildBreadcrumbPath(driveData, folderId) {
  const path = [];
  let currentId = folderId;

  while (currentId && driveData[currentId]) {
    const item = driveData[currentId];
    path.push({ id: item.id, name: item.name });
    currentId = item.parentId;
  }

  return path.reverse();
}

/**
 * Recursively collects all descendant IDs of a given item (including the item itself).
 * For files, returns just [itemId].
 * For folders, returns [itemId, ...all nested children IDs].
 */
export function collectDescendants(driveData, itemId) {
  const item = driveData[itemId];
  if (!item) return [];
  let ids = [itemId];
  if (item.type === "folder" && item.children) {
    for (const childId of item.children) {
      ids = ids.concat(collectDescendants(driveData, childId));
    }
  }
  return ids;
}
