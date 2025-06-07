import React, { useRef, useEffect } from "react";
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
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { router } from "expo-router";
import { Colors } from "../../constants/Colors";
import { ScaledSheet, moderateScale } from "react-native-size-matters";
import { useTheme } from "../ThemeProvider";

interface SettingsItem {
  key: string;
  route?: `/${string}`;
  icon?: string;
  danger?: boolean;
  onPress?: () => void;
}

interface SettingsSection {
  title: string;
  data: SettingsItem[];
}

interface SettingsDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  profileImageUri?: string;
  headerTitle?: string;
  sections?: SettingsSection[];
}

// Default sections that can be overridden via props
const defaultSettingsSections: SettingsSection[] = [
  {
    title: "Account",
    data: [
      { key: "Edit profile", route: "/(tabs)/profile" },
      { key: "Change email and password", route: "/(tabs)/profile" },
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
      { key: "Delete account", danger: true, route: "/settings/delete-account" },
    ],
  },
];

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isVisible,
  onClose,
  profileImageUri,
  headerTitle = "Account",
  sections = defaultSettingsSections,
}) => {
  const { width } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(width)).current;
  const { isDark, colors } = useTheme();

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, width]);

  const handleItemPress = (item: SettingsItem) => {
    onClose();
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as any);
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
              backgroundColor: isDark ? colors.cardBackground : "#F5F7FA" 
            },
          ]}
        >
          {/* Header with back button and account */}
          <View style={[
            styles.header,
            isDark && { borderBottomColor: 'rgba(255,255,255,0.1)' }
          ]}>
            <View style={styles.headerLeftSection}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color={colors.icon} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, {color: colors.text}]}>{headerTitle}</Text>
            </View>
            
            {profileImageUri && (
              <Image
                source={{ uri: profileImageUri || 'https://via.placeholder.com/30' }}
                style={styles.profileImage}
              />
            )}
          </View>

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, index) => (
              <View key={section.title} style={styles.sectionContainer}>
                <View style={[
                  styles.sectionHeader, 
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#E9EEF2' }
                ]}>
                  <Text style={[
                    styles.sectionTitle,
                    { color: isDark ? colors.text : '#6B7280' }
                  ]}>
                    {section.title}
                  </Text>
                </View>
                
                {section.data.map((item) => (
                  <TouchableOpacity 
                    key={item.key}
                    onPress={() => handleItemPress(item)}
                    style={[
                      styles.menuItem,
                      index === sections.length - 1 && 
                      section.data.indexOf(item) === section.data.length - 1 && 
                      styles.lastMenuItem,
                      isDark && { borderBottomColor: 'rgba(255,255,255,0.1)' }
                    ]}
                  >
                    <Text style={[
                      styles.menuItemText,
                      item.danger && styles.dangerText,
                      { color: item.danger ? '#FF3B30' : colors.text }
                    ]}>
                      {item.key}
                    </Text>
                    {item.icon ? (
                      <Ionicons 
                        name={item.icon as any} 
                        size={18} 
                        color={item.danger ? '#FF3B30' : colors.icon} 
                      />
                    ) : (
                      <Ionicons 
                        name="chevron-forward" 
                        size={18} 
                        color={item.danger ? '#FF3B30' : colors.icon} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = ScaledSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  drawerContent: {
    width: "100%",
    maxWidth: 400,
    height: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: "16@ms",
    paddingVertical: "12@ms",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    padding: "8@ms",
    marginRight: "8@ms",
  },
  headerLeftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: "30@ms",
    height: "30@ms",
    borderRadius: "15@ms",
  },
  headerTitle: {
    fontSize: "18@ms",
    fontFamily: "Urbanist-Bold",
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: "16@ms",
  },
  sectionHeader: {
    paddingHorizontal: "16@ms",
    paddingVertical: "10@ms",
    borderRadius: "12@ms",
    marginHorizontal: "16@ms",
    marginVertical: "8@ms",
  },
  sectionTitle: {
    fontSize: "16@ms",
    fontFamily: "Urbanist-SemiBold",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: "16@ms",
    paddingHorizontal: "16@ms",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: "16@ms",
    fontFamily: "Urbanist-Medium",
  },
  dangerText: {
    color: "#FF3B30",
  },
});

export default SettingsDrawer; 