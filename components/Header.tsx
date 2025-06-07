import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Modal, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase, removeAllSubscriptions } from '../services/supabase';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../constants/Colors';
import { UserProfile } from '../types';
import { ThemeToggle } from './common/ThemeToggle';
import { useTheme } from './ThemeProvider';
import Toast from 'react-native-toast-message';
import { useUserStore } from '../store/useUserStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingOverlay from './common/LoadingOverlay';
import { unregisterPushNotifications } from '../services/pushNotifications';

interface HeaderProps {
  profile: UserProfile | null;
  onUpdateProfilePic?: (url: string) => void;
  onReset?: () => void;
}

function Header({ profile, onUpdateProfilePic, onReset }: HeaderProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isDark, colors } = useTheme();
  const isLoggingOut = useRef<boolean>(false);
  const channelRef = useRef<any>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const isNavigatingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadCount = async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('read', false);
        
        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Clean up existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();
      
    // Store the channel reference
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [profile?.id]);

  // Add this new useEffect for handling back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showProfileMenu) {
        closeMenu();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showProfileMenu]);

  // Ensure menu is closed when component unmounts
  useEffect(() => {
    return () => {
      if (showProfileMenu) {
        setShowProfileMenu(false);
      }
    };
  }, []);

  const pickImage = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64FileData = result.assets[0].base64;
        const filePath = `${profile.id}/profile-${Date.now()}.jpg`;

        const { error: uploadError, data } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        if (onUpdateProfilePic) {
          onUpdateProfilePic(publicUrl);
        }

        await supabase
          .from('users')
          .update({ profile_pic: publicUrl })
          .eq('id', profile.id);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    }
  }, [profile?.id, onUpdateProfilePic]);

  const handleLogout = useCallback(async () => {
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
              // Prevent multiple logouts
              if (isLoggingOut.current) return;
              isLoggingOut.current = true;
              
              // Show the loading overlay immediately to prevent any visual flashes
              setShowLoading(true);
              
              // Show a toast first
              Toast.show({
                type: 'info',
                text1: 'Logging out...',
                position: 'top',
                visibilityTime: 2000,
              });
              
              // Get the user ID before clearing the profile
              const userId = profile?.id;
              
              // IMPORTANT: Prevent any navigation attempts during logout process
              isNavigatingRef.current = true;
              
              // Start with clean-up operations that don't affect UI
              
              // Clear subscriptions first to prevent any further real-time updates
              removeAllSubscriptions();
              
              // Unregister push notifications if we have a user ID
              if (userId) {
                try {
                  await unregisterPushNotifications(userId);
                } catch (pushError) {
                  console.error('Error unregistering push notifications:', pushError);
                  // Continue with logout even if this fails
                }
              }
              
              // Force clear session data
              try {
                await AsyncStorage.removeItem('supabase.auth.token');
              } catch (storageError) {
                console.error('Error clearing auth storage:', storageError);
                // Continue anyway
              }
              
              // Now perform the actual sign out from Supabase
              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) {
                console.error('Error during sign out:', signOutError);
                // Continue anyway - we still want to force the user back to login
              }
              
              // CRITICAL: Clear profile state AFTER server-side operations
              // This ensures we don't have UI flashes from profile state changes
              useUserStore.setState({ 
                profile: null,
                isAuthenticated: false
              });
              
              // Wait a brief moment for state to propagate and Supabase to finish
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Final navigation to login screen
              // We do this only once, at the very end
              router.replace('/(auth)/login');
              
              // Reset flags after navigation is initiated
              // The loading overlay will keep showing until navigation completes
              setTimeout(() => {
                isLoggingOut.current = false;
                isNavigatingRef.current = false;
                setShowLoading(false);
              }, 500);
            } catch (error: any) {
              // Error handling - reset all flags and let user try again
              isLoggingOut.current = false;
              isNavigatingRef.current = false;
              setShowLoading(false);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to logout. Please try again.',
                position: 'top',
              });
            }
          },
        },
      ]
    );
  }, [profile?.id, router]);

  const navigateToNotifications = useCallback(() => {
    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      
      // Ensure we close the menu first
      if (showProfileMenu) {
        setShowProfileMenu(false);
      }
      
      // Add a small delay to avoid navigation conflicts
      setTimeout(() => {
        router.push('/notifications');
        isNavigatingRef.current = false;
      }, 50);
    }
  }, [router, showProfileMenu]);

  const handleProfileClick = useCallback(() => {
    // Only open if not in the middle of navigation
    if (!isNavigatingRef.current) {
      setShowProfileMenu(true);
    }
  }, []);

  const closeMenu = useCallback(() => {
    setShowProfileMenu(false);
  }, []);

  const navigateToProfile = useCallback(() => {
    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      closeMenu();
      
      // Small timeout to ensure the modal closes properly first
      setTimeout(() => {
        router.push('/(tabs)/profile');
        isNavigatingRef.current = false;
      }, 100);
    }
  }, [router, closeMenu]);

  const handleLogoutClick = useCallback(() => {
    closeMenu();
    // Small timeout to ensure the modal closes properly first
    setTimeout(() => {
      handleLogout();
    }, 100);
  }, [handleLogout, closeMenu]);

  const handleResetApp = useCallback(() => {
    closeMenu();
    // Small timeout to ensure the modal closes properly first
    setTimeout(() => {
      if (onReset) {
        onReset();
      }
    }, 100);
  }, [onReset, closeMenu]);

  // Generate initials from user's name
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
    if (profile?.profile_pic) {
      return (
        <Image
          source={{ uri: profile.profile_pic }}
          style={styles.profilePic}
        />
      );
    }

    const avatarColor = getAvatarColor(profile?.name);
    const initials = getInitials(profile?.name);

    return (
      <View style={[styles.profilePic, styles.avatarContainer, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    );
  };

  return (
    <>
      <LoadingOverlay visible={showLoading} />
      <View style={[styles.header, { backgroundColor: isDark ? '#000' : colors.background, borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
        <TouchableOpacity 
          style={styles.profileContainer}
          onPress={handleProfileClick}
          activeOpacity={0.7}
        >
          {renderAvatar()}
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <View style={styles.nameContainer}>
            <Text style={[styles.greeting, { color: isDark ? '#aaa' : '#666' }]}>Hi, </Text>
            <Text style={[styles.username, { color: isDark ? '#fff' : '#333' }]} numberOfLines={1} ellipsizeMode="tail">{profile?.name || 'User'}</Text>
          </View>
          <Text style={styles.role}>
            {profile?.role === 'provider' ? 'Provider' : 'User'}
          </Text>
        </View>
        <View style={styles.iconContainer}>
          <ThemeToggle style={styles.themeToggle} />
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={navigateToNotifications}
            disabled={isNavigatingRef.current}
          >
            <Ionicons name="notifications-outline" size={24} color={isDark ? '#fff' : '#333'} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Improved Profile Menu Modal */}
      {showProfileMenu && (
        <Modal
          visible={showProfileMenu}
          transparent={true}
          animationType={Platform.OS === 'ios' ? 'fade' : 'none'}
          onRequestClose={closeMenu}
          statusBarTranslucent={true}
          hardwareAccelerated={true}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closeMenu}
            >
              <View 
                style={[
                  styles.menuContainer, 
                  { backgroundColor: isDark ? '#222' : '#fff' },
                  isDark && { borderColor: '#444' }
                ]}
              >
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={navigateToProfile}
                  activeOpacity={0.7}
                  disabled={isNavigatingRef.current}
                >
                  <Ionicons name="person-outline" size={22} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuText, { color: isDark ? '#fff' : '#333' }]}>View Profile</Text>
                </TouchableOpacity>
                
                {onReset && (
                  <>
                    <View style={[styles.menuDivider, { backgroundColor: isDark ? '#444' : '#eee' }]} />
                    <TouchableOpacity 
                      style={styles.menuItem}
                      onPress={handleResetApp}
                      activeOpacity={0.7}
                      disabled={isNavigatingRef.current}
                    >
                      <Ionicons name="refresh-outline" size={22} color={isDark ? '#40a9ff' : '#1890ff'} />
                      <Text style={[styles.menuText, { color: isDark ? '#40a9ff' : '#1890ff' }]}>Reset App Data</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                <View style={[styles.menuDivider, { backgroundColor: isDark ? '#444' : '#eee' }]} />
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleLogoutClick}
                  activeOpacity={0.7}
                  disabled={isNavigatingRef.current}
                >
                  <Ionicons name="log-out-outline" size={22} color={isDark ? '#ff6b6b' : '#ff4757'} />
                  <Text style={[styles.menuText, { color: isDark ? '#ff6b6b' : '#ff4757' }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileContainer: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 18,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  username: {
    fontSize: 22,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  role: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginTop: 2,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggle: {
    marginRight: 8,
  },
  notificationButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4B55',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Urbanist-Bold',
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Urbanist-Bold',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 70,
    paddingLeft: 16,
  },
  menuContainer: {
    width: 180,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  menuText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Medium',
    marginLeft: 10,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
    width: '100%',
  },
});

export default memo(Header); 