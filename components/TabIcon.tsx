import React, { useEffect, useRef, memo } from "react";
import { Text, View, ViewStyle, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  cancelAnimation,
} from "react-native-reanimated";
import { useChatStore } from "../store/useChatStore";
import { useUserStore } from "../store/useUserStore";
import { useNotificationStore } from "../store/useNotificationStore";
import { useTheme } from "../components/ThemeProvider";

const { width } = Dimensions.get('window');
// Calculate base shift based on screen width
const BASE_SHIFT = width * 0.05; // Reduced from 8% to 5% for more subtle effect

// Optimized spring configs with faster response times
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 180,
  mass: 0.6,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

export interface TabIconProps {
  name: string;
  focused: boolean;
  iconComponent: any;
  label: string;
  colors: {
    primary: string;
    secondary?: string;
    inactive: string;
    light?: string;
    activeBackground?: string;
  };
  index: number;
  tabCount: number;
}

const TabIcon: React.FC<TabIconProps> = ({
  name,
  focused,
  iconComponent: IconComponent,
  label,
  colors,
  index,
  tabCount,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const { userUnreadCount, providerUnreadCount } = useChatStore();
  const { profile } = useUserStore();
  const { hasNewRequests, hasAcceptedBookings } = useNotificationStore();
  const { isDark, colors: themeColors } = useTheme();
  const focusedIndex = useRef(-1);
  const prevFocused = useRef(focused);

  // Memo-ize notification calculation to prevent unnecessary recalculations
  const showNotification = 
    (label === "Chat" && ((profile?.role === 'user' && userUnreadCount > 0) || 
                         (profile?.role === 'provider' && providerUnreadCount > 0))) ||
    (label === "Services" && ((profile?.role === 'provider' && hasNewRequests) ||
                            (profile?.role === 'user' && hasAcceptedBookings)));

  useEffect(() => {
    // Skip animation if the focus state hasn't changed
    if (prevFocused.current === focused) return;
    prevFocused.current = focused;
    
    // Cancel any in-progress animations for immediate response
    cancelAnimation(scale);
    cancelAnimation(opacity);
    cancelAnimation(translateX);
    
    // Apply faster animations with optimized config
    scale.value = withSpring(focused ? 1.15 : 0.95, SPRING_CONFIG);
    opacity.value = withSpring(focused ? 1 : 0.7, SPRING_CONFIG);
    
    if (focused) {
      focusedIndex.current = index;
      translateX.value = withSpring(0, SPRING_CONFIG);
    } else {
      if (focusedIndex.current !== -1) {
        const direction = index < focusedIndex.current ? -1 : 1;
        // Simplify shift calculations for better performance
        const shiftAmount = BASE_SHIFT * (1 / (Math.abs(index - focusedIndex.current) + 0.5));
        translateX.value = withSpring(direction * shiftAmount, SPRING_CONFIG);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    }
  }, [focused, index]);

  // Use a separate effect for data fetching to avoid blocking animations
  useEffect(() => {
    if (!focused || !profile?.id) return;
    
    // Use setTimeout to delay data fetching until after animations complete
    const timer = setTimeout(() => {
      const { refreshUnreadCounts } = useChatStore.getState();
      const { checkNewRequests, checkAcceptedBookings } = useNotificationStore.getState();
      
      if (label === "Chat" || label === "Chats") {
        refreshUnreadCounts(profile.role || 'user', profile.id);
      } else if (label === "Services") {
        if (profile.role === 'provider') {
          checkNewRequests(profile.id);
        } else if (profile.role === 'user') {
          checkAcceptedBookings(profile.id);
        }
      }
    }, 100); // Short delay after animation starts
    
    return () => clearTimeout(timer);
  }, [focused, profile?.id, profile?.role, label]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value }
    ],
    opacity: opacity.value,
  }));

  const notificationDotStyle = showNotification 
    ? [styles.notificationDot] 
    : [styles.notificationDot, { opacity: 0 }];

  return (
    <Animated.View style={[
      animatedStyle, 
      { position: 'relative', paddingHorizontal: 5 }
    ]}>
      <View
        style={
          focused
            ? styles.focusedContainer(colors.primary)
            : styles.defaultContainer
        }
      >
        <IconComponent
          name={name}
          size={22}
          color={focused ? "white" : colors.inactive}
        />
        {focused && (
          <Text style={[
            styles.label, 
            { color: "white" }
          ]}>
            {label}
          </Text>
        )}
      </View>
      <View style={[notificationDotStyle, { borderColor: isDark ? themeColors.background : 'white' }]} />
    </Animated.View>
  );
};

const styles = {
  focusedContainer: (backgroundColor: string): ViewStyle => ({
    flexDirection: "row",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 20,
    paddingHorizontal: 8,
    minWidth: 70,
    height: 36,
    top: 10,
    backgroundColor,
  }),
  defaultContainer: {
    flexDirection: "row",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minWidth: 70,
    height: 36,
    top: 10,
  } as ViewStyle,
  label: {
    fontFamily: "Urbanist-SemiBold",
    marginLeft: 4,
    fontSize: 12,
  },
  notificationDot: {
    position: 'absolute' as const,
    top: 5,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: 'white',
  } as ViewStyle,
};

// Memoize the component to prevent unnecessary re-renders
export default memo(TabIcon); 