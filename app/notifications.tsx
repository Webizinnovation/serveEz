import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Animated, Platform, ToastAndroid } from 'react-native';
import { Text, Divider, Surface, Badge, Snackbar } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';
import { Notification } from '../types/index';
import { Colors } from '../constants/Colors';
import { useTheme } from '../components/ThemeProvider';
import LogoSvg from '../assets/images/Svg/logo1.svg';

// Extend notification type for our implementation
interface ExtendedNotification extends Notification {
  reference_id?: string;
}

// Memoized notification item component for better performance
const NotificationItem = memo(({ 
  item, 
  getNotificationColor, 
  getNotificationIcon, 
  formatDate,
  colors,
  onPress
}: { 
  item: ExtendedNotification; 
  getNotificationColor: (type: Notification['type']) => string[];
  getNotificationIcon: (type: Notification['type']) => React.ReactNode;
  formatDate: (dateString: string) => string;
  colors: any;
  onPress: (item: ExtendedNotification) => void;
}) => {
  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={() => onPress(item)}
    >
      <Surface style={[styles.notificationItem, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.notificationContent}>
          <LinearGradient 
            colors={getNotificationColor(item.type) as [string, string, ...string[]]}
            style={styles.iconContainer}
          >
            {getNotificationIcon(item.type)}
          </LinearGradient>
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {item.title}
              </Text>
              <Text style={[styles.timeText, { color: colors.subtext }]}>
                {formatDate(item.created_at)}
              </Text>
            </View>
            <Text style={[styles.message, { color: colors.subtext }]} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </View>
        {!item.read && (
          <Badge 
            size={8} 
            style={[styles.unreadIndicator, { backgroundColor: Colors.primary }]} 
          />
        )}
        <Divider style={[styles.divider, { backgroundColor: colors.border }]} />
      </Surface>
    </TouchableOpacity>
  );
});

