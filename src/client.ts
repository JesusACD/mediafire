/**
 * MediaFire Client - Main SDK entry point
 */
import fetch from 'node-fetch';
import { generateSignature } from './auth';
import { sortParams } from './utils';
import { InternalSession } from './api';
import { UserModule } from './modules/user';
import { FilesModule } from './modules/files';
import { FoldersModule } from './modules/folders';
import { UploadModule } from './modules/upload';
import { MediaFireConfig, SessionData, MediaFireError } from './types';

const API_BASE = 'https://www.mediafire.com/api';
const DEFAULT_APP_ID = '42511';
const DEFAULT_API_VERSION = '1.3';

/**
 * MediaFire SDK Client
 * 
 * Main entry point for interacting with MediaFire API.
 * 
 * @example
 * ```typescript
 * import { MediaFireClient } from '@JesusACD/mediafire';
 * 
 * const client = new MediaFireClient();
 * 
 * // Login
 * await client.login('email@example.com', 'password');
 * 
 * // Use modules
 * const user = await client.user.getInfo();
 * const files = await client.folders.getContent();
 * ```
 */
export class MediaFireClient {
  private config: Required<MediaFireConfig>;
  private session: InternalSession | null = null;
  
  // Lazy-loaded modules
  private _user?: UserModule;
  private _files?: FilesModule;
  private _folders?: FoldersModule;
  private _upload?: UploadModule;

  /**
   * Create a new MediaFire client
   * 
   * @param config - Optional configuration
   */
  constructor(config: MediaFireConfig = {}) {
    this.config = {
      appId: config.appId || DEFAULT_APP_ID,
      apiVersion: config.apiVersion || DEFAULT_API_VERSION,
      timeout: config.timeout || 30000
    };
  }

  /**
   * Authenticate with MediaFire
   * 
   * @param email - User email
   * @param password - User password
   * @returns Session data
   * @throws MediaFireError if authentication fails
   * 
   * @example
   * ```typescript
   * const session = await client.login('email@example.com', 'password');
   * console.log(`Logged in as ${session.email}`);
   * ```
   */
  async login(email: string, password: string): Promise<SessionData> {
    // Build login params
    const params = new URLSearchParams();
    params.append('application_id', this.config.appId);
    params.append('email', email);
    params.append('password', password);
    params.append('response_format', 'json');
    params.append('token_version', '2');

    // Sort params alphabetically
    const sortedParams = sortParams(params);

    // Generate signature
    const signature = generateSignature(email, password, this.config.appId);

    // Add signature to query
    const query = sortedParams.toString() + '&signature=' + signature;

    // Make login request
    const response = await fetch(
      `${API_BASE}/${this.config.apiVersion}/user/get_session_token.php`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MediaFire-SDK/1.0 (Node.js)'
        },
        body: query
      }
    );

    interface LoginResponse {
      response?: {
        result?: string;
        message?: string;
        error?: number;
        session_token?: string;
        secret_key?: string;
        time?: string;
      };
    }

    const data: LoginResponse = await response.json();

    if (data.response?.result !== 'Success') {
      throw new MediaFireError(
        data.response?.message || 'Authentication failed',
        data.response?.error,
        data
      );
    }

    // Store session
    this.session = {
      sessionToken: data.response.session_token || '',
      secretKey: data.response.secret_key || '',
      time: data.response.time || '',
      email
    };

    return {
      sessionToken: this.session.sessionToken,
      secretKey: this.session.secretKey,
      time: this.session.time,
      email
    };
  }

  /**
   * Log out and clear session
   */
  logout(): void {
    this.session = null;
  }

  /**
   * Check if client is authenticated
   * 
   * @returns True if logged in
   */
  isAuthenticated(): boolean {
    return this.session !== null;
  }

  /**
   * Get current session data
   * 
   * @returns Session data or null if not authenticated
   */
  getSession(): SessionData | null {
    if (!this.session) return null;
    return {
      sessionToken: this.session.sessionToken,
      secretKey: this.session.secretKey,
      time: this.session.time,
      email: this.session.email
    };
  }

  /**
   * Set session data (for restoring a previous session)
   * 
   * @param session - Session data to restore
   */
  setSession(session: SessionData): void {
    this.session = {
      sessionToken: session.sessionToken,
      secretKey: session.secretKey,
      time: session.time,
      email: session.email
    };
  }

  /**
   * Get internal session (for modules)
   */
  private getInternalSession = (): InternalSession | null => {
    return this.session;
  };

  /**
   * User operations module
   * 
   * @example
   * ```typescript
   * const user = await client.user.getInfo();
   * const storage = await client.user.getStorage();
   * ```
   */
  get user(): UserModule {
    if (!this._user) {
      this._user = new UserModule(this.getInternalSession);
    }
    return this._user;
  }

  /**
   * Files operations module
   * 
   * @example
   * ```typescript
   * const fileInfo = await client.files.getInfo('quickkey');
   * const links = await client.files.getLinks('quickkey');
   * const results = await client.files.search('query');
   * ```
   */
  get files(): FilesModule {
    if (!this._files) {
      this._files = new FilesModule(this.getInternalSession);
    }
    return this._files;
  }

  /**
   * Folders operations module
   * 
   * @example
   * ```typescript
   * const content = await client.folders.getContent();
   * const files = await client.folders.getFiles('folderkey');
   * const folders = await client.folders.getFolders('folderkey');
   * ```
   */
  get folders(): FoldersModule {
    if (!this._folders) {
      this._folders = new FoldersModule(this.getInternalSession);
    }
    return this._folders;
  }

  /**
   * Upload operations module
   * 
   * @example
   * ```typescript
   * const result = await client.upload.file('path/to/file.pdf');
   * const buffer = await client.upload.buffer(data, 'filename.txt');
   * ```
   */
  get upload(): UploadModule {
    if (!this._upload) {
      this._upload = new UploadModule(this.getInternalSession);
    }
    return this._upload;
  }
}
