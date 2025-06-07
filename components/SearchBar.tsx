import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Dimensions, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isDark?: boolean;
  colors?: any;
}

export default function SearchBar({ value, onChangeText, placeholder, isDark, colors }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  
  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View 
      style={[
        styles.outerContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={[
        styles.container,
        isDark 
          ? isFocused
            ? styles.containerDarkFocused
            : styles.containerDark
          : isFocused 
            ? styles.containerFocused 
            : styles.containerNormal,
      ]}>
        <Ionicons 
          name="search" 
          size={isSmallDevice ? 18 : 20} 
          color={isDark 
            ? isFocused ? Colors.primary : (colors?.subtext || '#aaa')
            : isFocused ? Colors.primary : "#666"
          } 
        />
        <TextInput
          style={[
            styles.input,
            isDark 
              ? { color: colors?.text || '#fff' }
              : isFocused 
                ? { color: '#000' } 
                : { color: '#333' }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark 
            ? colors?.inactive || '#888' 
            : isFocused ? "#555" : "#666"
          }
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {value.length > 0 && (
          <Pressable 
            onPress={() => onChangeText('')}
            style={styles.clearButton}
          >
            <Ionicons 
              name="close-circle" 
              size={isSmallDevice ? 16 : 18} 
              color={isDark ? '#888' : '#666'} 
            />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: isSmallDevice ? 6 : 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: isSmallDevice ? 10 : 12,
    borderWidth: 1,
  },
  containerNormal: {
    backgroundColor: '#f7f7f7',
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerFocused: {
    backgroundColor: '#fff',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#272727',
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  containerDarkFocused: {
    backgroundColor: '#333',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: 'Urbanist-Medium',
  },
  clearButton: {
    marginLeft: 5,
    padding: 4,
  }
}); 