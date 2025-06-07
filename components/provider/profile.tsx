import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, Platform, BackHandler, RefreshControl, FlatList, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { Text, Button, Portal, Dialog, IconButton, TextInput } from 'react-native-paper';
import { supabase, removeAllSubscriptions } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Provider } from '../../types';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../../constants/Colors';
import DrawerModal from '../../components/common/DrawerModal';
import SettingsDrawer from '../../components/settings/SettingsDrawer';
import { useFocusEffect } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo1.svg';
import { unregisterPushNotifications } from '../../services/pushNotifications';

export default function ProviderProfileScreen() {
  const { profile, isOnline } = useUserStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [gallery, setGallery] = useState<{ id: string; image_url: string; }[]>([]);
  const [providerStats, setProviderStats] = useState({
    completedJobs: 0,
    cancelledJobs: 0
  });
  const [activeTab, setActiveTab] = useState<'Gallery' | 'Reviews'>('Gallery');
  const { isDark, colors } = useTheme();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Animation for the support icon
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // AppState tracking
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());

  // Add fadeAnim for the loading logo animation
  const fadeLogoAnim = useRef(new Animated.Value(0.3)).current;

  // Setup the shaking animation
  useEffect(() => {
    const shakeSequence = () => {
      return Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ]);
    };

    const startShake = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      
      // Run the shake animation
      shakeSequence().start();
      
      // Set the interval for the next shake
      intervalRef.current = setTimeout(startShake, 30000); // 30 seconds
    };

    // Start initial animation
    startShake();
    
    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      shakeAnimation.stopAnimation();
    };
  }, []);

  // Add fade in/out animation function for the loading logo
  const fadeLogoInOut = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeLogoAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      }),
      Animated.timing(fadeLogoAnim, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      })
    ]).start(() => {
      if (loading) {
        fadeLogoInOut();
      }
    });
  }, [loading, fadeLogoAnim]);

  // Start animation when loading
  useEffect(() => {
    if (loading) {
      fadeLogoInOut();
    }
    return () => {
      fadeLogoAnim.stopAnimation();
    };
  }, [loading, fadeLogoInOut]);

  const handleSupportPress = () => {
    router.push("/support");
  };

  const fetchProviderStats = async () => {
    if (!profile?.id) return;
    try {
      // First get provider ID
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (providerError) throw providerError;

      // Get completed jobs count
      const { data: completedData, error: completedError } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', providerData.id)
        .eq('status', 'completed');

      if (completedError) throw completedError;

      // Get cancelled jobs count
      const { data: cancelledData, error: cancelledError } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', providerData.id)
        .eq('status', 'cancelled');

      if (cancelledError) throw cancelledError;

      const completedJobs = completedData?.length || 0;
      const cancelledJobs = cancelledData?.length || 0;
      
      setProviderStats({
        completedJobs,
        cancelledJobs
      });
    } catch (error) {
      console.error('Error fetching provider stats:', error);
    }
  };

  const fetchProviderData = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', profile?.id)
        .single();

      if (error) throw error;
      setProviderData(data);
    } catch (error) {
      console.error('Error fetching provider data:', error);
    }
  };

  const fetchGallery = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_gallery')
        .select('*')
        .eq('provider_id', profile?.id);

      if (error) throw error;
      setGallery(data || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  const fetchReviews = async () => {
    if (!profile?.id) return;
    
    try {
      setLoadingReviews(true);
      console.log('Fetching reviews for provider with user_id:', profile.id);
      
      // First get provider ID
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (providerError) {
        console.error('Error fetching provider ID:', providerError);
        throw providerError;
      }

      console.log('Found provider with ID:', providerData?.id);
      
      // Fetch reviews for this provider with explicit join path
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          user_id,
          users:users!reviews_user_id_fkey (
            name,
            profile_pic
          )
        `)
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        throw error;
      }
      
      console.log('Fetched reviews:', data ? data.length : 0, 'reviews found');
      console.log('Sample review data:', data?.[0]);
      
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // AppState change handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        const now = Date.now();
        const timeInBackground = now - lastActiveTime.current;
        
        // If app was in background for more than 5 minutes (300000ms), refresh data
        if (timeInBackground > 300000) {
          console.log('App was in background for more than 5 minutes, refreshing profile data');
          refreshProfileData();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App is going to the background, save the timestamp
        lastActiveTime.current = Date.now();
      }
      
      appState.current = nextAppState;
    };

    // Subscribe to AppState change events
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Clean up the subscription on unmount
    return () => {
      subscription.remove();
    };
  }, []);

  // Modify the refreshProfileData function to make it use useCallback for consistency
  const refreshProfileData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh user status from the store
      useUserStore.getState().refreshOnlineStatus();
      
      await Promise.all([
        fetchProviderStats(),
        fetchProviderData(),
        fetchGallery(),
        activeTab === 'Reviews' ? fetchReviews() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error refreshing profile data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchProviderStats();
    fetchProviderData();
    fetchGallery();
  }, [profile?.id]);

  // Fetch reviews when tab changes to Reviews
  useEffect(() => {
    if (activeTab === 'Reviews') {
      fetchReviews();
    }
  }, [activeTab]);

  useFocusEffect(
    React.useCallback(() => {
      refreshProfileData();
      
      // Set up real-time subscriptions
      const setupSubscriptions = async () => {
        if (!profile?.id) return;

        try {
          const { data: providerData, error } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          if (error) throw error;

          // Subscribe to bookings changes
          const bookingsChannel = supabase
            .channel('profile-bookings')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `provider_id=eq.${providerData.id}`,
              },
              () => {
                fetchProviderStats();
              }
            )
            .subscribe();
            
          // Subscribe to reviews changes
          const reviewsChannel = supabase
            .channel('profile-reviews')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'reviews',
                filter: `provider_id=eq.${providerData.id}`,
              },
              () => {
                if (activeTab === 'Reviews') {
                  fetchReviews();
                }
              }
            )
            .subscribe();

          return () => {
            bookingsChannel.unsubscribe();
            reviewsChannel.unsubscribe();
          };
        } catch (error) {
          console.error('Error setting up real-time subscriptions:', error);
        }
      };

      const subscription = setupSubscriptions();
      const intervalId = setInterval(() => {
        useUserStore.getState().refreshOnlineStatus();
      }, 500000); 
      
      return () => {
        clearInterval(intervalId);
        if (subscription) {
          subscription.then(cleanup => {
            if (cleanup) cleanup();
          });
        }
      };
    }, [profile?.id, activeTab, refreshProfileData])
  );

  const handleAddService = async () => {
    if (!newService.name || !newService.price) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const updatedServices = [...(providerData?.services || []), newService.name];
      const updatedPricing = {
        ...(providerData?.pricing || {}),
        [newService.name]: parseFloat(newService.price)
      };

      const { error } = await supabase
        .from('providers')
        .update({
          services: updatedServices,
          pricing: updatedPricing
        })
        .eq('user_id', profile?.id);

      if (error) throw error;

      setShowServiceDialog(false);
      setNewService({ name: '', price: '' });
      fetchProviderData();
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('Error', 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              console.log('Starting logout process');
              
              // Clear profile data first
              useUserStore.setState({ profile: null });
              
              // Clean up all Supabase real-time subscriptions to prevent errors
              removeAllSubscriptions();
              
              // Unregister push notifications
              if (profile?.id) {
                try {
                  const { success, error: pushError } = await unregisterPushNotifications(profile.id);
                  if (!success) {
                    console.warn('Failed to unregister push notifications:', pushError);
                  }
                } catch (pushError) {
                  console.error('Error unregistering push notifications:', pushError);
                  // Continue with logout even if this fails
                }
              }
              
              // Then sign out from Supabase
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Error during Supabase sign out:', error);
                throw error;
              }
              console.log('Successfully signed out from Supabase');
              
              // Clear any stored tokens or sessions from AsyncStorage
              try {
                // This is important to ensure no cached session state remains
                await supabase.auth.initialize();
                console.log('Auth state reinitialized');
              } catch (initError) {
                console.warn('Error reinitializing auth state:', initError);
                // Continue with logout even if this fails
              }
              
              // Navigation should happen after state reset and signout
              // Using replace to prevent going back to the profile after logout
              console.log('Redirecting to login screen');
              setTimeout(() => {
                router.replace('/(auth)/login');
              }, 100);
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRemoveGalleryImage = async (imageId: string) => {
    try {
      // First, get the gallery item to retrieve the image URL
      const imageToRemove = gallery.find(item => item.id === imageId);
      
      if (!imageToRemove) {
        throw new Error('Image not found');
      }
      
      // Extract the storage path from the URL
      const imageUrl = imageToRemove.image_url;
      const storagePathMatch = imageUrl.match(/gallery\/([^?]+)/);
      
      if (storagePathMatch && storagePathMatch[1]) {
        const storagePath = storagePathMatch[1];
        console.log('Removing image from storage:', storagePath);
        
        // Delete the image from storage
        const { error: storageError } = await supabase.storage
          .from('gallery')
          .remove([storagePath]);
          
        if (storageError) {
          console.error('Error removing image from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        } else {
          console.log('Image successfully removed from storage');
        }
      }
      
      // Now delete the database entry
      const { error } = await supabase
        .from('provider_gallery')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      
      // Refresh the gallery
      fetchGallery();
      Alert.alert('Success', 'Image removed successfully');
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const handleAddGalleryImage = async () => {
    if (gallery.length >= 4) {
      Alert.alert('Limit Reached', 'You can only add up to 4 images');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64FileData = result.assets[0].base64;
        const filePath = `${profile?.id}/${Date.now()}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('gallery')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg'
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery')
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase.from('provider_gallery').insert({
          provider_id: profile?.id,
          image_url: publicUrl
        });

        if (dbError) throw dbError;
        fetchGallery();
      }
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    }
  };

  // Helper function to extract the filename from a profile picture URL
  const extractFilenameFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch (error) {
      console.error('Error extracting filename from URL:', error);
      return null;
    }
  };

  const handleProfileImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);
        console.log('Image selected successfully');
        const base64FileData = result.assets[0].base64;
        
        // Create a unique filename with timestamp
        const filePath = `profiles/${profile?.id}_${Date.now()}.jpeg`;
        console.log('Uploading to path:', filePath);

        // Upload the new image
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        console.log('Upload successful, public URL:', publicUrl);

        // Delete the old profile picture if it exists
        if (profile?.profile_pic) {
          try {
            const oldFilename = extractFilenameFromUrl(profile.profile_pic);
            if (oldFilename) {
              console.log('Removing old profile image:', oldFilename);
              const pathParts = oldFilename.split('/');
              const fileName = pathParts[pathParts.length - 1];
              
              // Check if the path starts with profiles/ to avoid deleting from wrong bucket
              const storagePath = oldFilename.includes('profiles/') 
                ? oldFilename 
                : `profiles/${fileName}`;
                
              await supabase.storage
                .from('profiles')
                .remove([storagePath]);
                
              console.log('Old profile image removed successfully');
            }
          } catch (removeError) {
            console.log('Non-critical error removing old image:', removeError);
            // Continue with the update even if removal fails
          }
        }

        // Update the user record
        const { error: updateError } = await supabase
          .from('users')
          .update({ profile_pic: publicUrl })
          .eq('id', profile?.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
          throw updateError;
        }

        // Update the local state
        useUserStore.setState(state => ({
          profile: { ...state.profile!, profile_pic: publicUrl }
        }));

        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error handling profile image upload:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.ratingStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={16}
            color={star <= rating ? "#FFD700" : isDark ? "#555" : "#ccc"}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const calculateAverageRating = () => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  // Add renderLoading function
  const renderLoading = () => {
    if (!loading) return null;
    
    return (
      <View style={[
        styles.loadingContainer,
        isDark && { backgroundColor: colors.background }
      ]}>
        <Animated.View style={{ 
          opacity: fadeLogoAnim,
          transform: [{
            scale: fadeLogoAnim.interpolate({
              inputRange: [0.4, 1],
              outputRange: [0.95, 1.05]
            })
          }]
        }}>
          <Logo width={80} height={80} />
        </Animated.View>
        <Text style={[
          styles.loadingText,
          isDark && { color: colors.text }
        ]}>
          Loading profile...
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, isDark && { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <Ionicons name="menu" size={24} color={isDark ? colors.icon : "black"} />
        </TouchableOpacity>
        <View style={styles.headerRightIcons}>
          <TouchableOpacity onPress={handleSupportPress} style={styles.iconButton}>
            <View style={{alignItems: 'center'}}>
              <Text style={styles.iconLabel}>Help</Text>
              <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
                <MaterialIcons name="support-agent" size={24} color={Colors.primary} />
              </Animated.View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color={isDark ? colors.icon : "black"} />
          </TouchableOpacity>
        </View>
      </View>

      {renderLoading()}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshProfileData}
            colors={['#3498db']}
            tintColor={isDark ? "#fff" : "#3498db"}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCardContainer}>
          <View style={[styles.profileCard, isDark && { backgroundColor: '#1E2732' }]}>
            <Text style={styles.levelBadge}>
              {providerData?.services?.[0] || 'Electrician'}
            </Text>
            
            <View style={styles.onlineStatusContainer}>
              <View style={[
                styles.onlineBadge, 
                { backgroundColor: isOnline ? '#2ecc71' : '#e74c3c' }
              ]}>
                <Ionicons name="ellipse" size={10} color="#fff" style={styles.onlineIcon} />
                <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
            
            <View style={styles.profileImageContainer}>
              <TouchableOpacity onPress={handleProfileImageUpload}>
                <Image 
                  source={{ 
                    uri: profile?.profile_pic || 'https://via.placeholder.com/150'
                  }}
                  style={styles.profileImage}
                />
                <View style={styles.editProfileImageOverlay}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.name}>{profile?.name || ""}</Text>
            <Text style={styles.location}>
              {providerData?.location?.city || ''}{providerData?.location?.city && providerData?.location?.state ? ', ' : ''}{providerData?.location?.state || ''}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/(provider)/profile/edit')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[styles.statsContainer, isDark && { backgroundColor: colors.cardBackground, borderRadius: 12, marginHorizontal: 16, padding: 12 }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, isDark && { color: colors.text }]}>{providerStats.completedJobs}</Text>
            <Text style={[styles.statLabel, isDark && { color: colors.subtext }]}>Completed</Text>
          </View>
          <View style={[styles.divider, isDark && { backgroundColor: '#444' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, isDark && { color: colors.text }]}>{providerStats.cancelledJobs}</Text>
            <Text style={[styles.statLabel, isDark && { color: colors.subtext }]}>Cancelled</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, isDark && { borderBottomColor: '#444' }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Gallery' && styles.activeTabButton]}
            onPress={() => setActiveTab('Gallery')}
          >
            <Text style={[
              styles.tabText, 
              activeTab === 'Gallery' && styles.activeTabText,
              isDark && { color: activeTab === 'Gallery' ? colors.text : colors.subtext }
            ]}>Gallery</Text>
            {activeTab === 'Gallery' && <View style={[styles.activeTabIndicator, isDark && { backgroundColor: colors.tint }]} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Reviews' && styles.activeTabButton]}
            onPress={() => setActiveTab('Reviews')}
          >
            <Text style={[
              styles.tabText, 
              activeTab === 'Reviews' && styles.activeTabText,
              isDark && { color: activeTab === 'Reviews' ? colors.text : colors.subtext }
            ]}>Reviews</Text>
            {activeTab === 'Reviews' && <View style={[styles.activeTabIndicator, isDark && { backgroundColor: colors.tint }]} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'Gallery' && (
          <View style={styles.galleryContainer}>
            {gallery.length > 0 ? (
              gallery.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.galleryItem}
                  onLongPress={() => Alert.alert(
                    'Remove Image',
                    'Do you want to remove this image?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', onPress: () => handleRemoveGalleryImage(item.id) }
                    ]
                  )}
                >
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyGalleryContainer}>
                <TouchableOpacity 
                  style={[styles.addGalleryButton, { width: '50%', height: 150 }, isDark && { borderColor: '#444' }]}
                  onPress={handleAddGalleryImage}
                >
                  <Ionicons name="add" size={40} color={isDark ? colors.subtext : "#777"} />
                  <Text style={[styles.addGalleryText, isDark && { color: colors.subtext }]}>Add Photos to Your Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {gallery.length > 0 && gallery.length < 4 && (
              <TouchableOpacity 
                style={[styles.addGalleryButton, isDark && { borderColor: '#444' }]}
                onPress={handleAddGalleryImage}
              >
                <Ionicons name="add" size={32} color={isDark ? colors.subtext : "#777"} />
                <Text style={[styles.addGalleryText, isDark && { color: colors.subtext }]}>Add Photo</Text>
              </TouchableOpacity>
            )}
            
            {gallery.length > 0 && (
              <Text style={[styles.galleryHelpText, isDark && { color: colors.subtext }]}>
                *Long press on an image to remove it
              </Text>
            )}
          </View>
        )}

        {activeTab === 'Reviews' && (
          <View style={[styles.reviewsContainer, isDark && { backgroundColor: 'transparent' }]}>
            {loadingReviews ? (
              <Text style={[styles.noContentText, isDark && { color: colors.subtext }]}>Loading reviews...</Text>
            ) : reviews.length > 0 ? (
              <>
                <View style={[styles.averageRatingContainer, isDark && { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.averageRatingValue, isDark && { color: colors.text }]}>
                    {calculateAverageRating()}
                  </Text>
                  {renderStars(Number(calculateAverageRating()))}
                  <Text style={[styles.totalReviewsText, isDark && { color: colors.subtext }]}>
                    ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                  </Text>
                </View>

                <View style={styles.reviewsList}>
                  {reviews.map(item => (
                    <View 
                      key={item.id}
                      style={[styles.reviewItem, isDark && { backgroundColor: colors.cardBackground, borderColor: 'rgba(255,255,255,0.1)' }]}
                    >
                      <View style={styles.reviewHeader}>
                        <Image 
                          source={{ uri: item.users?.profile_pic || 'https://via.placeholder.com/40' }} 
                          style={styles.reviewerImage} 
                        />
                        <View style={styles.reviewerInfo}>
                          <Text style={[styles.reviewerName, isDark && { color: colors.text }]}>
                            {item.users?.name || "Anonymous"}
                          </Text>
                          <Text style={[styles.reviewDate, isDark && { color: colors.subtext }]}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {renderStars(item.rating)}
                      </View>
                      <Text style={[styles.reviewComment, isDark && { color: colors.text }]}>
                        {item.comment}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.noContentText, isDark && { color: colors.subtext }]}>No reviews yet</Text>
            )}
          </View>
        )}

        <Portal>
          <Dialog visible={showServiceDialog} onDismiss={() => setShowServiceDialog(false)}>
            <Dialog.Title>Add New Service</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Service Name"
                value={newService.name}
                onChangeText={(text) => setNewService(prev => ({ ...prev, name: text }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Price (₦)"
                value={newService.price}
                onChangeText={(text) => setNewService(prev => ({ ...prev, price: text }))}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowServiceDialog(false)}>Cancel</Button>
              <Button onPress={handleAddService} loading={loading}>Add</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <DrawerModal
          isVisible={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          profileImageUri={profile?.profile_pic}
          items={[
            { key: "Home", icon: "home", route: "/(tabs)" },
            { key: "Orders", icon: "list", route: "/(tabs)/services" },
            { key: "Wallet", icon: "wallet", route: "/(tabs)/wallet" },
            { key: "Notifications", icon: "notifications", route: "/notifications" },
            { key: "Settings", icon: "settings", route: "/settings" },
            { key: "Help & Support", icon: "help-circle", route: "/help" },
          ]}
          role={profile?.role}
        />

        <SettingsDrawer
          isVisible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          profileImageUri={profile?.profile_pic}
          headerTitle="Provider Settings"
          sections={[
            {
              title: "Account",
              data: [
                { key: "Edit profile", route: "/(provider)/profile/edit" },
                { key: "Change email and password", route: "/(provider)/profile/edit" },
                { key: "Privacy and data", route: "/terms&condition/Privacy" },
              ],
            },
            {
              title: "Support & About",
              data: [
                { key: "Help & Support", route: "/support" },
                { key: "Terms and Conditions", route: "/terms&condition/page" },
                { key: "Report a problem", route: "/support/report" },
              ],
            },
            {
              title: "Actions",
              data: [
                { 
                  key: "Delete account", 
                  danger: true, 
                  onPress: () => {
                    Alert.alert(
                      "Delete Account",
                      "Are you sure you want to delete your account? This action cannot be undone.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Delete", 
                          style: "destructive",
                          onPress: () => console.log("Delete account pressed")
                        }
                      ]
                    );
                  }
                },
              ],
            },
          ]}
        />
      </ScrollView>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    paddingVertical: '25@s',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '18@s',
    paddingVertical: '14@s',
    backgroundColor: 'white',
    borderBottomWidth: '1@s',
    borderBottomColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: '20@s',
  },
  iconWithLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    fontSize: '11@s',
    color: Colors.primary,
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: '2@s',
  },
  profileCardContainer: {
    alignItems: 'center',
    marginTop: '12@s',
  },
  profileCard: {
    backgroundColor: '#263238',
    borderRadius: '24@s',
    padding: '22@s',
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  levelBadge: {
    color: '#fff',
    fontSize: '12@s',
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: '4@s',
    letterSpacing: '0.5@s',
    textTransform: 'uppercase',
  },
  onlineStatusContainer: {
    position: 'absolute',
    right: '15@s',
    top: '15@s',
    zIndex: 1,
  },
  onlineBadge: {
    paddingHorizontal: '12@s',
    paddingVertical: '6@s',
    borderRadius: '16@s',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  onlineIcon: {
    marginRight: '4@s',
  },
  onlineText: {
    color: '#fff',
    fontSize: '11@s',
    fontFamily: 'Urbanist-SemiBold',
    letterSpacing: '0.5@s',
  },
  profileImageContainer: {
    marginVertical: '18@s',
    position: 'relative',
  },
  profileImage: {
    width: '130@s',
    height: '130@s',
    borderRadius: '65@s',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  editProfileImageOverlay: {
    position: 'absolute',
    bottom: '3@s',
    right: '3@s',
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    width: '36@s',
    height: '36@s',
    borderRadius: '18@s',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    borderWidth: '1.5@s',
    borderColor: '#fff',
  },
  name: {
    fontSize: '20@s',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
    marginTop: '8@s',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  location: {
    color: '#e5e5e5',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
    marginTop: '3@s',
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: '10@s',
  },
  addPhotosText: {
    marginLeft: '6@s',
    color: '#fff',
    fontFamily: 'Urbanist-Medium',
    fontSize: '12@s',
  },
  editButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '10@s',
    paddingHorizontal: '30@s',
    borderRadius: '24@s',
    marginTop: '15@s',
    width: '75%',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  editButtonText: {
    color: 'white',
    fontFamily: 'Urbanist-Bold',
    fontSize: '15@s',
    letterSpacing: '0.5@s',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '24@s',
    marginHorizontal: '16@s',
    padding: '16@s',
    borderRadius: '16@s',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: '24@s',
  },
  statNumber: {
    fontSize: '20@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  statLabel: {
    color: '#777',
    fontSize: '13@s',
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@s',
  },
  divider: {
    width: '1.5@s',
    height: '36@s',
    backgroundColor: '#e0e0e0',
  },
  editBioButton: {
    position: 'absolute',
    right: '16@s',
    top: '10@s',
  },
  editBioText: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Bold',
    fontSize: '14@s',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: '28@s',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: '12@s',
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: '16@s',
    color: '#888',
    fontFamily: 'Urbanist-Medium',
  },
  activeTabText: {
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: '3@s',
    backgroundColor: Colors.primary,
    borderTopLeftRadius: '2@s',
    borderTopRightRadius: '2@s',
  },
  galleryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: '10@s',
  },
  galleryItem: {
    width: '33%',
    aspectRatio: 1,
    padding: '5@s',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: '10@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  reviewsContainer: {
    padding: '16@s',
    minHeight: '200@s',
  },
  reviewsList: {
    paddingBottom: '20@s',
  },
  reviewItem: {
    backgroundColor: 'white',
    borderRadius: '16@s',
    padding: '18@s',
    marginBottom: '14@s',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '10@s',
  },
  reviewerImage: {
    width: '45@s',
    height: '45@s',
    borderRadius: '23@s',
    marginRight: '12@s',
    borderWidth: '1.5@s',
    borderColor: '#f0f0f0',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontFamily: 'Urbanist-Bold',
    fontSize: '15@s',
    marginBottom: '3@s',
  },
  reviewDate: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '12@s',
    color: '#888',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '14@s',
    lineHeight: '22@s',
    color: '#444',
  },
  noContentText: {
    fontSize: '16@s',
    color: '#888',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    marginTop: '50@s',
  },
  input: {
    marginBottom: '14@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '10@s',
  },
  editForm: {
    padding: '16@s',
  },
  sectionTitle: {
    fontSize: '17@s',
    fontFamily: 'Urbanist-Bold',
    marginVertical: '10@s',
    color: '#333',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '10@s',
    backgroundColor: '#f5f5f5',
    padding: '10@s',
    borderRadius: '10@s',
  },
  serviceText: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
  },
  priceInput: {
    width: '120@s',
    marginHorizontal: '8@s',
    backgroundColor: '#fff',
  },
  addButton: {
    marginTop: '10@s',
    borderColor: Colors.primary,
    borderWidth: '1.5@s',
  },
  addGalleryButton: {
    width: '33%',
    aspectRatio: 1,
    padding: '4@s',
    borderWidth: '2@s',
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: '12@s',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '4@s',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  addGalleryText: {
    color: '#777',
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    marginTop: '6@s',
    textAlign: 'center',
  },
  galleryHelpText: {
    width: '100%',
    textAlign: 'center',
    fontSize: '12@s',
    color: '#888',
    fontFamily: 'Urbanist-Regular',
    marginTop: '10@s',
    fontStyle: 'italic',
  },
  emptyGalleryContainer: {
    width: '100%',
    height: '180@s',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20@s',
  },
  passwordButton: {
    marginTop: '8@s',
    backgroundColor: Colors.primary,
    borderRadius: '10@s',
  },
  averageRatingContainer: {
    padding: '16@s',
    borderRadius: '16@s',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  averageRatingValue: {
    fontSize: '36@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '6@s',
    color: '#222',
  },
  totalReviewsText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
    color: '#777',
    marginTop: '6@s',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: '20@s',
    fontFamily: 'Urbanist-Medium',
    fontSize: '16@s',
    color: '#333',
    textAlign: 'center',
  },
}); 