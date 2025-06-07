import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";

interface EmptyChatProps {
  isDark?: boolean;
  colors?: any;
}

export const EmptyChat: React.FC<EmptyChatProps> = ({ isDark, colors }) => (
  <View style={[
    styles.emptyContainer,
    isDark && { backgroundColor: colors?.secondaryBackground }
  ]}>
    <Ionicons 
      name="chatbubbles-outline" 
      size={64} 
      color={isDark ? colors?.inactive || "#666" : "#ccc"} 
    />
    <Text style={[
      styles.emptyTitle,
      isDark && { color: colors?.text || "#fff" }
    ]}>No Messages Yet</Text>
    <Text style={[
      styles.emptyText,
      isDark && { color: colors?.subtext || "#aaa" }
    ]}>
      Your conversations will appear here when you start chatting
    </Text>
  </View>
);

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
}); 