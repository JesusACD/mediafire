/**
 * Folders Module - Folder operations
 */
import { apiCall, InternalSession } from '../api';
import { FolderContent, ContentItem, FileItem, FolderItem } from '../types';
import { formatBytes } from '../utils';

/**
 * Options for listing folder content
 */
export interface GetContentOptions {
  /** Content type: 'files', 'folders', or 'all' (default) */
  contentType?: 'files' | 'folders' | 'all';
  /** Chunk number for pagination (default: 1) */
  chunk?: number;
  /** Number of items per chunk (default: 100) */
  chunkSize?: number;
}

/**
 * Folders module for folder operations
 */
export class FoldersModule {
  constructor(private getSession: () => InternalSession | null) {}

  /**
   * Get folder content (files and/or folders)
   * 
   * @param folderKey - Folder key (default: 'myfiles' for root)
   * @param options - Content options
   * @returns Folder content
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * // List root folder
   * const content = await client.folders.getContent();
   * content.items.forEach(item => {
   *   console.log(`${item.isFolder ? '📁' : '📄'} ${item.name}`);
   * });
   * 
   * // List specific folder
   * const subContent = await client.folders.getContent('abc123folderkey');
   * ```
   */
  async getContent(folderKey: string = 'myfiles', options: GetContentOptions = {}): Promise<FolderContent> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    const { contentType = 'all', chunk = 1, chunkSize = 100 } = options;

    const folders: FolderItem[] = [];
    const files: FileItem[] = [];
    let hasMore = false;

    // Get folders if needed
    if (contentType === 'all' || contentType === 'folders') {
      interface FolderResponse {
        folder_content?: {
          folders?: Array<{
            folderkey: string;
            name: string;
            created?: string;
            file_count?: string;
            folder_count?: string;
          }>;
          more_chunks?: string;
          chunk_number?: string;
        };
      }

      const response = await apiCall<FolderResponse>('folder/get_content', {
        folder_key: folderKey,
        content_type: 'folders',
        chunk,
        chunk_size: chunkSize
      }, session);

      const folderContent = response.folder_content || {};
      
      (folderContent.folders || []).forEach(folder => {
        folders.push({
          id: folder.folderkey,
          folderKey: folder.folderkey,
          name: folder.name,
          created: folder.created,
          fileCount: parseInt(folder.file_count || '0', 10),
          folderCount: parseInt(folder.folder_count || '0', 10),
          isFolder: true
        });
      });

      if (folderContent.more_chunks === 'yes') {
        hasMore = true;
      }
    }

    // Get files if needed
    if (contentType === 'all' || contentType === 'files') {
      interface FileResponse {
        folder_content?: {
          files?: Array<{
            quickkey: string;
            filename: string;
            size?: string;
            created?: string;
            mimetype?: string;
            privacy?: string;
          }>;
          more_chunks?: string;
        };
      }

      const response = await apiCall<FileResponse>('folder/get_content', {
        folder_key: folderKey,
        content_type: 'files',
        chunk,
        chunk_size: chunkSize
      }, session);

      const fileContent = response.folder_content || {};
      
      (fileContent.files || []).forEach(file => {
        const size = parseInt(file.size || '0', 10);
        files.push({
          id: file.quickkey,
          quickKey: file.quickkey,
          name: file.filename,
          size,
          sizeFormatted: formatBytes(size),
          created: file.created,
          mimeType: file.mimetype,
          privacy: file.privacy,
          isFolder: false
        });
      });

      if (fileContent.more_chunks === 'yes') {
        hasMore = true;
      }
    }

    // Combine results (folders first)
    const items: ContentItem[] = [...folders, ...files];

