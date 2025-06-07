import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  Animated,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase, removeAllSubscriptions } from "../../services/supabase";
import { router } from "expo-router";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../components/ThemeProvider";
import { useUserStore } from "../../store/useUserStore";

export interface DrawerItem {
  key: string;
  route?: `/${string}`;
  color?: string;
  icon?: string;
}

interface DrawerModalProps {
  isVisible: boolean;
  onClose: () => void;
  items?: DrawerItem[];
  profileImageUri?: string;
  onItemPress?: (itemKey: string) => void;
  showLogout?: boolean;
  customHeader?: React.ReactNode;
  role?: 'user' | 'provider';
}

const defaultItems: DrawerItem[] = [
  { key: "Home", icon: "home", route: "/(tabs)" },
  { key: "Services", icon: "list", route: "/(tabs)/services" },
  { key: "Notifications", icon: "notifications", route: "/notifications" },
  { key: "Transactions history", icon: "cash", route: "/(tabs)/wallet" },
  { key: "Create new request", icon: "add-circle", route: "/(tabs)/services" },
  { key: "Edit Profile", icon: "person", route: "/(tabs)/profile" },
  { key: "Favorites", icon: "heart", route: "/(tabs)/services" },
];

const DrawerModal: React.FC<DrawerModalProps> = ({
  isVisible,
  onClose,
  items = defaultItems,
  profileImageUri,
  onItemPress,
  showLogout = true,
  customHeader,
  role,
}) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const { isDark, colors } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              
              // Clear profile data first
              useUserStore.setState({ profile: null });
              
              // Clean up all Supabase real-time subscriptions to prevent errors
              removeAllSubscriptions();
              
              // Now sign out from Supabase
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoggingOut(false);
              if (typeof onClose === 'function') {
                onClose();
              }
            }
          }
        }
      ]
    );
  };

  const handleItemPress = (item: DrawerItem) => {
    onClose();
    if (item.route) {
      router.push(item.route as any);
    } else if (onItemPress) {
      onItemPress(item.key);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.drawerContainer}>
        <Animated.View
          style={[
            styles.drawerContent,
            { 
              transform: [{ translateX: slideAnim }],
              backgroundColor: colors.cardBackground 
            },
          ]}
        >
          {customHeader || (
            <View style={styles.header}>
              <Image
                source={{ 
                  uri: profileImageUri || 'https://via.placeholder.com/50'
                }}
                style={styles.drawerProfileImage}
              />
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
          )}
          <Text style={[styles.drawerTitle, { color: colors.text }]}>
            {role === "user" ? "User" : "Provider"}
          </Text>
          <FlatList
            data={items}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleItemPress(item)}>
                <View style={[styles.drawerItemContainer, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(204,204,204,0.27)' }]}>
                  {item.icon && (
                    <Ionicons 
                      name={item.icon as any} 
                      size={20} 
                      color={item.color || Colors.primary} 
                      style={styles.itemIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.drawerItem, 
                      { color: item.color || colors.text }
                    ]}
                  >
                    {item.key}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.key}
          />
          {showLogout && (
            <TouchableOpacity onPress={handleLogout}>
              <View style={[styles.drawerItemContainer, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(204,204,204,0.27)' }]}>
                <Ionicons 
                  name="log-out" 
                  size={20} 
                  color="red" 
                  style={styles.itemIcon}
                />
                <Text style={styles.logoutText}>Logout</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
  },
  drawerContent: {
    width: 300,
    height: "100%",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  drawerProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  closeButton: {
    padding: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    marginVertical: 16,
  },
  drawerItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    borderBottomWidth: 1,
  },
  itemIcon: {
    marginRight: 12,
  },
  drawerItem: {
    fontSize: 17,
    fontFamily: "Urbanist-SemiBold",
  },
  logoutText: {
    color: "red",
    fontSize: 17,
    fontFamily: "Urbanist-SemiBold",
  },
});

export default DrawerModal; 