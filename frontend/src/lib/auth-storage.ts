const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

export const authStorage = {
  getAccessToken: () =>
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,
  getRefreshToken: () =>
    typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setTokens: (accessToken: string, refreshToken: string, user: object) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
