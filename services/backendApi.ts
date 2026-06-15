import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'pocketlib_access_token';
const REFRESH_TOKEN_KEY = 'pocketlib_refresh_token';
const API_URL_OVERRIDE_KEY = 'pocketlib_api_url_override';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
}

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function inferApiUrl() {
  const configured = Constants.expoConfig?.extra?.apiUrl;
  if (typeof configured === 'string' && configured.trim()) {
    return normalizeApiUrl(configured);
  }

  const hostUri = (Constants.expoConfig as any)?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
  if (host) return `http://${host}:8080`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
  return 'http://localhost:8080';
}

export const API_BASE_URL = inferApiUrl();
let currentApiBaseUrl = API_BASE_URL;
let apiUrlLoaded = false;

export async function getApiBaseUrl(): Promise<string> {
  if (apiUrlLoaded) return currentApiBaseUrl;

  try {
    const stored = await AsyncStorage.getItem(API_URL_OVERRIDE_KEY);
    if (stored?.trim()) {
      currentApiBaseUrl = normalizeApiUrl(stored);
    }
  } catch {
    currentApiBaseUrl = API_BASE_URL;
  }

  apiUrlLoaded = true;
  return currentApiBaseUrl;
}

export function getCurrentApiBaseUrl(): string {
  return currentApiBaseUrl;
}

export async function setApiBaseUrlOverride(url: string): Promise<string> {
  const normalized = normalizeApiUrl(url);
  if (!/^https?:\/\/[^/]+/i.test(normalized)) {
    throw new Error('invalid_api_url');
  }

  currentApiBaseUrl = normalized;
  apiUrlLoaded = true;
  await AsyncStorage.setItem(API_URL_OVERRIDE_KEY, normalized);
  return normalized;
}

export async function clearApiBaseUrlOverride(): Promise<string> {
  currentApiBaseUrl = API_BASE_URL;
  apiUrlLoaded = true;
  await AsyncStorage.removeItem(API_URL_OVERRIDE_KEY);
  return currentApiBaseUrl;
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  if (!access || !refresh) return null;
  return { access_token: access, refresh_token: refresh, token_type: 'Bearer' };
}

export async function setStoredTokens(tokens: AuthTokens) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.access_token],
    [REFRESH_TOKEN_KEY, tokens.refresh_token],
  ]);
}

export async function clearStoredTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function authHeaders(): Promise<Record<string, string>> {
  const tokens = await getStoredTokens();
  if (!tokens?.access_token) return {};
  return { Authorization: `Bearer ${tokens.access_token}` };
}

export function apiUrl(path: string) {
  return `${currentApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.error || `Backend returned ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

async function refreshTokens() {
  const tokens = await getStoredTokens();
  if (!tokens?.refresh_token) return false;

  const response = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  });

  if (!response.ok) {
    await clearStoredTokens();
    return false;
  }

  const data = await parseResponse<{ tokens: AuthTokens }>(response);
  await setStoredTokens(data.tokens);
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth: boolean = true
): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    Object.assign(headers, await authHeaders());
  }

  const request = () => fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers });
  let response = await request();
  if (auth && response.status === 401 && await refreshTokens()) {
    Object.assign(headers, await authHeaders());
    response = await request();
  }

  return parseResponse<T>(response);
}
