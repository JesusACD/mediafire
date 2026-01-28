/**
 * Upload Module - File upload operations
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { InternalSession, apiCall } from '../api';
import { regenerateSecretKey } from '../auth';
import { MediaFireError } from '../types';

const API_BASE = 'https://www.mediafire.com/api';
const DEFAULT_API_VERSION = '1.3';

/**
 * Upload result
 */
export interface UploadResult {
  /** Quick key of uploaded file */
  quickKey: string;
  /** File name */
  filename: string;
  /** File size in bytes */
  size: number;
  /** Upload key (for polling) */
  uploadKey?: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  /** Destination folder key (default: root) */
  folderKey?: string;
  /** Action on duplicate: 'skip', 'keep', 'replace' */
  actionOnDuplicate?: 'skip' | 'keep' | 'replace';
  /** Path within folder */
  path?: string;
}

/**
 * Upload module for file upload operations
 */
export class UploadModule {
  constructor(private getSession: () => InternalSession | null) {}

  /**
   * Upload a file from disk
   * 
   * @param filePath - Path to the file to upload
   * @param options - Upload options
   * @returns Upload result with quick key
   * 
   * @example
   * ```typescript
   * const result = await client.upload.file('C:/path/to/file.pdf');
   * console.log(`Uploaded: ${result.quickKey}`);
   * ```
   */
  async file(filePath: string, options: UploadOptions = {}): Promise<UploadResult> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return this.buffer(fileBuffer, filename, {
      ...options,
      hash: fileHash
    });
  }

  /**
   * Upload a file from buffer
   * 
   * @param buffer - File content as buffer
   * @param filename - File name with extension
   * @param options - Upload options
   * @returns Upload result with quick key
   * 
   * @example
   * ```typescript
   * const buffer = Buffer.from('Hello World');
   * const result = await client.upload.buffer(buffer, 'hello.txt');
   * console.log(`Uploaded: ${result.quickKey}`);
   * ```
   */
  async buffer(buffer: Buffer, filename: string, options: UploadOptions & { hash?: string } = {}): Promise<UploadResult> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    const fileSize = buffer.length;
    const fileHash = options.hash || crypto.createHash('sha256').update(buffer).digest('hex');

    // Build upload params
    const params = new URLSearchParams();
    params.append('response_format', 'json');
    params.append('session_token', session.sessionToken);
    
    if (options.folderKey) {
      params.append('folder_key', options.folderKey);
    }
    if (options.actionOnDuplicate) {
      params.append('action_on_duplicate', options.actionOnDuplicate);
    }
    if (options.path) {
      params.append('path', options.path);
    }

    // Sort params alphabetically (required for signature)
    const sortedParams = new URLSearchParams([...params.entries()].sort());
    
    // Generate signature
    const uri = `/api/${DEFAULT_API_VERSION}/upload/simple.php`;
    const query = sortedParams.toString();
    const secretKeyMod = parseInt(session.secretKey, 10) % 256;
    const signatureBase = `${secretKeyMod}${session.time}${uri}?${query}`;
    const signature = crypto.createHash('md5').update(signatureBase).digest('hex');
    sortedParams.append('signature', signature);

    const uploadUrl = `${API_BASE}/${DEFAULT_API_VERSION}/upload/simple.php?${sortedParams.toString()}`;

    // Upload file
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-filename': encodeURIComponent(filename),
        'x-filesize': String(fileSize),
        'x-filehash': fileHash,
        'User-Agent': 'MediaFire-SDK/1.0 (Node.js)'
      },
      body: buffer
    });

    const responseText = await response.text();
    
    let data: { response?: { doupload?: { result?: string; key?: string }; result?: string; error?: number; message?: string; new_key?: string } };
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new MediaFireError(`Invalid upload response: ${responseText}`);
    }

    if (data.response?.result !== 'Success') {
      throw new MediaFireError(
        data.response?.message || 'Upload failed',
        data.response?.error,
        data
      );
    }

    // Handle secret key regeneration (same as apiCall)
    if (data.response?.new_key === 'yes' && session) {
      session.secretKey = regenerateSecretKey(session.secretKey);
    }

    const uploadKey = data.response?.doupload?.key;
    if (!uploadKey) {
      throw new MediaFireError('No upload key received');
    }

    // Poll for completion
    const result = await this.pollUpload(uploadKey);
    
    return {
      quickKey: result.quickKey,
      filename: result.filename || filename,
      size: result.size || fileSize,
      uploadKey
    };
  }

  /**
   * Poll upload status until complete
   * 
   * @param uploadKey - Upload key from simple upload
   * @returns Upload result
   */
  async pollUpload(uploadKey: string, maxAttempts: number = 30): Promise<{ quickKey: string; filename?: string; size?: number }> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      interface PollResponse {
        doupload?: {
          result?: string;
          status?: string;
          quickkey?: string;
          filename?: string;
          size?: string;
          fileerror?: string;
        };
      }

      const response = await apiCall<PollResponse>('upload/poll_upload', {
        key: uploadKey
      }, session);

      const status = response.doupload?.status;

      // Check for errors
      if (response.doupload?.fileerror) {
        throw new MediaFireError(`Upload error: ${response.doupload.fileerror}`);
      }

      // Status 99 means complete
      if (status === '99' && response.doupload?.quickkey) {
        return {
          quickKey: response.doupload.quickkey,
          filename: response.doupload.filename,
          size: response.doupload.size ? parseInt(response.doupload.size, 10) : undefined
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new MediaFireError('Upload timed out');
  }

  /**
   * Check if a file can be instant uploaded (already exists on MediaFire)
   * 
   * @param hash - SHA256 hash of the file
   * @param filename - File name
   * @param size - File size in bytes
   * @param folderKey - Destination folder key
   * @returns Check result
   * 
   * @example
   * ```typescript
   * const check = await client.upload.check(hash, 'file.pdf', 1024);
   * if (check.hashExists) {
   *   console.log('File can be instant uploaded!');
   * }
   * ```
   */
  async check(hash: string, filename: string, size: number, folderKey?: string): Promise<{
    hashExists: boolean;
    inAccount: boolean;
    inFolder: boolean;
    duplicateQuickKey?: string;
  }> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface CheckResponse {
      hash_exists?: string;
      in_account?: string;
      in_folder?: string;
      duplicate_quickkey?: string;
    }

    const response = await apiCall<CheckResponse>('upload/check', {
      hash,
      filename,
      size,
      folder_key: folderKey || 'myfiles'
    }, session);

    return {
      hashExists: response.hash_exists === 'yes',
      inAccount: response.in_account === 'yes',
      inFolder: response.in_folder === 'yes',
      duplicateQuickKey: response.duplicate_quickkey
    };
  }

  /**
   * Instant upload a file (if it already exists on MediaFire servers)
   * 
   * @param hash - SHA256 hash of the file
   * @param filename - File name
   * @param size - File size in bytes
   * @param folderKey - Destination folder key
   * @returns Upload result
   * 
   * @example
   * ```typescript
   * const result = await client.upload.instant(hash, 'file.pdf', 1024);
   * console.log(`Instant uploaded: ${result.quickKey}`);
   * ```
   */
  async instant(hash: string, filename: string, size: number, folderKey?: string): Promise<UploadResult> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface InstantResponse {
      quickkey?: string;
      filename?: string;
    }

    const response = await apiCall<InstantResponse>('upload/instant', {
      hash,
      filename,
      size,
      folder_key: folderKey || 'myfiles'
    }, session);

    if (!response.quickkey) {
      throw new MediaFireError('Instant upload failed - file may not exist on servers');
    }

    return {
      quickKey: response.quickkey,
      filename: response.filename || filename,
      size
    };
  }
}
