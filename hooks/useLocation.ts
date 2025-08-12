import { useState, useEffect, useCallback, useRef } from 'react';
import LocationService, { LocationInfo, LocationData } from '../services/locationService';

export interface UseLocationReturn {
  location: LocationData | null;
  locationText: string;
  state: string;
  lga: string;
  locationError: boolean;
  isRetrying: boolean;
  isInitialized: boolean;
  requestLocation: (forceRefresh?: boolean) => Promise<void>;
  retryLocation: () => Promise<void>;
}

export function useLocation(): UseLocationReturn {
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    location: null,
    address: '',
    region: '',
    subregion: '',
    error: false,
    isLoading: false
  });

  const isMountedRef = useRef(true);
  const locationService = LocationService;

  useEffect(() => {
    isMountedRef.current = true;
    
    // Subscribe to location updates
    const unsubscribe = locationService.subscribe((info: LocationInfo) => {
      if (isMountedRef.current) {
        setLocationInfo(info);
      }
    });

    // Request initial location if not already initialized
    if (!locationService.isLocationInitialized()) {
      requestLocationInternal();
    }

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const requestLocationInternal = useCallback(async (forceRefresh = false) => {
    try {
      await locationService.requestLocation(forceRefresh);
    } catch (error) {
      console.error('Failed to request location:', error);
    }
  }, [locationService]);

  const requestLocation = useCallback(async (forceRefresh = false) => {
    await requestLocationInternal(forceRefresh);
  }, [requestLocationInternal]);

  const retryLocation = useCallback(async () => {
    await requestLocationInternal(true);
  }, [requestLocationInternal]);

  return {
    location: locationInfo.location,
    locationText: locationInfo.address,
    state: locationInfo.region,
    lga: locationInfo.subregion,
    locationError: locationInfo.error,
    isRetrying: locationInfo.isLoading,
    isInitialized: locationService.isLocationInitialized(),
    requestLocation,
    retryLocation
  };
}