    return {
      folderKey,
      items,
      hasMore,
      chunk
    };
  }

  /**
   * Get only files in a folder
   * 
   * @param folderKey - Folder key (default: 'myfiles' for root)
   * @param options - Pagination options
   * @returns Array of files
   */
  async getFiles(folderKey: string = 'myfiles', options: Omit<GetContentOptions, 'contentType'> = {}): Promise<FileItem[]> {
    const content = await this.getContent(folderKey, { ...options, contentType: 'files' });
    return content.items.filter((item): item is FileItem => !item.isFolder);
  }

  /**
   * Get only folders in a folder
   * 
   * @param folderKey - Folder key (default: 'myfiles' for root)
   * @param options - Pagination options
   * @returns Array of folders
   */
  async getFolders(folderKey: string = 'myfiles', options: Omit<GetContentOptions, 'contentType'> = {}): Promise<FolderItem[]> {
    const content = await this.getContent(folderKey, { ...options, contentType: 'folders' });
    return content.items.filter((item): item is FolderItem => item.isFolder);
  }

  /**
   * Get folder information
   * 
   * @param folderKey - Folder key
   * @returns Folder info
   * 
   * @example
   * ```typescript
   * const info = await client.folders.getInfo('abc123');
   * console.log(`Folder: ${info.name}`);
   * ```
   */
  async getInfo(folderKey: string): Promise<{
    folderKey: string;
    name: string;
    description?: string;
    created?: string;
    privacy: string;
    fileCount: number;
    folderCount: number;
    totalSize: number;
  }> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface FolderInfoResponse {
      folder_info?: {
        folderkey: string;
        name: string;
        description?: string;
        created?: string;
        privacy?: string;
        file_count?: string;
        folder_count?: string;
        total_size?: string;
      };
    }

    const response = await apiCall<FolderInfoResponse>('folder/get_info', {
      folder_key: folderKey
    }, session);

    const info = response.folder_info;
    if (!info) {
      throw new Error(`Folder not found: ${folderKey}`);
    }

    return {
      folderKey: info.folderkey,
      name: info.name,
      description: info.description,
      created: info.created,
      privacy: info.privacy || 'private',
      fileCount: parseInt(info.file_count || '0', 10),
      folderCount: parseInt(info.folder_count || '0', 10),
      totalSize: parseInt(info.total_size || '0', 10)
    };
  }

  /**
   * Create a new folder
   * 
   * @param name - Folder name
   * @param parentKey - Parent folder key (default: root)
   * @param options - Create options
   * @returns Created folder info
   * 
   * @example
   * ```typescript
   * const folder = await client.folders.create('My New Folder');
   * console.log(`Created: ${folder.folderKey}`);
   * ```
   */
  async create(name: string, parentKey?: string, options?: {
    actionOnDuplicate?: 'skip' | 'keep' | 'replace';
  }): Promise<{ folderKey: string; name: string }> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface CreateResponse {
      folder_key?: string;
      folderkey?: string;
      name?: string;
    }

    const response = await apiCall<CreateResponse>('folder/create', {
      foldername: name,
      parent_key: parentKey || 'myfiles',
      action_on_duplicate: options?.actionOnDuplicate || 'keep'
    }, session);

    return {
      folderKey: response.folder_key || response.folderkey || '',
      name: response.name || name
    };
  }

  /**
   * Delete a folder (move to trash)
   * 
   * @param folderKey - Folder key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.folders.delete('abc123');
   * ```
   */
  async delete(folderKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('folder/delete', {
      folder_key: folderKey
    }, session);

    return true;
  }

  /**
   * Move a folder to another location
   * 
   * @param folderKey - Folder key (or comma-separated list)
   * @param destFolderKey - Destination folder key (default: root)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.folders.move('abc123', 'destFolder');
   * ```
   */
  async move(folderKey: string, destFolderKey?: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('folder/move', {
      folder_key_src: folderKey,
      folder_key_dst: destFolderKey || 'myfiles'
    }, session);

    return true;
  }

  /**
   * Copy a folder to another location
   * 
   * @param folderKey - Folder key
   * @param destFolderKey - Destination folder key (default: root)
   * @returns New folder key
   * 
   * @example
   * ```typescript
   * const newKey = await client.folders.copy('abc123', 'destFolder');
   * ```
   */
  async copy(folderKey: string, destFolderKey?: string): Promise<string> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface CopyResponse {
      new_folderkeys?: string[];
    }

    const response = await apiCall<CopyResponse>('folder/copy', {
      folder_key_src: folderKey,
      folder_key_dst: destFolderKey || 'myfiles'
    }, session);

    return response.new_folderkeys?.[0] || '';
  }

  /**
   * Rename a folder
   * 
   * @param folderKey - Folder key
   * @param newName - New folder name
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.folders.rename('abc123', 'New Name');
   * ```
   */
  async rename(folderKey: string, newName: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('folder/update', {
      folder_key: folderKey,
      foldername: newName
    }, session);

    return true;
  }

  /**
   * Set folder privacy
   * 
   * @param folderKey - Folder key
   * @param privacy - Privacy setting: 'public' or 'private'
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.folders.setPrivacy('abc123', 'public');
   * ```
   */
  async setPrivacy(folderKey: string, privacy: 'public' | 'private'): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('folder/update', {
      folder_key: folderKey,
      privacy: privacy
    }, session);

    return true;
  }

  /**
   * Permanently delete a folder (cannot be recovered)
   * 
   * @param folderKey - Folder key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.folders.purge('abc123');
   * ```
   */
  async purge(folderKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('folder/purge', {
      folder_key: folderKey
    }, session);

    return true;
  }
}

