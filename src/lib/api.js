/**
 * Centralized API client helper for WhatsApp CRM & Customer Chat
 * Automatically resolves endpoint against VITE_API_URL if configured,
 * and safely parses JSON responses with friendly error reporting.
 */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint) {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = apiUrl(endpoint);

  const defaultHeaders = {
    'Accept': 'application/json'
  };

  // Only set Content-Type to JSON if body is not FormData
  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders = {
    ...defaultHeaders,
    ...(options.headers || {})
  };

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });
  } catch (networkErr) {
    console.error('Fetch network error:', networkErr);
    throw new Error('Network error: Unable to reach the server. Please check your internet connection.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (parseErr) {
      console.warn('Failed to parse JSON response:', parseErr);
      data = { error: 'Invalid response format from server.' };
    }
  } else {
    // Non-JSON response (e.g. 404/500 HTML page from Vercel or cloud proxy)
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Backend API route not found (404). Please ensure the API is deployed and reachable.');
      }
      if (res.status >= 500) {
        throw new Error(`Server error (${res.status}). The server encountered an issue processing this request.`);
      }
      throw new Error(`Request failed with status ${res.status}`);
    }
    data = { text };
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed (${res.status})`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}
