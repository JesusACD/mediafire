/**
 * MediaFire SDK Types
 * @packageDocumentation
 */

// ==================== Configuration ====================

/**
 * Configuration options for MediaFireClient
 */
export interface MediaFireConfig {
  /**
   * MediaFire Application ID (default: 42511)
   */
  appId?: string;
  
  /**
   * API version to use (default: 1.3)
   */
  apiVersion?: string;
  
  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;
}

// ==================== Authentication ====================

/**
 * Session data returned after successful login
 */
export interface SessionData {
  /** Session token for API calls */
  sessionToken: string;
  /** Secret key for request signing */
  secretKey: string;
  /** Server time at login */
  time: string;
  /** User email */
  email: string;
}

/**
 * Credentials for login
 */
export interface Credentials {
  email: string;
  password: string;
}

// ==================== User ====================

/**
 * User information
 */
export interface UserInfo {
  /** User email */
  email: string;
  /** Display name */
  displayName: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Is premium user */
  premium: boolean;
  /** Is email validated */
  validated: boolean;
  /** Account creation date */
  createdAt?: string;
}

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Used storage in bytes */
  usedBytes: number;
  /** Total storage limit in bytes */
  totalBytes: number;
  /** Human-readable used storage */
  usedFormatted: string;
  /** Human-readable total storage */
  totalFormatted: string;
  /** Percentage of storage used */
  percentUsed: number;
}

// ==================== Files ====================

/**
 * File information
 */
export interface FileInfo {
  /** Quick key (file identifier) */
  quickKey: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** Human-readable file size */
  sizeFormatted: string;
  /** Creation date */
  created?: string;
  /** MIME type */
  mimeType?: string;
  /** Number of downloads */
  downloads?: number;
  /** Privacy setting */
  privacy?: string;
  /** Is password protected */
  passwordProtected?: boolean;
}

/**
 * Download links for a file
 */
export interface DownloadLinks {
  /** Direct download URL */
  directDownload?: string;
  /** Normal download URL (through MediaFire page) */
  normalDownload?: string;
  /** View/share link */
  viewLink: string;
}

/**
 * File item in folder listing
 */
export interface FileItem {
  /** Quick key */
  id: string;
  /** Quick key (alias) */
  quickKey: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** Human-readable size */
  sizeFormatted: string;
  /** Creation date */
  created?: string;
  /** MIME type */
  mimeType?: string;
  /** Privacy setting */
  privacy?: string;
  /** Parent folder key */
  parentFolderKey?: string;
  /** Parent folder name */
  parentName?: string;
  /** Always false for files */
  isFolder: false;
}

// ==================== Folders ====================

/**
 * Folder information
 */
export interface FolderInfo {
  /** Folder key (identifier) */
  folderKey: string;
  /** Folder name */
  name: string;
  /** Number of files in folder */
  fileCount: number;
  /** Number of subfolders */
  folderCount: number;
  /** Creation date */
  created?: string;
}

/**
 * Folder item in folder listing
 */
export interface FolderItem {
  /** Folder key */
  id: string;
  /** Folder key (alias) */
  folderKey: string;
  /** Folder name */
  name: string;
  /** Creation date */
  created?: string;
  /** Number of files */
  fileCount: number;
  /** Number of subfolders */
  folderCount: number;
  /** Parent folder key */
  parentFolderKey?: string;
  /** Parent folder name */
  parentName?: string;
  /** Always true for folders */
  isFolder: true;
}

/**
 * Content item (file or folder)
 */
export type ContentItem = FileItem | FolderItem;

/**
 * Folder content response
 */
export interface FolderContent {
  /** Folder key */
  folderKey: string;
  /** List of items (files and folders) */
  items: ContentItem[];
  /** Whether there are more items */
  hasMore: boolean;
  /** Current chunk number */
  chunk: number;
}

/**
 * Search results
 */
export interface SearchResults {
  /** Search query */
  query: string;
  /** Found items */
  items: ContentItem[];
  /** Total number of results */
  total: number;
}

// ==================== API ====================

/**
 * Base API response structure
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  code?: number;
}

/**
 * MediaFire API error
 */
export class MediaFireError extends Error {
  /** Error code from API */
  code?: number;
  /** Original response */
  response?: unknown;

  constructor(message: string, code?: number, response?: unknown) {
    super(message);
    this.name = 'MediaFireError';
    this.code = code;
    this.response = response;
  }
}
