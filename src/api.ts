/**
 * MediaFire API Client - Low-level HTTP client
 */
import fetch from 'node-fetch';
import { generateRequestSignature, regenerateSecretKey } from './auth';
import { sortParams } from './utils';
import { MediaFireError } from './types';

const API_BASE = 'https://www.mediafire.com/api';
const DEFAULT_API_VERSION = '1.3';

/**
 * Internal session state
 */
export interface InternalSession {
  sessionToken: string;
  secretKey: string;
  time: string;
  email: string;
}

/**
 * API call options
 */
export interface ApiCallOptions {
  /** API version to use */
  apiVersion?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Make an API call to MediaFire
 * 
 * @param endpoint - API endpoint (e.g., 'user/get_info')
 * @param params - Request parameters
 * @param session - Session data for authenticated calls
 * @param options - Additional options
 * @returns Parsed API response
 */
export async function apiCall<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  session?: InternalSession | null,
  options: ApiCallOptions = {}
): Promise<T> {
  const apiVersion = options.apiVersion || DEFAULT_API_VERSION;
  
  // Clean endpoint (remove .php if present)
  const cleanEndpoint = endpoint.endsWith('.php') ? endpoint.slice(0, -4) : endpoint;
  const url = `${API_BASE}/${apiVersion}/${cleanEndpoint}.php`;
  
  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.append('response_format', 'json');
  
  // Add session token if available
  if (session?.sessionToken) {
    queryParams.append('session_token', session.sessionToken);
  }
  
  // Add all other params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  
  // Sort params alphabetically (required for signature)
  const sortedParams = sortParams(queryParams);
  
  // Add signature for authenticated calls
  if (session?.secretKey && session?.time) {
    const uri = `/api/${apiVersion}/${cleanEndpoint}.php`;
    const query = sortedParams.toString();
    const signature = generateRequestSignature(
      session.secretKey,
      session.time,
      uri,
      query
    );
    sortedParams.append('signature', signature);
  }
  
  // Make request
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MediaFire-SDK/1.0 (Node.js)'
    },
    body: sortedParams.toString()
  });
  
  const responseText = await response.text();
  
  if (!response.ok) {
    throw new MediaFireError(
      `API request failed: ${response.status}`,
      response.status,
      responseText
    );
  }
  
  let data: { response?: T & { result?: string; error?: number; message?: string; new_key?: string } };
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new MediaFireError(`Invalid JSON response: ${responseText}`);
  }
  
  // Check for API-level errors
  if (data.response?.result === 'Error') {
    throw new MediaFireError(
      data.response?.message || 'Unknown MediaFire API error',
      data.response?.error,
      data
    );
  }
  
  // Handle secret key regeneration
  if (data.response?.new_key === 'yes' && session) {
    session.secretKey = regenerateSecretKey(session.secretKey);
  }
  
  return data.response as T;
}
