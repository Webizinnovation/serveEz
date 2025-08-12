import * as Location from 'expo-location';

export interface LocationData {
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

export interface LocationInfo {
  location: LocationData | null;
  address: string;
  region: string;
  subregion: string;
  error: boolean;
  isLoading: boolean;
}

class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationData | null = null;
  private isInitialized = false;
  private isRequesting = false;
  private listeners: ((locationInfo: LocationInfo) => void)[] = [];

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  subscribe(callback: (locationInfo: LocationInfo) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current state
    if (this.isInitialized) {
      callback(this.getLocationInfo());
    }
    
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners(locationInfo: LocationInfo) {
    this.listeners.forEach(listener => listener(locationInfo));
  }

  private getLocationInfo(): LocationInfo {
    return {
      location: this.currentLocation,
      address: this.currentLocation ? 'Location found' : 'Location unavailable',
      region: 'Unknown',
      subregion: '',
      error: !this.currentLocation,
      isLoading: this.isRequesting
    };
  }

  async requestLocation(forceRefresh = false): Promise<LocationInfo> {
    // Prevent multiple simultaneous requests
    if (this.isRequesting) {
      console.log('Location request already in progress');
      return this.getLocationInfo();
    }

    // Return cached location if available and not forcing refresh
    if (this.isInitialized && this.currentLocation && !forceRefresh) {
      console.log('Returning cached location');
      return this.getLocationInfo();
    }

    this.isRequesting = true;
    this.notifyListeners({ ...this.getLocationInfo(), isLoading: true });

    try {
      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        const fallbackInfo: LocationInfo = {
          location: null,
          address: 'Location access denied',
          region: 'Unknown',
          subregion: '',
          error: true,
          isLoading: false
        };
        this.isInitialized = true;
        this.notifyListeners(fallbackInfo);
        return fallbackInfo;
      }

      console.log('Getting current position...');
      const position = await this.getCurrentPosition();
      
      if (!position) {
        throw new Error('Failed to get location');
      }

      this.currentLocation = position;
      this.isInitialized = true;

      // Get address information (non-blocking)
      const locationInfo = await this.getAddressInfo(position);
      this.notifyListeners(locationInfo);
      
      return locationInfo;

    } catch (error) {
      console.error('Location request failed:', error);
      
      const errorInfo: LocationInfo = {
        location: null,
        address: 'Location unavailable',
        region: 'Unknown',
        subregion: '',
        error: true,
        isLoading: false
      };
      
      this.isInitialized = true;
      this.notifyListeners(errorInfo);
      return errorInfo;
      
    } finally {
      this.isRequesting = false;
    }
  }

  private async getCurrentPosition(): Promise<LocationData | null> {
    try {
      // Try with balanced accuracy first
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Location timeout')), 10000)
        )
      ]) as Location.LocationObject;

      if (position && this.isValidPosition(position)) {
        return position;
      }
    } catch (error) {
      console.warn('Balanced accuracy failed, trying low accuracy:', error);
    }

    try {
      // Fallback to low accuracy
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Low accuracy timeout')), 8000)
        )
      ]) as Location.LocationObject;

      if (position && this.isValidPosition(position)) {
        return position;
      }
    } catch (error) {
      console.error('All location attempts failed:', error);
    }

    return null;
  }

  private isValidPosition(position: Location.LocationObject): boolean {
    const { latitude, longitude } = position.coords;
    return !!(latitude && longitude && !(latitude === 0 && longitude === 0));
  }

  private async getAddressInfo(position: LocationData): Promise<LocationInfo> {
    const baseInfo: LocationInfo = {
      location: position,
      address: 'Location found',
      region: 'Unknown',
      subregion: '',
      error: false,
      isLoading: false
    };

    try {
      const { latitude, longitude } = position.coords;
      const addressResult = await Promise.race([
        Location.reverseGeocodeAsync({ latitude, longitude }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
        )
      ]) as Location.LocationGeocodedAddress[];

      if (addressResult && addressResult.length > 0) {
        const address = addressResult[0];
        const region = address.region || address.country || 'Unknown';
        const subregion = address.city || address.subregion || '';
        const locationString = `${subregion ? subregion + ', ' : ''}${region}`.trim();

        return {
          ...baseInfo,
          address: locationString || 'Location found',
          region,
          subregion
        };
      }
    } catch (error) {
      console.warn('Geocoding failed (non-critical):', error);
    }

    return baseInfo;
  }

  getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }

  isLocationInitialized(): boolean {
    return this.isInitialized;
  }

  reset() {
    this.currentLocation = null;
    this.isInitialized = false;
    this.isRequesting = false;
    this.listeners = [];
  }
}

export default LocationService.getInstance();
