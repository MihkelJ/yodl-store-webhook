import createHttpError from 'http-errors';

interface JWTToken {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

interface ThingsBoardCredentials {
  username: string;
  password: string;
  serverUrl: string;
}

export class ThingsBoardAuthService {
  private credentials: ThingsBoardCredentials;
  private currentToken: JWTToken | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor(serverUrl: string, username: string, password: string) {
    this.credentials = { serverUrl, username, password };
  }

  public async getValidToken(): Promise<string> {
    if (!this.currentToken || this.isTokenExpired()) {
      await this.refreshToken();
    }

    return this.currentToken!.token;
  }

  private isTokenExpired(): boolean {
    if (!this.currentToken) return true;

    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    return this.currentToken.expiresAt < fiveMinutesFromNow;
  }

  private async refreshToken(): Promise<void> {
    if (this.isRefreshing) {
      while (this.isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${this.credentials.serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password,
        }),
      });

      if (!response.ok) {
        throw createHttpError(
          response.status,
          `ThingsBoard authentication failed: ${response.status} ${response.statusText}`
        );
      }

      const authData = await response.json();

      const expiresAt = Date.now() + 9000 * 1000;

      this.currentToken = {
        token: authData.token,
        refreshToken: authData.refreshToken,
        expiresAt,
      };

      this.scheduleTokenRefresh();
    } catch (error) {
      setTimeout(() => {
        this.isRefreshing = false;
        this.refreshToken();
      }, 60000);

      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, 7200 * 1000);
  }

  public async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getValidToken();

    const response = await fetch(`${this.credentials.serverUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401 && !this.isRefreshing) {
      await this.refreshToken();

      const newToken = await this.getValidToken();
      return fetch(`${this.credentials.serverUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${newToken}`,
          ...options.headers,
        },
      });
    }

    return response;
  }
}
