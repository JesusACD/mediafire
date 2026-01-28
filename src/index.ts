/**
 * @JesusACD/mediafire - MediaFire SDK for Node.js
 * 
 * @packageDocumentation
 */

// Main client
export { MediaFireClient } from './client';

// Types
export * from './types';

// Modules (for advanced usage)
export { UserModule } from './modules/user';
export { FilesModule } from './modules/files';
export { FoldersModule, GetContentOptions } from './modules/folders';
export { UploadModule, UploadResult, UploadOptions } from './modules/upload';

