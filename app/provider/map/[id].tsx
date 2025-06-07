import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Linking, Platform, Image } from 'react-native';
// Removing MapView import
// import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import { ScaledSheet } from 'react-native-size-matters';

export default function MapViewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
    } else {
      setLoading(false);
      setMapError(true);
    }
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      console.log('Fetching booking details for ID:', id);
      const { data, error } = await supabase
        .from('bookings')
        .select('address')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (!data || !data.address) {
        console.error('No booking data or address found');
        throw new Error('No booking data or address found');
      }
      
      console.log('Fetched booking data:', data);
      console.log('Address to geocode:', data.address);
      
      // Geocode the address using OpenStreetMap Nominatim API
      const encodedAddress = encodeURIComponent(data.address);
      const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}`;
      console.log('Geocoding API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'ServeEz/1.0'
        }
      });
      const geocodeData = await response.json();
      console.log('Geocoding API response:', geocodeData);
      
      if (geocodeData && geocodeData.length > 0) {
        const location = geocodeData[0];
        setBooking({
          address: data.address,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon)
        });
      } else {
        throw new Error('No results found for this address');
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      setMapError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDirections = () => {
    if (booking?.latitude && booking?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location</Text>
      </View>

      {/* Replace MapView with a static location view */}
      <View style={styles.mapContainer}>
        <View style={styles.staticMapContainer}>
          <Ionicons name="location" size={60} color="#007BFF" />
          <Text style={styles.locationText}>
            {booking?.address || 'Address not available'}
          </Text>
          <Text style={styles.coordinatesText}>
            {booking?.latitude && booking?.longitude ? 
              `${booking.latitude.toFixed(6)}, ${booking.longitude.toFixed(6)}` :
              'Coordinates not available'
            }
          </Text>
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={20} color="#666" />
          <Text style={styles.addressText} numberOfLines={2}>{booking?.address || 'Address not available'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.directionsButton}
          onPress={handleOpenDirections}
          disabled={!booking?.latitude || !booking?.longitude}
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '16@s',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    padding: '8@s',
    marginRight: '8@s',
  },
  headerTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  mapFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  staticMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  locationText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  coordinatesText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
  },
  bottomContainer: {
    padding: '16@s',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: '16@s',
    backgroundColor: '#F5F5F5',
    padding: '12@s',
    borderRadius: '8@s',
  },
  addressText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    marginLeft: '8@s',
    flex: 1,
    lineHeight: '20@s',
  },
  directionsButton: {
    backgroundColor: '#007BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12@s',
    borderRadius: '8@s',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginLeft: '8@s',
  },
  loadingText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: '20@s',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20@s',
  },
  errorText: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#FF4B55',
    textAlign: 'center',
    marginTop: '20@s',
    marginBottom: '16@s',
  },
}); 