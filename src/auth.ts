/**
 * Authentication utilities for MediaFire API
 */
import * as crypto from 'crypto';

/**
 * Generate SHA1 signature for authentication
 * Signature is: SHA1(email + password + application_id)
 * 
 * @param email - User email
 * @param password - User password
 * @param appId - Application ID
 * @returns Hex-encoded SHA1 signature
 */
export function generateSignature(email: string, password: string, appId: string): string {
  const sha1 = crypto.createHash('sha1');
  sha1.update(email);
  sha1.update(password);
  sha1.update(appId);
  return sha1.digest('hex');
}

/**
 * Regenerate secret key using MediaFire's algorithm
 * New key = (old_key * 16807) % 2147483647
 * 
 * @param currentKey - Current secret key
 * @returns New secret key
 */
export function regenerateSecretKey(currentKey: string): string {
  const oldKey = parseInt(currentKey, 10);
  const newKey = (oldKey * 16807) % 2147483647;
  return String(newKey);
}

/**
 * Generate request signature for authenticated API calls
 * 
 * @param secretKey - Current secret key
 * @param time - Server time from login
 * @param uri - API endpoint URI
 * @param query - Query string (sorted)
 * @returns MD5 signature
 */
export function generateRequestSignature(
  secretKey: string,
  time: string,
  uri: string,
  query: string
): string {
  const secretKeyMod = parseInt(secretKey, 10) % 256;
  const signatureBase = `${secretKeyMod}${time}${uri}?${query}`;
  return crypto.createHash('md5').update(signatureBase).digest('hex');
}
