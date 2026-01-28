/**
 * Files Module - File operations
 */
import { apiCall, InternalSession } from '../api';
import { FileInfo, DownloadLinks, ContentItem, SearchResults } from '../types';
import { formatBytes } from '../utils';

/**
 * Files module for file operations
 */
export class FilesModule {
  constructor(private getSession: () => InternalSession | null) {}

  /**
   * Get file information
   * 
   * @param quickKey - File quick key
   * @returns File info
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const file = await client.files.getInfo('abc123quickkey');
   * console.log(`File: ${file.name} (${file.sizeFormatted})`);
   * ```
   */
  async getInfo(quickKey: string): Promise<FileInfo> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface FileInfoResponse {
      file_info?: {
        quickkey: string;
        filename: string;
        size?: string;
        created?: string;
        mimetype?: string;
        downloads?: string;
        privacy?: string;
        password_protected?: string;
      };
      file_infos?: Array<{
        quickkey: string;
        filename: string;
        size?: string;
        created?: string;
        mimetype?: string;
        downloads?: string;
        privacy?: string;
        password_protected?: string;
      }>;
    }

    const response = await apiCall<FileInfoResponse>('file/get_info', {
      quick_key: quickKey
    }, session);

    const info = response.file_info || response.file_infos?.[0];
    if (!info) {
      throw new Error(`File not found: ${quickKey}`);
    }

    const size = parseInt(info.size || '0', 10);