// Animated logo component for loading state
const AnimatedLogoLoader = ({ colors, isDark }: { colors: any; isDark: boolean }) => {
  const fadeValue = useState(new Animated.Value(0.4))[0];
  const scaleValue = useState(new Animated.Value(0.8))[0];
  const shadowValue = useState(new Animated.Value(3))[0];
  const glowValue = useState(new Animated.Value(0.1))[0];
  const textFadeValue = useState(new Animated.Value(0.7))[0];
  const [loadingText, setLoadingText] = useState("Loading notifications");

  useEffect(() => {
    // Create ellipsis animation
    const ellipsisInterval = setInterval(() => {
      setLoadingText(current => {
        if (current === "Loading notifications") return "Loading notifications.";
        if (current === "Loading notifications.") return "Loading notifications..";
        if (current === "Loading notifications..") return "Loading notifications...";
        return "Loading notifications";
      });
    }, 500);

    return () => clearInterval(ellipsisInterval);
  }, []);

  useEffect(() => {
    // Native driver animations (opacity and transform)
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Text fade animation (native driver)
    Animated.loop(
      Animated.sequence([
        Animated.timing(textFadeValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(textFadeValue, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Scale animation (native driver)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 1200,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [fadeValue, scaleValue, textFadeValue]);

  // JavaScript driver animations (shadow and glow)
  useEffect(() => {
    // Shadow and glow animation (JS driver)
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(shadowValue, {
            toValue: 10,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(glowValue, {
            toValue: 0.25,
            duration: 1200,
            useNativeDriver: false,
          })
        ]),
        Animated.parallel([
          Animated.timing(shadowValue, {
            toValue: 3,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(glowValue, {
            toValue: 0.1,
            duration: 1200,
            useNativeDriver: false,
          })
        ])
      ])
    ).start();
  }, [shadowValue, glowValue]);

  // Calculate the dynamic background color with varying opacity
  const backgroundColor = glowValue.interpolate({
    inputRange: [0.1, 0.25],
    outputRange: [
      isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.15)', 
      isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.35)'
    ]
  });

  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        {/* Outer View with JS animations (shadow & background) */}
        <Animated.View 
          style={[
            styles.logoWrapper,
            { 
              backgroundColor,
              shadowRadius: shadowValue,
              shadowOpacity: isDark ? 0.5 : 0.3,
              shadowColor: Colors.primary,
              elevation: Platform.OS === 'android' ? shadowValue : undefined
            }
          ]}
        >
          {/* Inner View with native animations (opacity & transform) */}
          <Animated.View
            style={{
              opacity: fadeValue,
              transform: [{ scale: scaleValue }],
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogoSvg width={80} height={80} />
          </Animated.View>
        </Animated.View>
        <Animated.Text style={[styles.loadingText, { color: colors.text, opacity: textFadeValue }]}>
          {loadingText}
        </Animated.Text>
      </View>
    </View>
  );
};

export default function NotificationsScreen() {
  const { profile } = useUserStore();
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Compare with previous notifications to only update if changed
      if (JSON.stringify(data) !== JSON.stringify(notifications)) {
        setNotifications(data || []);
        
        // Animation sequence
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          })
        ]).start();
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, notifications, fadeAnim, slideAnim]);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile!.id)
        .eq('read', false);

      if (error) throw error;
      
      // Update local state to avoid refetching
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({
          ...notification,
          read: true
        }))
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, [profile]);

  const handleNotificationPress = useCallback((notification: ExtendedNotification) => {
    // Mark single notification as read when tapped
    if (!notification.read) {
      try {
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id)
          .then(() => {
            // Update local state
            setNotifications(prevNotifications => 
              prevNotifications.map(item => 
                item.id === notification.id ? { ...item, read: true } : item
              )
            );
          });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Show feedback to the user
    const message = `${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)} notification marked as read`;
    
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    }

    // TODO: Add navigation when pages are built

  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    
    // Only mark as read on initial load
    if (loading) {
      markAllAsRead();
    }
    
    // Set up real-time subscription for new notifications
    const subscription = supabase
      .channel('public:notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${profile?.id}` 
      }, () => {
        fetchNotifications();
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchNotifications, profile, loading, markAllAsRead]);

  const getNotificationIcon = useCallback((type: Notification['type']) => {
    switch (type) {
      case 'order':
        return <FontAwesome5 name="shopping-bag" size={20} color="#fff" />;
      case 'chat':
        return <Ionicons name="chatbubble" size={20} color="#fff" />;
      case 'payment':
        return <MaterialCommunityIcons name="cash-multiple" size={20} color="#fff" />;
      default:
        return <Ionicons name="notifications" size={20} color="#fff" />;
    }
  }, []);

  const getNotificationColor = useCallback((type: Notification['type']) => {
    switch (type) {
      case 'order':
        return isDark ? ['#388E3C', '#1B5E20'] : ['#4CAF50', '#2E7D32'];
      case 'chat':
        return isDark ? ['#1976D2', '#0D47A1'] : ['#2196F3', '#1565C0'];
      case 'payment':
        return isDark ? ['#F57C00', '#E65100'] : ['#FF9800', '#EF6C00'];
      default:
        return isDark ? ['#7B1FA2', '#4A148C'] : ['#9C27B0', '#6A1B9A'];
    }
  }, [isDark]);

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      
      // Just now (less than a minute ago)
      if (diffMin < 1) {
        return 'Just now';
      }
      
      // Minutes
      if (diffMin < 60) {
        return `${diffMin}m ago`;
      }
      
      // Hours
      if (diffHour < 24) {
        return `${diffHour}h ago`;
      }
      
      // Days (up to a week)
      if (diffDay < 7) {
        return `${diffDay}d ago`;
      }
      
      // Date format for this year
      if (date.getFullYear() === now.getFullYear()) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
      }
      
      // Full date for other years
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Unknown date';
    }
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(notification => !notification.read).length;
  }, [notifications]);

  const EmptyNotifications = useCallback(() => (
    <Animated.View 
      style={[
        styles.emptyContainer, 
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }] 
        }
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name="notifications-off-outline" 
          size={70} 
          color={isDark ? '#555' : '#ccc'} 
        />
      </View>
      <Text style={[styles.emptyText, { color: colors.text }]}>
        No notifications yet
      </Text>
      <Text style={[styles.emptySubText, { color: colors.subtext }]}>
        We'll notify you when something important happens
      </Text>
    </Animated.View>
  ), [colors, fadeAnim, slideAnim, isDark]);

  if (loading) {
    return <AnimatedLogoLoader colors={colors} isDark={isDark} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        backgroundColor={colors.background} 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
      />
      <Stack.Screen 
        options={{
          title: 'Notifications',
          headerShown: true,
          headerTintColor: colors.text,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          headerRight: () => (
            notifications.length > 0 && getUnreadCount() > 0 ? (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={markAllAsRead}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.clearButtonText, { color: Colors.primary }]}>
                  Mark all as read
                </Text>
              </TouchableOpacity>
            ) : null
          ),
        }} 
      />
      <Animated.View 
        style={[
          { 
            flex: 1, 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <FlatList
          data={notifications}
          contentContainerStyle={[
            notifications.length === 0 ? styles.fullScreenContainer : styles.listContainer,
            { backgroundColor: colors.background }
          ]}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              getNotificationColor={getNotificationColor}
              getNotificationIcon={getNotificationIcon}
              formatDate={formatDate}
              colors={colors}
              onPress={handleNotificationPress}
            />
          )}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              progressBackgroundColor={colors.cardBackground}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={EmptyNotifications}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      </Animated.View>
      
      {/* Snackbar for iOS and other platforms */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={[styles.snackbar, { backgroundColor: isDark ? colors.cardBackground : '#333' }]}
        theme={{ colors: { surface: isDark ? colors.cardBackground : '#333' } }}
      >
        <Text style={{ color: isDark ? colors.text : '#fff' }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContainer: {
    flexGrow: 1,
  },
  listContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  notificationItem: {
    position: 'relative',
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  textContainer: {
    flex: 1,
    marginRight: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 6,
    top: 28,
  },
  divider: {
    height: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 200, 200, 0.1)',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  clearButton: {
    marginRight: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  snackbar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 8,
    elevation: 6,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  logoWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 55,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
}); 