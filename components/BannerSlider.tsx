import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ViewToken, Dimensions, TouchableOpacity, Platform, Image, ActivityIndicator, Linking } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedReaction,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import Memo from "../assets/images/Svg/memo.svg";
import Wallet from "../assets/images/Svg/wallet.svg";
import Discount from "../assets/images/Svg/discount.svg";
import { UserProfile } from "../types";
import { useTheme } from "../components/ThemeProvider";
import { supabase } from "../services/supabase";

const { width } = Dimensions.get('window');
const COMPACT_LAYOUT = true;
const DEFAULT_DISPLAY_DURATION = 5000;

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  reg?: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  SvgComponent?: React.FC<{ animatedStyle: any, size?: number }>;
  actionText?: string;
  onPress?: () => void;
  isAdMob?: boolean;
  isAd?: boolean;
  imageUrl?: string;
  adUrl?: string;
  trackingId?: string;
  displayDuration?: number; 
  dottedBorder?: boolean; 
}

interface BannerSliderProps {
  profile?: UserProfile | null;
  onSilentRefresh?: (silentRefresh: () => void) => void; 
}

const BannerSlider: React.FC<BannerSliderProps> = ({ profile, onSilentRefresh }) => {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customBanners, setCustomBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [adError, setAdError] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    console.log('Theme changed, isDark:', isDark);
  }, [isDark]);
  
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    }
  ).current;

  const animatedValue = useSharedValue(0);
  const opacityValue = useSharedValue(0);
  const translateYValue = useSharedValue(50);

  useAnimatedReaction(
    () => currentIndex,
    () => {
      animatedValue.value = withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
      opacityValue.value = withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
      translateYValue.value = withTiming(0, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
    },
    [currentIndex]
  );

  const fetchAds = async (silent = false) => {
    if (!silent) setLoading(true);
    setAdError(false);
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('active', true)
        .order('priority', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      const now = new Date();
      const validAds = data.filter(ad => {
        const startDate = ad.start_date ? new Date(ad.start_date) : null;
        const endDate = ad.end_date ? new Date(ad.end_date) : null;
        
        const isActive = 
          (!startDate || startDate <= now) &&
          (!endDate || endDate >= now);  
        
        return isActive;
      });
      
      const adBanners: Banner[] = validAds.map(ad => ({
        id: `ad-${ad.id}`,
        title: ad.title,
        subtitle: ad.description,
        backgroundColor: ad.background_color || '#4A4A4A',
        backgroundImageUrl: ad.background_image_url,
        actionText: ad.action_text,
        isAd: true,
        imageUrl: ad.image_url,
        adUrl: ad.action_url,
        trackingId: ad.tracking_id,
        displayDuration: ad.display_duration ? ad.display_duration * 1000 : DEFAULT_DISPLAY_DURATION, // Convert to milliseconds
      }));
      
      return adBanners;
    } catch (error) {
      console.error('Error fetching advertisements:', error);
      if (!silent) setAdError(true);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const silentRefresh = useCallback(async () => {
    console.log("Performing silent refresh of banners");
    const adBanners = await fetchAds(true);
    
    const staticBanners: Banner[] = [];
   
    if (profile?.id && !profile?.profile_pic) {
      staticBanners.push({
        id: "1",
        title: `Welcome ${profile.name || 'User'}!`,
        subtitle: "Complete your profile by adding\na profile picture",
        backgroundColor: isDark ? "#3A6599" : "#4A90E2",
        actionText: "Complete Profile",
        onPress: () => router.push('/profile'),
        SvgComponent: ({ animatedStyle, size = 70 }) => (
          <Animated.View style={animatedStyle}>
            <Memo width={size} height={size} />
          </Animated.View>
        ),
        displayDuration: 4000,
      });
    }
    
    if (profile?.id) {
      staticBanners.push({
        id: "2",
        title: "Fund Wallet",
        subtitle: "You need to fund your wallet\nto place your bookings",
        backgroundColor: isDark ? "#964747" : "#C35D5D",
        actionText: "Fund Now",
        onPress: () => router.push('/wallet'),
        SvgComponent: ({ animatedStyle, size = 80 }) => (
          <Animated.View style={animatedStyle}>
            <Wallet width={size} height={size * 0.77} />
          </Animated.View>
        ),
        displayDuration: 4000,
      });
    }
    
    staticBanners.push({
      id: "3",
      title: "Welcome Offer",
      subtitle: "Enjoy 40% discount on your\nfirst booking for new users",
      backgroundColor: isDark ? "#7E6B54" : "#C0A681",
      actionText: "ServeEz 01",
      dottedBorder: true, 
      SvgComponent: ({ animatedStyle, size = 80 }) => (
        <Animated.View style={animatedStyle}>
          <Discount width={size} height={size * 0.77} />
        </Animated.View>
      ),
      displayDuration: 4000,
    });
    
 
    const allBanners = [...adBanners, ...staticBanners];
    setCustomBanners(allBanners);
  }, [profile, router, isDark]);

  useEffect(() => {
    if (onSilentRefresh) {
      onSilentRefresh(silentRefresh);
    }
  }, [silentRefresh, onSilentRefresh]);

  const handleAdClick = async (banner: Banner) => {
    if (!banner.isAd) {
      banner.onPress && banner.onPress();
      return;
    }
    
    try {
      if (banner.trackingId) {
        const { error } = await supabase
          .from('ad_clicks')
          .insert({
            ad_id: banner.trackingId,
            user_id: profile?.id,
            timestamp: new Date().toISOString()
          });
          
        if (error) {
          console.error('Error tracking ad click:', error);
        }
      }
      
      if (banner.adUrl) {
        await Linking.openURL(banner.adUrl);
      }
    } catch (error) {
      console.error('Error handling ad click:', error);
    }
  };

  const scrollToNextBanner = () => {
    if (!autoScrollEnabled || customBanners.length === 0 || !flatListRef.current) return;
    
    const nextIndex = (currentIndex + 1) % customBanners.length;
    flatListRef.current.scrollToIndex({
      index: nextIndex,
      animated: true,
    });
  };

  const startAutoScrollTimer = () => {
    if (autoScrollTimer.current) {
      clearTimeout(autoScrollTimer.current);
    }
    
    const currentBanner = customBanners[currentIndex];
    const duration = currentBanner?.displayDuration || DEFAULT_DISPLAY_DURATION;
    
    autoScrollTimer.current = setTimeout(() => {
      scrollToNextBanner();
    }, duration);
  };

  useEffect(() => {
    if (autoScrollEnabled && customBanners.length > 0) {
      startAutoScrollTimer();
    }
    
    return () => {
      if (autoScrollTimer.current) {
        clearTimeout(autoScrollTimer.current);
      }
    };
  }, [currentIndex, autoScrollEnabled, customBanners]);

  useEffect(() => {
    const loadBanners = async () => {
      const adBanners = await fetchAds();
      
      const staticBanners: Banner[] = [];
      
      if (profile?.id && !profile?.profile_pic) {
        staticBanners.push({
          id: "1",
          title: `Welcome ${profile.name || 'User'}!`,
          subtitle: "Complete your profile by adding\na profile picture",
          backgroundColor: isDark ? "#3A6599" : "#4A90E2",
          actionText: "Complete Profile",
          onPress: () => router.push('/profile'),
          SvgComponent: ({ animatedStyle, size = 70 }) => (
            <Animated.View style={animatedStyle}>
              <Memo width={size} height={size} />
            </Animated.View>
          ),
          displayDuration: 4000,
        });
      }
      
      if (profile?.id) {
        staticBanners.push({
          id: "2",
          title: "Fund Wallet",
          subtitle: "You need to fund your wallet\nto place your bookings",
          backgroundColor: isDark ? "#964747" : "#C35D5D",
          actionText: "Fund Now",
          onPress: () => router.push('/wallet'),
          SvgComponent: ({ animatedStyle, size = 80 }) => (
            <Animated.View style={animatedStyle}>
              <Wallet width={size} height={size * 0.77} />
            </Animated.View>
          ),
          displayDuration: 4000,
        });
      }
      
      staticBanners.push({
        id: "3",
        title: "Welcome Offer",
        subtitle: "Enjoy 40% discount on your\nfirst booking for new users",
        backgroundColor: isDark ? "#7E6B54" : "#C0A681",
        actionText: "ServeEz 01",
        dottedBorder: true, 
        SvgComponent: ({ animatedStyle, size = 80 }) => (
          <Animated.View style={animatedStyle}>
            <Discount width={size} height={size * 0.77} />
          </Animated.View>
        ),
        displayDuration: 4000,
      });
      
      const allBanners = [...adBanners, ...staticBanners];
      setCustomBanners(allBanners);
    };
    
    loadBanners();
  }, [profile, router, isDark]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedValue.value }],
  }));

  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacityValue.value,
    transform: [{ translateY: translateYValue.value }],
  }));

  const renderAdBanner = (item: Banner, animatedStyle: any) => {
    return (
      <View style={styles.bannerContent}>
        <Text style={styles.bannerTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
        {item.actionText && (
          <TouchableOpacity 
            style={[
              styles.actionButton,
              isDark && { backgroundColor: 'rgba(255,255,255,0.25)' },
              item.dottedBorder && styles.dottedBorderButton
            ]}
            onPress={() => handleAdClick(item)}
          >
            <Text style={styles.actionButtonText}>{item.actionText}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };


  const renderBannerRight = (item: Banner) => {
    if (item.isAd && item.imageUrl) {
      return (
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.adImage}
          resizeMode="contain"
        />
      );
    } else if (item.SvgComponent) {
      return <item.SvgComponent animatedStyle={animatedStyle} />;
    }
    return null;
  };


  const handleScrollToIndexFailed = (info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
      });
    });
  };

  if (loading && customBanners.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint || "#F58220"} />
      </View>
    );
  }

  if (adError && customBanners.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: isDark ? colors.text : '#333' }]}>
          Unable to load banners
        </Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={customBanners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={({ item }) => (
          <Animated.View
            style={[
              styles.banner,
              { backgroundColor: item.backgroundColor },
              bannerAnimatedStyle,
              isDark && {
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1
              }
            ]}
          >
            {item.backgroundImageUrl && (
              <>
                <Image 
                  source={{ uri: item.backgroundImageUrl }} 
                  style={styles.backgroundImage}
                  resizeMode="cover"
                />
                <View style={styles.backgroundOverlay} />
              </>
            )}
            {renderAdBanner(item, animatedStyle)}
            {renderBannerRight(item)}
          </Animated.View>
        )}
      />
      <View style={styles.dotContainer}>
        {customBanners.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex 
                  ? "#F58220" 
                  : isDark ? "rgba(255,255,255,0.3)" : "#5E5E5E",
                width: index === currentIndex ? 14 : 8,
                height: index === currentIndex ? 8 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default BannerSlider;

const styles = StyleSheet.create({
  banner: {
    width: width - 28,
    height: 170,
    borderRadius: 20,
    padding: 20,
    marginVertical: 16,
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  backgroundImage: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    width: width, 
    height: 180, 
    zIndex: 1,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 1,
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 2,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Urbanist-ExtraBold",
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontFamily: "Urbanist-Medium",
    color: "rgba(255,255,255,0.99)",
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
    lineHeight: 18,
  },
  regContainer: {
    position: "absolute",
    top: -20,
    right: -130,
  },
  reg: {
    color: "rgba(255,255,255,0.87)",
    fontSize: 12,
    fontFamily: "Urbanist-SemiBold",
  },
  specialOffer: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    borderStyle: "dotted",
    alignSelf: "flex-start",
  },
  specialOfferText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontFamily: "Urbanist-SemiBold",
    textTransform: "uppercase",
  },
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    transform: [{scale: 1}],
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 2,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Urbanist-Bold",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  adImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    zIndex: 2,
  },
  loadingContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  errorContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  errorText: {
    fontFamily: "Urbanist-Medium",
    fontSize: 14,
  },
  dottedBorderButton: {
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    borderStyle: "dotted",
  },
});