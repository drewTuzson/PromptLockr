export interface AuthUser {
  id: string;
  email: string;
  preferences?: {
    theme: 'light' | 'dark';
    defaultPlatform?: string;
  };
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const TOKEN_KEY = 'promptlockr_token';
const USER_KEY = 'promptlockr_user';

export class AuthService {
  static getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static getStoredUser(): AuthUser | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  static storeAuth(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  static clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getStoredToken();
    if (!token) return {};
    return {
      'Authorization': `Bearer ${token}`,
    };
  }
}
