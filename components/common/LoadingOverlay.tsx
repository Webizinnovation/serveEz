import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useColorScheme } from 'react-native';
import Logo from '../../assets/images/Svg/logo1.svg';
import { useTheme } from '../ThemeProvider';

interface LoadingOverlayProps {
  visible: boolean;
  color?: string;
  logoColor?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  visible, 
  color,
  logoColor 
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { colors } = useTheme();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const [fullyHidden, setFullyHidden] = useState(!visible);
  
  // Set default overlay color based on theme if not specified
  const overlayColor = color || (isDark ? '#121212' : '#ffffff');
  // Set default logo color based on theme if not specified
  const logoTint = logoColor || (isDark ? '#ffffff' : undefined);

  useEffect(() => {
    if (visible) {
      setFullyHidden(false);
      // Fade in the overlay
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }).start();
      
      // Start the logo pulsing animation
      const fadeInOut = () => {
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          })
        ]).start(() => {
          if (visible) fadeInOut();
        });
      };

      fadeInOut();
    } else {
      // Fade out the overlay
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease)
      }).start(({ finished }) => {
        if (finished) {
          setFullyHidden(true);
        }
      });
      // Stop the logo animation
      opacityAnim.stopAnimation();
    }

    return () => {
      fadeAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, [visible, fadeAnim, opacityAnim]);

  if (fullyHidden && !visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim, 
          backgroundColor: overlayColor 
        }
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={{
        opacity: opacityAnim,
        transform: [{
          scale: opacityAnim.interpolate({
            inputRange: [0.3, 1],
            outputRange: [0.9, 1.1]
          })
        }]
      }}>
        {isDark ? (
          <Logo 
            width={100} 
            height={100} 
            fill="#ffffff"
            color="#ffffff"
          />
        ) : (
          <Logo 
            width={100} 
            height={100} 
          />
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  }
});

export default LoadingOverlay; 