    return {
      quickKey: info.quickkey,
      name: info.filename,
      size,
      sizeFormatted: formatBytes(size),
      created: info.created,
      mimeType: info.mimetype,
      downloads: parseInt(info.downloads || '0', 10),
      privacy: info.privacy,
      passwordProtected: info.password_protected === 'yes'
    };
  }

  /**
   * Get download links for a file
   * 
   * @param quickKey - File quick key
   * @returns Download links
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const links = await client.files.getLinks('abc123quickkey');
   * console.log(`Download: ${links.directDownload}`);
   * ```
   */
  async getLinks(quickKey: string): Promise<DownloadLinks> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface LinksResponse {
      links?: Array<{
        direct_download?: string;
        normal_download?: string;
      }>;
    }

    const response = await apiCall<LinksResponse>('file/get_links', {
      quick_key: quickKey,
      link_type: 'direct_download'
    }, session);

    const linkInfo = response.links?.[0] || {};

    return {
      directDownload: linkInfo.direct_download,
      normalDownload: linkInfo.normal_download,
      viewLink: `https://www.mediafire.com/file/${quickKey}`
    };
  }

  /**
   * Search for files
   * 
   * @param query - Search query
   * @returns Search results
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const results = await client.files.search('document.pdf');
   * console.log(`Found ${results.total} files`);
   * results.items.forEach(item => console.log(item.name));
   * ```
   */
  async search(query: string): Promise<SearchResults> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface SearchResponse {
      results?: Array<{
        type: string;
        folderkey?: string;
        quickkey?: string;
        name?: string;
        filename?: string;
        size?: string;
        mimetype?: string;
        parent_folderkey?: string;
        parent_name?: string;
      }>;
    }

    const response = await apiCall<SearchResponse>('folder/search', {
      search_text: query,
      filter: 'everything'
    }, session);

    const results = response.results || [];
    
    const items: ContentItem[] = results.map(item => {
      if (item.type === 'folder') {
        return {
          id: item.folderkey || '',
          folderKey: item.folderkey || '',
          name: item.name || '',
          created: undefined,
          fileCount: 0,
          folderCount: 0,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: true as const
        };
      } else {
        const size = parseInt(item.size || '0', 10);
        return {
          id: item.quickkey || '',
          quickKey: item.quickkey || '',
          name: item.filename || item.name || '',
          size,
          sizeFormatted: formatBytes(size),
          mimeType: item.mimetype,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: false as const
        };
      }
    });

    return {
      query,
      items,
      total: items.length
    };
  }

  /**
   * Set file privacy (public or private)
   * 
   * @param quickKey - File quick key
   * @param privacy - Privacy setting: 'public' or 'private'
   * @returns True if successful
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * // Make file public
   * await client.files.setPrivacy('abc123quickkey', 'public');
   * 
   * // Make file private
   * await client.files.setPrivacy('abc123quickkey', 'private');
   * ```
   */
  async setPrivacy(quickKey: string, privacy: 'public' | 'private'): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface UpdateResponse {
      result?: string;
    }

    await apiCall<UpdateResponse>('file/update', {
      quick_key: quickKey,
      privacy: privacy
    }, session);

    return true;
  }

  /**
   * Make a file public
   * 
   * @param quickKey - File quick key
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.makePublic('abc123quickkey');
   * ```
   */
  async makePublic(quickKey: string): Promise<boolean> {
    return this.setPrivacy(quickKey, 'public');
  }

  /**
   * Make a file private
   * 
   * @param quickKey - File quick key
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.makePrivate('abc123quickkey');
   * ```
   */
  async makePrivate(quickKey: string): Promise<boolean> {
    return this.setPrivacy(quickKey, 'private');
  }

  /**
   * Copy a file to another folder
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @param folderKey - Destination folder key (default: root)
   * @returns New quick keys of copied files
   * 
   * @example
   * ```typescript
   * const newKeys = await client.files.copy('abc123', 'destFolder');
   * ```
   */
  async copy(quickKey: string, folderKey?: string): Promise<string[]> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface CopyResponse {
      new_quickkeys?: string[];
    }

    const response = await apiCall<CopyResponse>('file/copy', {
      quick_key: quickKey,
      folder_key: folderKey || 'myfiles'
    }, session);

    return response.new_quickkeys || [];
  }

  /**
   * Delete a file (move to trash)
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.delete('abc123');
   * ```
   */
  async delete(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/delete', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Move a file to another folder
   * 
   * @param quickKey - File quick key (or comma-separated list, max 500)
   * @param folderKey - Destination folder key (default: root)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.move('abc123', 'destFolder');
   * ```
   */
  async move(quickKey: string, folderKey?: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/move', {
      quick_key: quickKey,
      folder_key: folderKey || 'myfiles'
    }, session);

    return true;
  }

  /**
   * Rename a file
   * 
   * @param quickKey - File quick key
   * @param newName - New file name (with extension)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.rename('abc123', 'newname.pdf');
   * ```
   */
  async rename(quickKey: string, newName: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/update', {
      quick_key: quickKey,
      filename: newName
    }, session);

    return true;
  }

  /**
   * Permanently delete a file (cannot be recovered)
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.purge('abc123');
   * ```
   */
  async purge(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/purge', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Restore a file from trash
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.restore('abc123');
   * ```
   */
  async restore(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/restore', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Get file version history
   * 
   * @param quickKey - File quick key
   * @returns Array of file versions
   * 
   * @example
   * ```typescript
   * const versions = await client.files.getVersions('abc123');
   * ```
   */
  async getVersions(quickKey: string): Promise<Array<{ revision: number; date: string }>> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface VersionsResponse {
      file_versions?: Array<{
        revision: string;
        date: string;
      }>;
    }

    const response = await apiCall<VersionsResponse>('file/get_versions', {
      quick_key: quickKey
    }, session);

    return (response.file_versions || []).map(v => ({
      revision: parseInt(v.revision, 10),
      date: v.date
    }));
  }

  /**
   * Get recently modified files
   * 
   * @returns Array of recently modified files
   * 
   * @example
   * ```typescript
   * const recent = await client.files.getRecentlyModified();
   * ```
   */
  async getRecentlyModified(): Promise<FileInfo[]> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface RecentResponse {
      quickkeys?: string[];
    }

    const response = await apiCall<RecentResponse>('file/recently_modified', {}, session);
    
    const files: FileInfo[] = [];
    const quickKeys = response.quickkeys || [];
    
    for (const qk of quickKeys.slice(0, 10)) {
      try {
        const info = await this.getInfo(qk);
        files.push(info);
      } catch {
        // Skip files that can't be retrieved
      }
    }
    
    return files;
  }
}

