import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "../../constants/Colors";
import TabIcon from "../../components/TabIcon";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { Dimensions, StyleSheet, ViewStyle, Platform } from "react-native";
import { useTheme } from "../../components/ThemeProvider";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  gestureHandlerRootView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabBarItemStyle: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
});

// Tabs config moved outside component to prevent recreation
const TABS = [
  {
    name: "index",
    label: "Home",
    icon: MaterialCommunityIcons,
    IconName: "home",
  },
  {
    name: "services",
    label: "Services",
    icon: FontAwesome5,
    IconName: "list-alt",
  },
  {
    name: "wallet",
    label: "Wallet",
    icon: Ionicons,
    IconName: "wallet-outline",
  },
  {
    name: "chat",
    label: "Chat",
    icon: MaterialCommunityIcons,
    IconName: "message-text-outline",
  },
  {
    name: "profile",
    label: "Profile",
    icon: Ionicons,
    IconName: "person-outline",
  },
];

export default function TabLayout() {
  const { isDark, colors } = useTheme();

  // Optimize color calculations by simplifying
  const updateColors = useMemo(() => ({
    primary: Colors.primary,
    secondary: "rgba(102,138,169,0.91)",
    inactive: isDark ? Colors.dark.inactive : Colors.light.inactive,
    light: isDark ? Colors.dark.text : Colors.light.text,
    activeBackground: Colors.primary,
  }), [isDark]);

  // Optimize tab bar style with fewer calculations
  const tabBarStyle = useMemo(() => ({
    borderTopColor: colors.border,
    justifyContent: "center" as const,
    height: width > 400 ? 65 : 60,
    backgroundColor: colors.background,
    elevation: isDark ? 4 : 8, // Reduced elevation for better performance
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: isDark ? 0.15 : 0.08, // Reduced shadow for better performance
    shadowRadius: 2,
    paddingHorizontal: 4,
  } as ViewStyle), [colors.border, colors.background, isDark, width]);

  // Optimize screen options with memoization
  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarShowLabel: false,
    tabBarStyle: tabBarStyle,
    tabBarItemStyle: styles.tabBarItemStyle,
    tabBarActiveTintColor: updateColors.primary,
    tabBarInactiveTintColor: updateColors.inactive,
    // Fix keyboard behavior - use different approach per platform
    tabBarHideOnKeyboard: Platform.OS === 'android', // Only hide on Android
    keyboardHidesTabBar: Platform.OS === 'ios', // Use this property for iOS
  }), [tabBarStyle, updateColors]);

  return (
    <GestureHandlerRootView style={[
      styles.gestureHandlerRootView,
      { backgroundColor: colors.background }
    ]}>
      <Tabs screenOptions={screenOptions}>
        {TABS.map((tab, index) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  name={tab.IconName}
                  focused={focused}
                  iconComponent={tab.icon}
                  label={tab.label}
                  colors={updateColors}
                  index={index}
                  tabCount={TABS.length}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </GestureHandlerRootView>
  );
}