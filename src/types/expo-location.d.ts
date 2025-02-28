declare module 'expo-location' {
  export interface LocationObject {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }

  export interface LocationPermissionResponse {
    status: 'granted' | 'denied' | 'undetermined';
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
  }

  export interface GeocodedLocation {
    city: string | null;
    country: string | null;
    district: string | null;
    isoCountryCode: string | null;
    name: string | null;
    postalCode: string | null;
    region: string | null;
    street: string | null;
    streetNumber: string | null;
    subregion: string | null;
    timezone: string | null;
  }

  export interface LocationOptions {
    accuracy?: LocationAccuracy;
    maximumAge?: number;
    timeInterval?: number;
    distanceInterval?: number;
    mayShowUserSettingsDialog?: boolean;
  }

  export enum LocationAccuracy {
    Lowest = 1,
    Low = 2,
    Balanced = 3,
    High = 4,
    Highest = 5,
    BestForNavigation = 6,
  }

  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function getCurrentPositionAsync(options?: LocationOptions): Promise<LocationObject>;
  export function reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<GeocodedLocation[]>;
} 