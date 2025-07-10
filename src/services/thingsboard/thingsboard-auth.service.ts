import assert from 'assert';
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
  private static instance: ThingsBoardAuthService;
  private credentials: ThingsBoardCredentials;
  private currentToken: JWTToken | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor(serverUrl: string, username: string, password: string) {
    this.credentials = { serverUrl, username, password };
  }

  public static getInstance(credentials: ThingsBoardCredentials): ThingsBoardAuthService {
    if (!ThingsBoardAuthService.instance) {
      ThingsBoardAuthService.instance = new ThingsBoardAuthService(
        credentials.serverUrl,
        credentials.username,
        credentials.password
      );
    }
    return ThingsBoardAuthService.instance;
  }

  public async getValidToken(): Promise<string> {
    // If no token or token is expired, get a new one
    if (!this.currentToken || this.isTokenExpired()) {
      await this.refreshToken();
    }

    return this.currentToken!.token;
  }

  private isTokenExpired(): boolean {
    if (!this.currentToken) return true;

    // Check if token expires in the next 5 minutes (300 seconds)
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    return this.currentToken.expiresAt < fiveMinutesFromNow;
  }

  private async refreshToken(): Promise<void> {
    if (this.isRefreshing) {
      // Wait for ongoing refresh to complete
      while (this.isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isRefreshing = true;
    console.log('Refreshing ThingsBoard JWT token...');

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
        console.error(`ThingsBoard authentication failed: ${response.status} ${response.statusText}`);
        throw createHttpError(
          response.status,
          `ThingsBoard authentication failed: ${response.status} ${response.statusText}`
        );
      }

      const authData = await response.json();

      // Token is valid for 2.5 hours (9000 seconds)
      const expiresAt = Date.now() + 9000 * 1000;

      this.currentToken = {
        token: authData.token,
        refreshToken: authData.refreshToken,
        expiresAt,
      };

      console.log('ThingsBoard JWT token refreshed successfully');

      // Schedule next refresh 2 hours from now (7200 seconds)
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('Failed to refresh ThingsBoard JWT token:', error);

      // Schedule retry in 1 minute
      setTimeout(() => {
        this.isRefreshing = false;
        this.refreshToken().catch(console.error);
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

    // Refresh token 2 hours from now (7200 seconds)
    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch(console.error);
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

    // If we get 401, token might be invalid, try refreshing once
    if (response.status === 401 && !this.isRefreshing) {
      console.log('Got 401, attempting to refresh token...');
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

  public async destroy(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.currentToken = null;
    this.isRefreshing = false;
    console.log('ThingsBoard auth service destroyed');
  }
}
