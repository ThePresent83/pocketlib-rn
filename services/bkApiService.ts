import Constants from 'expo-constants';

const expoHost = Constants.expoConfig?.hostUri?.split(':')[0] || '10.0.2.2';
export const BK_API_URL = process.env.EXPO_PUBLIC_BK_API_URL || `http://${expoHost}:3047`;

export interface OfficialStats {
  totalBooks: number;
  selectedBooks?: number;
  officialSources?: number;
  checkedBooks: number;
  officiallyAvailable: number;
  candidatesFound: number;
  notAvailableOnline: number;
}

export interface OfficialLink {
  id: string;
  provider: string;
  sourceType: string;
  title: string;
  url: string;
  canDownload?: boolean;
  confidence?: number;
}

export interface OfficialBook {
  key: string;
  source: string;
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  year?: string;
  language?: string;
  courseNumber?: number | null;
  discipline?: string;
  topic?: string;
  contentStatus: string;
  officialSourceUrl?: string;
  externalLinks?: OfficialLink[];
  candidateLinks?: OfficialLink[];
  matchConfidence?: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BK_API_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`BK API ${response.status}`);
  }
  return response.json();
}

export async function getOfficialStats(): Promise<OfficialStats> {
  return request<OfficialStats>('/api/official/stats');
}

export async function getOfficialBooks(filters: {
  courseNumber?: string;
  discipline?: string;
  language?: string;
  status?: string;
} = {}): Promise<OfficialBook[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  const data = await request<{ total: number; items: OfficialBook[] }>(`/api/official/books${query ? `?${query}` : ''}`);
  return data.items || [];
}

export async function getOfficialCandidates(): Promise<OfficialBook[]> {
  const data = await request<{ total: number; items: OfficialBook[] }>('/api/official/candidates');
  return data.items || [];
}

export async function runOfficialFilter(): Promise<OfficialStats> {
  return request<OfficialStats>('/api/official/filter', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ limit: 100 }),
  });
}

export async function classifyOfficialBooks(): Promise<{ total: number; classified: number; unassigned: number }> {
  return request<{ total: number; classified: number; unassigned: number }>('/api/official/classify', { method: 'POST' });
}

export async function attachCandidate(book: OfficialBook, candidateId: string): Promise<OfficialBook> {
  return request<OfficialBook>(`/api/books/${book.source}/${book.id}/attach-candidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });
}

export async function rejectCandidate(book: OfficialBook, candidateId: string): Promise<OfficialBook> {
  return request<OfficialBook>(`/api/books/${book.source}/${book.id}/reject-candidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });
}
