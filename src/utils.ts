/**
 * Utility functions for MediaFire SDK
 */

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Sort URLSearchParams alphabetically
 * 
 * @param params - URLSearchParams to sort
 * @returns New sorted URLSearchParams
 */
export function sortParams(params: URLSearchParams): URLSearchParams {
  const entries = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return new URLSearchParams(entries);
}
