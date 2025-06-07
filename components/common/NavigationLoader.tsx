import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import LoadingOverlay from './LoadingOverlay';
import { SafeAreaView, StyleSheet } from 'react-native';

interface NavigationLoaderProps {
  isNavigating: boolean;
}

const NavigationLoader: React.FC<NavigationLoaderProps> = ({ isNavigating }) => {
  const [showLoader, setShowLoader] = useState(false);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // If navigation starts, show the loader immediately
    if (isNavigating) {
      setShowLoader(true);
    } else {
      // If navigation ends, keep the loader visible for a minimum time
      // to prevent flickering for very fast navigation
      timer = setTimeout(() => {
        setShowLoader(false);
      }, 300); // Minimum display time of 300ms
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isNavigating]);

  // Reset the loader when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setShowLoader(false);
      return () => {};
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      <LoadingOverlay visible={showLoader} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});

export default NavigationLoader; 