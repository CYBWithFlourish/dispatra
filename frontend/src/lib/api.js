const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    nonce: (address) => request('/auth/nonce', { method: 'POST', body: JSON.stringify({ address }) }),
    login: (message, signature) => request('/auth/login', { method: 'POST', body: JSON.stringify({ message, signature }) }),
    verifyWallet: (message, signature) => request('/auth/verify-wallet', { method: 'POST', body: JSON.stringify({ message, signature }) }),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  jobs: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/jobs${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/jobs/${id}`),
    create: (data) => request('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    sync: (jobId) => request('/jobs/sync', { method: 'POST', body: JSON.stringify({ jobId }) }),
    syncAll: () => request('/jobs/sync-all', { method: 'POST' }),
  },

  kyc: {
    createApplicant: (role) => request('/kyc/create-applicant', { method: 'POST', body: JSON.stringify({ role }) }),
    status: (address) => request(`/kyc/status/${address}`),
    token: (address) => request(`/kyc/token/${address}`),
  },

  users: {
    get: (address) => request(`/users/${address}`),
    update: (address, data) => request(`/users/${address}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};
