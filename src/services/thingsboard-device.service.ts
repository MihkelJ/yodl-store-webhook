import { ThingsBoardAuthService } from './thingsboard-auth.service.js';

interface Device {
  id: string;
  name: string;
  type: string;
  accessToken: string;
}

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
}

export class ThingsBoardDeviceService {
  private static instance: ThingsBoardDeviceService;
  private authService: ThingsBoardAuthService;
  private deviceCache = new Map<string, DeviceInfo>(); // accessToken -> DeviceInfo

  private constructor(authService: ThingsBoardAuthService) {
    this.authService = authService;
  }

  public static getInstance(authService: ThingsBoardAuthService): ThingsBoardDeviceService {
    if (!ThingsBoardDeviceService.instance) {
      ThingsBoardDeviceService.instance = new ThingsBoardDeviceService(authService);
    }
    return ThingsBoardDeviceService.instance;
  }

  public async getDeviceIdByAccessToken(accessToken: string): Promise<string | null> {
    // Check cache first
    if (this.deviceCache.has(accessToken)) {
      return this.deviceCache.get(accessToken)!.id;
    }

    try {
      console.log(`Looking up device ID for access token: ${accessToken.substring(0, 8)}...`);
      
      // Get all devices and find the one with matching access token
      const devices = await this.getAllDevices();
      
      for (const device of devices) {
        const deviceId = device.id?.id || device.id;
        const deviceCredentials = await this.getDeviceCredentials(deviceId);
        
        if (deviceCredentials && deviceCredentials.credentialsId === accessToken) {
          const deviceInfo: DeviceInfo = {
            id: deviceId,
            name: device.name,
            type: device.type,
          };
          
          // Cache the result
          this.deviceCache.set(accessToken, deviceInfo);
          
          console.log(`Found device: ${device.name} (${deviceId}) for token ${accessToken.substring(0, 8)}...`);
          return deviceId;
        }
      }
      
      console.warn(`No device found for access token: ${accessToken.substring(0, 8)}...`);
      return null;
      
    } catch (error) {
      console.warn('Error looking up device by access token:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private async getAllDevices(): Promise<Device[]> {
    const response = await this.authService.makeAuthenticatedRequest('/api/tenant/devices?pageSize=1000&page=0');
    
    if (!response.ok) {
      throw new Error(`Failed to get devices: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  }

  private async getDeviceCredentials(deviceId: string): Promise<{ credentialsId: string; credentialsType: string } | null> {
    try {
      const response = await this.authService.makeAuthenticatedRequest(`/api/device/${deviceId}/credentials`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get device credentials: ${response.status} ${response.statusText}`);
      }
      
      const credentials = await response.json();
      return credentials;
      
    } catch (error) {
      console.error(`Error getting credentials for device ${deviceId}:`, error);
      return null;
    }
  }

  public async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    try {
      const response = await this.authService.makeAuthenticatedRequest(`/api/device/${deviceId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get device info: ${response.status} ${response.statusText}`);
      }
      
      const device = await response.json();
      return {
        id: device.id.id,
        name: device.name,
        type: device.type,
      };
      
    } catch (error) {
      console.error(`Error getting device info for ${deviceId}:`, error);
      return null;
    }
  }

  public clearCache(): void {
    this.deviceCache.clear();
    console.log('Device cache cleared');
  }

  public getCachedDeviceInfo(accessToken: string): DeviceInfo | null {
    return this.deviceCache.get(accessToken) || null;
  }
}