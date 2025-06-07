import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, ScrollView, Alert, Animated, Easing, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Button } from 'react-native-paper';
import * as Location from 'expo-location';
import DrawerModal from '../../components/common/DrawerModal';
import { UserProfile as UserProfileType } from '../../types';
import { useTheme } from '../../components/ThemeProvider';
import SettingsDrawer from '../../components/settings/SettingsDrawer';
import { MaterialIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import Toast from 'react-native-toast-message';


interface ExtendedUserProfile extends UserProfileType {
  location?: {
    region: string;
    subregion: string;
    current_address?: string;
  } | string;
}

export function UserProfile() {
  const router = useRouter();
  const { profile, updateProfile } = useUserStore();
  const extendedProfile = profile as ExtendedUserProfile | null;
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    currentPassword: '',
    newPassword: '',
  });
  const [locationText, setLocationText] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const { isDark, colors } = useTheme();
  
  // Animation for the support icon
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Location state and refs
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const locationCacheRef = useRef<{
    coords?: { latitude: number, longitude: number },
    address?: Location.LocationGeocodedAddress,
    timestamp?: number
  }>({});

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
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      
      shakeSequence().start();
      intervalRef.current = setTimeout(startShake, 30000);
    };

    startShake();
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      shakeAnimation.stopAnimation();
    };
  }, []);

  const handleSupportPress = () => {
    router.push("/support");
  };

  useEffect(() => {
    if (extendedProfile?.location) {
      if (typeof extendedProfile.location === 'string') {
        setLocationText(String(extendedProfile.location));
      } else if (extendedProfile.location.region) {
        setLocationText(`${extendedProfile.location.region}${extendedProfile.location.subregion ? ', ' + extendedProfile.location.subregion : ''}`);
      }
    }
  }, [extendedProfile]);

  // Helper function to extract the filename from a profile picture URL
  const extractFilenameFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch (error) {
      console.log('Error extracting filename from URL:', error);
      return null;
    }
  };

  // Helper function for retrying fetch requests
  const retryFetch = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Fetch attempt ${i + 1} for URL: ${url}`);
        const response = await fetch(url, options);
        console.log(`Fetch response status: ${response.status}`);
        return response;
      } catch (error) {
        console.log(`Fetch attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries reached');
  };

  // Helper function to check network connectivity
  const checkNetworkConnectivity = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://httpbin.org/status/200', { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('Network connectivity check:', response.ok ? 'Success' : 'Failed');
      return response.ok;
    } catch (error) {
      console.log('Network connectivity check failed:', error);
      return false;
    }
  };

  const handleImagePick = async () => {
    try {
      // Check network connectivity
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

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
        
        // Get the base64 data directly
        const base64FileData = result.assets[0].base64;
        
        // Create a simple file path with timestamp
        const filePath = `profiles/${extendedProfile?.id}_${Date.now()}`;
        
        console.log('Uploading to path:', filePath);
        
        // Use the direct base64 upload method (like in provider profile)
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        console.log('Upload successful, public URL:', publicUrl);

        // Update user profile
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            profile_pic: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', extendedProfile?.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
          throw updateError;
        }

        // Clean up old image if needed
        if (extendedProfile?.profile_pic) {
          try {
            const oldFileName = extractFilenameFromUrl(extendedProfile.profile_pic);
            if (oldFileName) {
              console.log('Removing old image:', oldFileName);
              await supabase.storage.from('profiles').remove([`profiles/${oldFileName}`]);
            }
          } catch (removeError) {
            console.log('Non-critical error removing old image:', removeError);
          }
        }

        // Update local state
        updateProfile({ ...extendedProfile, profile_pic: publicUrl } as any);
        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload profile picture. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);

      // Input validation
      if (!formData.name?.trim()) {
        throw new Error('Name cannot be empty');
      }

      // Verify current password if changing password
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          throw new Error('Current password is required to set a new password');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: extendedProfile?.email || '',
          password: formData.currentPassword,
        });

        if (signInError) {
          throw new Error('Current password is incorrect');
        }
      }

      // Prepare update data
      const updates = {
        id: extendedProfile?.id,
        name: formData.name.trim(),
        updated_at: new Date().toISOString(),
      };

      // Update profile in database
      const { error: updateError, data } = await supabase
        .from('users')
        .update(updates)
        .eq('id', extendedProfile?.id)
        .select()
        .single();

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(updateError.message || 'Failed to update profile');
      }

      // Update password if provided
      if (formData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (passwordError) {
          console.error('Password update error:', passwordError);
          throw new Error('Profile updated but password change failed');
        }
      }

      // Update local state
      if (data) {
        updateProfile({ ...extendedProfile, ...data } as any);
      }

      setIsEditing(false);
      setFormData({
        name: data?.name || extendedProfile?.name || '',
        currentPassword: '',
        newPassword: '',
      });

      Alert.alert('Success', 'Profile updated successfully');

    } catch (error: any) {
      console.error('Profile update error details:', error);
      Alert.alert(
        'Update Failed',
        error.message || 'Please check your connection and try again'
      );
    } finally {
      setLoading(false);
    }
  };

  // Optimized getLocation function - but now only triggered manually
  const getLocation = async () => {
    // Prevent multiple simultaneous location requests
    if (isLoadingLocation) {
      console.log('[UserProfile] Location fetch already in progress');
      return;
    }
    
    try {
      setIsLoadingLocation(true);
      setLoading(true);
      
      // 1. Request location permission (this is necessary regardless of cache)
      console.log('[UserProfile] Requesting location permission');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow location access to update your location');
        return;
      }
      
      // Show loading toast
      Toast.show({
        type: 'info',
        text1: 'Getting your location...',
        text2: 'This may take a moment',
        position: 'bottom',
        visibilityTime: 2000,
      });
      
      // 2. Get current position (always fetch fresh location)
      console.log('[UserProfile] Getting fresh location coordinates');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      if (!position) {
        throw new Error('Could not get location');
      }
      
      const coords = position.coords;
      
      // 3. Get address from coordinates
      console.log('[UserProfile] Getting fresh address from coordinates');
      const [address] = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      
      if (!address) {
        throw new Error('Could not get address from location');
      }
      
      // Format location string
      const locationString = formatLocationString(address);
      
      // Create location object for database
      const locationObject = {
        region: address.region || address.country || '',
        subregion: address.city || address.subregion || '',
        current_address: locationString,
        coords: { latitude: coords.latitude, longitude: coords.longitude }
      };
      
      // Update UI immediately for better UX
      setLocationText(locationString);
      
      // Update database
      const { error: updateError } = await supabase
        .from('users')
        .update({ location: locationObject })
        .eq('id', extendedProfile?.id);

      if (updateError) {
        console.error('[UserProfile] Supabase update error:', updateError);
        throw new Error('Failed to save location to database');
      }

      // Update local state
      updateProfile({ 
        ...extendedProfile, 
        location: locationObject 
      } as any);
      
      console.log('[UserProfile] Location updated successfully');
      Toast.show({
        type: 'success',
        text1: 'Location Updated',
        text2: locationString,
        position: 'bottom',
      });
      
    } catch (error: any) {
      console.error('[UserProfile] Location error details:', error);
      
      Alert.alert(
        'Error updating location',
        error.message || 'Please check your internet connection and try again'
      );
    } finally {
      setIsLoadingLocation(false);
      setLoading(false);
    }
  };
  
  // Helper function to format location string
  const formatLocationString = (address: Location.LocationGeocodedAddress) => {
    const parts = [
      address.city,
      address.region,
      address.country
    ].filter(Boolean);
    
    if (parts.length === 0) {
      return "Unknown location";
    }
    
    return parts.join(', ');
  };

  // Generate initials from user's name for avatar
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    
    const names = name.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Generate a consistent background color based on user's name
  const getAvatarColor = (name: string | undefined) => {
    if (!name) return '#888888';
    
    // Create a simple hash of the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to hex color
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 60%)`;
  };

  // Render avatar with initials if no profile pic
  const renderAvatar = () => {
    if (extendedProfile?.profile_pic) {
      return (
        <Image 
          source={{ uri: extendedProfile.profile_pic }} 
          style={styles.profileImage} 
        />
      );
    }

    const avatarColor = getAvatarColor(extendedProfile?.name);
    const initials = getInitials(extendedProfile?.name);

    return (
      <View style={[styles.profileImage, styles.avatarContainer, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      {/* Static Header */}
      <View style={[styles.headerContainer, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0' }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={() => setIsDrawerOpen(true)}
          >
            <Ionicons name="menu-outline" size={28} color={colors.icon} />
          </TouchableOpacity>
          <View style={styles.headerRightIcons}>
            <TouchableOpacity onPress={handleSupportPress} style={styles.iconButtonContainer}>
              <View style={styles.iconWithLabel}>
                <Animated.View style={[styles.iconCircle, { transform: [{ translateX: shakeAnimation }] }]}>
                  <MaterialIcons name="support-agent" size={24} color={Colors.primary} />
                </Animated.View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setIsSettingsDrawerOpen(true)} 
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerDivider} />
      </View>

      {/* Add DrawerModal */}
      <DrawerModal
        isVisible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        profileImageUri={extendedProfile?.profile_pic}
        role={extendedProfile?.role}
      />

      {/* Add SettingsDrawer */}
      <SettingsDrawer
        isVisible={isSettingsDrawerOpen} 
        onClose={() => setIsSettingsDrawerOpen(false)}
        profileImageUri={extendedProfile?.profile_pic}
      />

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <View style={styles.imageContainer}>
            {renderAvatar()}
            <TouchableOpacity 
              style={styles.editImageButton} 
              onPress={handleImagePick}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{extendedProfile?.name}</Text>
          <TouchableOpacity 
            style={[
              styles.locationContainer, 
              isLoadingLocation && styles.locationLoading
            ]} 
            onPress={getLocation}
            activeOpacity={0.7}
            disabled={isLoadingLocation}
          >
            <Ionicons 
              name={isLoadingLocation ? "locate" : "location-outline"} 
              size={16} 
              color={Colors.primary} 
            />
            <Text style={styles.locationText}>
              {isLoadingLocation ? 'Getting location...' : (locationText || 'No location set')}
            </Text>
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 5 }} />
            ) : (
              <Ionicons name="refresh-outline" size={14} color={Colors.primary} style={{marginLeft: 5}} />
            )}
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
          
          {/* Email */}
          <View style={[
            styles.inputContainer, 
            styles.disabledInput,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderColor: colors.border }
          ]}>
            <Ionicons name="mail-outline" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : "#aaa"} style={styles.inputIcon} />
            <TextInput 
              value={extendedProfile?.email} 
              editable={false} 
              style={[styles.input, { color: isDark ? 'rgba(255,255,255,0.6)' : "#888" }]}
              placeholder="Email"
              placeholderTextColor={isDark ? colors.subtext : "gray"}
            />
            <Ionicons name="lock-closed-outline" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : "#aaa"} />
          </View>
          
          {/* Phone */}
          <View style={[
            styles.inputContainer, 
            styles.disabledInput,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderColor: colors.border }
          ]}>
            <Ionicons name="call-outline" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : "#aaa"} style={styles.inputIcon} />
            <TextInput 
              value={extendedProfile?.phone} 
              editable={false} 
              style={[styles.input, { color: isDark ? 'rgba(255,255,255,0.6)' : "#888" }]}
              placeholder="Phone Number"
              placeholderTextColor={isDark ? colors.subtext : "gray"}
            />
            <Ionicons name="lock-closed-outline" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : "#aaa"} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 25 }]}>Editable Information</Text>

          {/* Username */}
          <View style={[
            styles.inputContainer, 
            isEditing ? styles.activeInput : null,
            { backgroundColor: isDark ? colors.cardBackground : '#f5f5f5', borderColor: colors.border }
          ]}>
            <Ionicons 
              name="person-outline" 
              size={20} 
              color={isEditing ? Colors.primary : (isDark ? colors.subtext : "gray")} 
              style={styles.inputIcon} 
            />
            <TextInput 
              value={isEditing ? formData.name : extendedProfile?.name}
              onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
              editable={isEditing}
              style={[
                styles.input, 
                isEditing ? styles.editableInput : null, 
                { color: isEditing ? (isDark ? colors.text : '#000') : (isDark ? colors.text : "#333") }
              ]}
              placeholder="Username"
              placeholderTextColor={isDark ? colors.subtext : "gray"}
            />
            {isEditing && <Ionicons name="create-outline" size={16} color={Colors.primary} />}
          </View>

          {/* Password */}
          {isEditing ? (
            <>
              {/* Current Password */}
              <View style={[
                styles.inputContainer, 
                styles.activeInput,
                { backgroundColor: isDark ? colors.cardBackground : '#f5f5f5', borderColor: colors.border }
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={Colors.primary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  secureTextEntry={!passwordVisible}
                  value={formData.currentPassword}
                  onChangeText={text => setFormData(prev => ({ ...prev, currentPassword: text }))}
                  style={[styles.input, { flex: 1, color: isDark ? colors.text : '#000' }]}
                  placeholder="Current Password"
                  placeholderTextColor={isDark ? colors.subtext : "gray"}
                />
                <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                  <Ionicons 
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={Colors.primary} 
                  />
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <View style={[
                styles.inputContainer, 
                styles.activeInput,
                { backgroundColor: isDark ? colors.cardBackground : '#f5f5f5', borderColor: colors.border }
              ]}>
                <Ionicons 
                  name="key-outline" 
                  size={20} 
                  color={Colors.primary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  secureTextEntry={!passwordVisible}
                  value={formData.newPassword}
                  onChangeText={text => setFormData(prev => ({ ...prev, newPassword: text }))}
                  style={[styles.input, { flex: 1, color: isDark ? colors.text : '#000' }]}
                  placeholder="New Password (optional)"
                  placeholderTextColor={isDark ? colors.subtext : "gray"}
                />
                <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                  <Ionicons 
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={Colors.primary} 
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={[
              styles.inputContainer, 
              { backgroundColor: isDark ? colors.cardBackground : '#f5f5f5', borderColor: colors.border }
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color={isDark ? colors.subtext : "gray"} style={styles.inputIcon} />
              <TextInput
                secureTextEntry
                value="********"
                editable={false}
                style={[styles.input, { color: isDark ? colors.text : "#333" }]}
                placeholder="Password"
                placeholderTextColor={isDark ? colors.subtext : "gray"}
              />
              <Text style={styles.passwordHint}>(hidden)</Text>
            </View>
          )}

          {/* Edit/Save buttons */}
          <View style={styles.buttonContainer}>
            {isEditing ? (
              <>
                <Button 
                  mode="contained" 
                  onPress={handleUpdateProfile}
                  loading={loading}
                  style={styles.saveButton}
                  labelStyle={styles.buttonLabel}
                  contentStyle={{height: 45}}
                >
                  Save Changes
                </Button>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setIsEditing(false);
                    setFormData({
                      name: profile?.name || '',
                      currentPassword: '',
                      newPassword: '',
                    });
                  }}
                  style={[styles.cancelButton, { borderColor: Colors.primary }]}
                  labelStyle={[styles.buttonLabel, {color: Colors.primary}]}
                  contentStyle={{height: 45}}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                mode="contained" 
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
                labelStyle={styles.buttonLabel}
                contentStyle={{height: 45}}
                icon="pencil"
              >
                Edit Profile
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  mainContainer: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    borderBottomWidth: 1,
    paddingTop: '5@ms',
    zIndex: 10,
  },
  headerDivider: {
    height: 1,
    backgroundColor: Colors.primary + '20',
    width: '100%',
    marginTop: '1@ms',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: '16@ms', 
    paddingTop: '16@ms',
    paddingBottom: '30@ms',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: '9@ms',
    paddingHorizontal: '4@ms',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: '10@ms',
    marginLeft: '4@ms',
    borderRadius: '20@ms',
  },
  settingsButton: {
    padding: '10@ms',
    marginRight: '4@ms',
    borderRadius: '20@ms',
  },
  iconButtonContainer: {
    padding: '8@ms',
    borderRadius: '20@ms',
  },
  iconButton: {
    marginLeft: '16@ms',
  },
  iconCircle: {
    padding: '5@ms',
    borderRadius: '20@ms',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: '30@ms',
    marginTop: '10@ms',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: '16@ms',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  profileImage: {
    width: '170@ms',
    height: '170@ms',
    borderRadius: '85@ms',
    borderWidth: 3,
    borderColor: Colors.primary + '30',
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#888',
  },
  avatarText: {
    fontSize: '50@ms',
    fontFamily: 'Urbanist-Bold',
    color: 'white',
  },
  editImageButton: {
    position: 'absolute',
    bottom: '5@ms',
    right: '5@ms',
    backgroundColor: Colors.primary,
    padding: '8@ms',
    borderRadius: '16@ms',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  name: {
    fontSize: '22@ms',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '10@ms',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4@ms',
    paddingVertical: '8@ms',
    paddingHorizontal: '12@ms',
    borderRadius: '20@ms',
    backgroundColor: Colors.primary + '15',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  locationText: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    flexShrink: 1,
  },
  formSection: {
    gap: '14@ms',   
    marginTop: '5@ms',   
    paddingHorizontal: '5@ms',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@ms',
    marginLeft: '5@ms',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '14@ms',   
    borderRadius: '12@ms',  
    borderWidth: 1,
    marginBottom: '10@ms',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  disabledInput: {
    opacity: 0.8,
    borderStyle: 'dashed',
  },
  activeInput: {
    borderColor: Colors.primary + '80',
    borderWidth: 1.5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: '10@ms',   
  },
  input: {
    flex: 1,
    fontSize: '15@ms',    
    fontFamily: 'Urbanist-Medium',
    paddingVertical: '2@ms',  
  },
  editableInput: {
    fontFamily: 'Urbanist-SemiBold',
  },
  passwordHint: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#999',
    marginRight: '5@ms',
  },
  buttonContainer: {
    gap: '10@ms', 
    marginTop: '25@ms', 
    marginBottom: '24@ms',  
  },
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: '12@ms',  
    paddingVertical: '6@ms',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: '12@ms', 
    paddingVertical: '6@ms',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButton: {
    borderColor: Colors.primary,
    borderRadius: '12@ms',
    paddingVertical: '6@ms',
  },
  buttonLabel: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    letterSpacing: '0.5@ms',
  },
  iconWithLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLoading: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
    borderWidth: 1,
  },
});