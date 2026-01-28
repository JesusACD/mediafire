/**
 * User Module - User and storage operations
 */
import { apiCall, InternalSession } from '../api';
import { UserInfo, StorageQuota } from '../types';
import { formatBytes } from '../utils';

/**
 * User module for user information and storage operations
 */
export class UserModule {
  constructor(private getSession: () => InternalSession | null) {}

  /**
   * Get current user information
   * 
   * @returns User info
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const user = await client.user.getInfo();
   * console.log(`Hello, ${user.displayName}!`);
   * ```
   */
  async getInfo(): Promise<UserInfo> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface UserInfoResponse {
      user_info: {
        email: string;
        display_name?: string;
        first_name?: string;
        last_name?: string;
        premium?: string;
        validated?: string;
        created?: string;
      };
    }

    const response = await apiCall<UserInfoResponse>('user/get_info', {}, session);
    const info = response.user_info;

    return {
      email: info.email,
      displayName: info.display_name || info.first_name || info.email?.split('@')[0] || '',
      firstName: info.first_name,
      lastName: info.last_name,
      premium: info.premium === 'yes',
      validated: info.validated === 'yes',
      createdAt: info.created
    };
  }

  /**
   * Get storage quota information
   * 
   * @returns Storage quota info
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const storage = await client.user.getStorage();
   * console.log(`Used: ${storage.usedFormatted} / ${storage.totalFormatted}`);
   * console.log(`${storage.percentUsed}% used`);
   * ```
   */
  async getStorage(): Promise<StorageQuota> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface StorageResponse {
      user_info: {
        used_storage_size?: string;
        storage_used?: string;
        storage_limit?: string;
        storage_limit_free?: string;
      };
    }

    const response = await apiCall<StorageResponse>('user/get_info', {}, session);
    const info = response.user_info || {};

    const usedBytes = parseInt(info.used_storage_size || info.storage_used || '0', 10);
    // Free accounts get 10GB (10737418240 bytes)
    const totalBytes = parseInt(info.storage_limit || info.storage_limit_free || '10737418240', 10);

    return {
      usedBytes,
      totalBytes,
      usedFormatted: formatBytes(usedBytes),
      totalFormatted: formatBytes(totalBytes),
      percentUsed: totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0
    };
  }
}
