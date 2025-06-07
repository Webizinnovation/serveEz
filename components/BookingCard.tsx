import React, { useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, Image, TouchableOpacity, ImageBackground, Animated, Easing, ActivityIndicator, Alert
} from 'react-native';
import { ScaledSheet, moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { sendBookingStatusUpdatePushNotification } from '../services/pushNotifications';

interface BookingCardProps {
  item: {
    category?: string;
    price: number;
    image?: string;
    name: string;
    date: string;
    details?: string;
    time?: string;
    service: string;
    code?: string;
    skill?: string;
    provider_id: string;
    status?: string;
    payment_plan?: string;
    landmark?: string;
    amount?: number;
    provider?: {
      services?: string[];
    };
    first_payment_completed?: boolean;
  };
  type: 'InProgress' | 'Completed' | 'Cancelled';
  onCancel?: () => void;
  onFavorite?: () => void;
  onReport?: () => void;
  onReview?: (provider_id: string, booking_id: string) => void;
  loading?: boolean;
  showPayButton?: boolean;
  onPay?: () => void;
  isDark?: boolean;
  colors?: any;
}

const AnimatedPressableButton = memo(({ onPress, isDisabled, style, children }: any) => (
  <Animated.View>
    <TouchableOpacity
      style={style}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  </Animated.View>
));

const InProgressCard = memo(({ 
  item, 
  scaleValue, 
  buttonContent, 
  tagContainer, 
  providerInfoContainer, 
  handlePress, 
  handlePressIn, 
  handlePressOut, 
  onPay, 
  loading 
}: any) => (
  <ImageBackground
    source={{ uri: item.image || 'https://via.placeholder.com/300' }}
    style={styles.backgroundImage}
    imageStyle={styles.backgroundImageStyle}
  >
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      style={styles.gradient}
    >
      <View style={styles.headerRow}>
        {tagContainer}
        {item.status === 'accepted' && (
          <View style={styles.acceptedTag}>
            <MaterialIcons name="check-circle" size={14} color="#00FE37" />
            <Text style={styles.acceptedText}>Accepted</Text>
          </View>
        )}
        <Text style={styles.rating}>₦ {item.price}</Text>
      </View>

      <View style={styles.contentRow}>
        {providerInfoContainer}
      </View>

      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <TouchableOpacity
          style={[
            item.status === 'accepted' && !item.first_payment_completed ? styles.paymentButton : styles.button,
            loading && styles.buttonDisabled,
            (item.payment_plan === 'half' && item.first_payment_completed === true) && styles.disabledButton
          ]}
          onPress={() => {
            if (item.status === 'accepted') {
              if (onPay) onPay();
            } else {
              handlePressIn();
              setTimeout(() => {
                handlePressOut();
              }, 200);
            }
          }}
          disabled={loading || (item.payment_plan === 'half' && item.first_payment_completed === true)}
          activeOpacity={0.8}
        >
          {buttonContent}
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  </ImageBackground>
));

const CompletedCard = memo(({ 
  item, 
  formatDate, 
  handleFavorite, 
  handleReview, 
  onFavorite, 
  isDark, 
  colors 
}: any) => (
  <View style={[
    styles.completedCard,
    isDark && { 
      backgroundColor: colors?.cardBackground || '#1E2732',
      borderColor: 'transparent' 
    }
  ]}>
    <View style={styles.providerInfoContainer}>
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/300' }}
        style={styles.completedProviderImage}
      />
      <View style={styles.providerDetailsNew}>
        <View style={styles.leftContent}>
          <Text style={[
            styles.timeAgo,
            isDark && { color: colors?.subtext }
          ]} numberOfLines={1} ellipsizeMode="tail">
            {formatDate(item.date, item.time)}
          </Text>
          <Text style={[
            styles.providerName,
            isDark && { color: colors?.text }
          ]} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
        </View>
        <View style={styles.rightContent}>
          <Text style={[
            styles.serviceHeader,
            isDark && { color: colors?.text || '#ffffff' }
          ]} numberOfLines={1} ellipsizeMode="tail">
            {item.service && (item.service.includes('+') 
              ? item.service.substring(0, item.service.indexOf('+')) 
              : item.service)}
            {item.service && item.service.includes('+') && (
              <Text style={[
                styles.serviceMore,
                isDark && { color: colors?.tint || '#007BFF' }
              ]}>
                {item.service.substring(item.service.indexOf('+'))}
              </Text>
            )}
          </Text>
          <Text style={[
            styles.serviceId,
            isDark && { color: colors?.subtext }
          ]} numberOfLines={1} ellipsizeMode="tail">
            #{item.code?.slice(0, 6)}
          </Text>
        </View>
      </View>
    </View>
    <View style={styles.buttonContainer}>
      {onFavorite && (
        <TouchableOpacity
          style={[
            styles.favoriteButton,
            isDark && { 
              backgroundColor: 'rgba(51,169,212,0.1)',
              borderColor: 'transparent',
              borderRadius: 8,
              padding: 6
            }
          ]}
          onPress={handleFavorite}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={16} 
            color={isDark ? colors?.tint || "#007BFF" : "#007BFF"} 
            style={styles.favoriteIcon} 
          />
          <Text style={[
            styles.favoriteText,
            isDark && { color: colors?.tint || '#007BFF' }
          ]}>Add to favorites</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.bookAgainButton,
          isDark && { 
            backgroundColor: colors?.tint || '#007BFF',
            borderColor: 'transparent'
          }
        ]}
        onPress={handleReview}
      >
        <Text style={[
          styles.bookAgainText,
          isDark && { color: '#ffffff' }
        ]}>Review</Text>
      </TouchableOpacity>
    </View>
  </View>
));

const CancelledCard = memo(({ 
  item, 
  isDark, 
  colors 
}: any) => (
  <View style={[
    styles.cancelledCard,
    isDark && { 
      backgroundColor: colors?.cardBackground,
      borderColor: colors?.border 
    }
  ]}>
    <View style={styles.cancellationHeader}>
      <Text style={[
        styles.cancellationDate,
        isDark && { color: colors?.text }
      ]} numberOfLines={1} ellipsizeMode="tail">
        {item.date}
      </Text>
      <View style={[
        styles.codeBadge,
        isDark && { backgroundColor: colors?.secondaryBackground }
      ]}>
        <Text style={[
          styles.codeText,
          isDark && { color: colors?.subtext }
        ]}>
          #{item.code?.slice(0, 6)}
        </Text>
      </View>
    </View>
    <View style={styles.cancelledProviderInfo}>
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/300' }}
        style={styles.cancelledProviderImage}
      />
      <View style={styles.cancelledProviderDetails}>
        <Text style={[
          styles.cancelledProviderName,
          isDark && { color: colors?.text }
        ]} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={[
          styles.cancelledService,
          isDark && { color: colors?.subtext }
        ]} numberOfLines={1} ellipsizeMode="tail">
          {item.service}
        </Text>
      </View>
    </View>
  </View>
));

const BookingCard = memo(({ 
  item, 
  type, 
  onCancel, 
  onFavorite, 
  onReport, 
  onReview, 
  loading, 
  showPayButton, 
  onPay, 
  isDark, 
  colors 
}: BookingCardProps) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const router = useRouter();

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 0.95,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (onCancel) onCancel();
    });
  }, [scaleValue, onCancel]);

  const getCardStyle = useCallback(() => {
    if (type === 'InProgress') {
      return [styles.containerz];
    } else if (type === 'Completed') {
      return [
        styles.completedCard,
        isDark && {
          backgroundColor: colors?.cardBackground,
          borderColor: colors?.border
        }
      ];
    } else {
      return [
        styles.cancelledCard,
        isDark && {
          backgroundColor: colors?.cardBackground,
          borderColor: colors?.border
        }
      ];
    }
  }, [type, isDark, colors]);

  const formatDate = useCallback((date: string, time?: string) => {
    try {
      if (!date) return '';
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      
      return dateObj.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: time ? 'numeric' : undefined,
        minute: time ? 'numeric' : undefined,
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'in_progress':
        return Colors.primary;
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.border;
    }
  }, []);

  const handlePress = useCallback(() => {
    try {
      let formattedDate = item.date;
      if (item.date && item.date.includes('/')) {
        const [day, month, year] = item.date.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toISOString().split('T')[0];
        }
      }

      const routeData = {
        provider_id: item.provider_id,
        service: item.service,
        date: formattedDate,
        time: item.time,
        status: item.status,
        price: item.price,
        address: item.details,
        code: item.code,
        name: item.name,
        payment_plan: item.payment_plan,
        landmark: item.landmark,
        amount: item.price,
        details: item.details
      };

      router.push({
        pathname: "/request/details/[id]",
        params: {
          id: item.code || '',
          data: JSON.stringify(routeData)
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Unable to view details. Please try again.');
    }
  }, [router, item]);

  const formatServices = useCallback((serviceString: string | undefined) => {
    if (!serviceString) return '';
    
    const services = serviceString.split(', ');
    if (services.length <= 1) return serviceString;
    
    // Check if "Catering" is in the services list
    const cateringIndex = services.findIndex(s => 
      s.toLowerCase().includes('catering')
    );
    
    // If Catering is found, show it as the primary service
    if (cateringIndex !== -1) {
      return services[cateringIndex];
    }
    
    // Otherwise return the first service as before
    return services[0];
  }, []);

  const handleFavorite = useCallback(() => {
    if (onFavorite) {
      onFavorite();
      Toast.show({
        type: 'success',
        text1: 'Added to favorites',
        text2: `${item.name} has been added to your favorites`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, [onFavorite, item.name]);

  const handleReview = useCallback(() => {
    if (onReview && item.code) {
      const bookingId = item.code.startsWith('#') ? item.code.substring(1) : item.code;
      onReview(item.provider_id, bookingId);
    }
  }, [onReview, item.code, item.provider_id]);

  const tagContainer = useMemo(() => (
    <View style={styles.tagContainer}>
      <MaterialIcons name="verified" size={14} color="#00FE37" />
      <Text style={styles.tagText} numberOfLines={1} ellipsizeMode="tail">
        {item.skill || (item.code ? `#${item.code.slice(0, 8)}` : 'Provider')}
      </Text>
    </View>
  ), [item.skill, item.code]);

  const providerInfoContainer = useMemo(() => (
    <View style={styles.infoContainer}>
      <Text style={styles.namez} numberOfLines={1} ellipsizeMode="tail">
        {(item.name || '').toUpperCase()}
      </Text>
      
      <View style={styles.infoRow}>
        <FontAwesome5
          name="calendar-alt"
          size={scale(16)}
          color="white"
          style={{ marginLeft: moderateScale(-10) }}
        />
        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
          {item.date}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="time-outline"
          size={scale(16)}
          color="white"
          style={{ marginLeft: moderateScale(-10) }}
        />
        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
          {item.time}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons
          name="home-repair-service"
          size={scale(16)}
          color="white"
          style={{ marginLeft: moderateScale(-10) }}
        />
        <View style={styles.serviceContainer}>
          <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
            {formatServices(item.service)}
          </Text>
          {item.service && item.service.split(', ').length > 1 && (
            <View style={styles.serviceCountBadge}>
              <Text style={styles.serviceCountText}>
                +{item.service.split(', ').length - 1}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="location-outline"
          size={scale(16)}
          color="white"
          style={{ marginLeft: moderateScale(-10) }}
        />
        <Text style={styles.infoText} numberOfLines={2} ellipsizeMode="tail">
          {item.details}
        </Text>
      </View>
    </View>
  ), [item.name, item.date, item.time, item.service, item.details, formatServices]);

  const buttonContent = useMemo(() => {
    if (loading) {
      return <ActivityIndicator color="white" size="small" />;
    } 
    
    if (item.payment_plan === 'half' && item.first_payment_completed === true) {
      return (
        <View style={styles.payButtonContent}>
          <MaterialIcons name="lock" size={20} color="white" />
          <Text style={styles.payButtonText}>Cannot Cancel</Text>
        </View>
      );
    }
    
    if (item.status === 'accepted') {
      return (
        <View style={styles.payButtonContent}>
          <MaterialIcons name="payment" size={20} color="white" />
          <Text style={styles.payButtonText}>Proceed to Payment</Text>
        </View>
      );
    }
    
    return (
      <>
        <Ionicons name="close-circle" size={scale(20)} color="white" />
        <Text style={styles.buttonText}>Cancel this request</Text>
      </>
    );
  }, [loading, item.payment_plan, item.first_payment_completed, item.status]);

  return (
    <View style={styles.mainContainer}>
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={handlePress}
        style={getCardStyle()}
      >
        {type === 'InProgress' && (
          <InProgressCard
            item={item}
            scaleValue={scaleValue}
            buttonContent={buttonContent}
            tagContainer={tagContainer}
            providerInfoContainer={providerInfoContainer}
            handlePress={handlePress}
            handlePressIn={handlePressIn}
            handlePressOut={handlePressOut}
            onPay={onPay}
            loading={loading}
          />
        )}

        {type === 'Completed' && (
          <CompletedCard
            item={item}
            formatDate={formatDate}
            handleFavorite={handleFavorite}
            handleReview={handleReview}
            onFavorite={onFavorite}
            isDark={isDark}
            colors={colors}
          />
        )}

        {type === 'Cancelled' && (
          <CancelledCard
            item={item}
            isDark={isDark}
            colors={colors}
          />
        )}
      </TouchableOpacity>
      
      {type === 'Cancelled' && onReport && (
        <TouchableOpacity 
          style={[
            styles.reportButton,
            isDark && { backgroundColor: 'rgba(51,169,212,0.15)' }
          ]} 
          onPress={onReport}
        >
          <Ionicons 
            name="alert-circle-outline" 
            size={16} 
            color={isDark ? colors?.tint : Colors.primary} 
            style={{ marginRight: 8 }} 
          />
          <Text style={[
            styles.reportText,
            isDark && { color: colors?.tint }
          ]}>Report an issue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default BookingCard;

const styles = ScaledSheet.create({
  containerz: {
    width: scale(329),
    height: verticalScale(270),
    backgroundColor: "rgba(26,26,26,0.86)",
    borderRadius: moderateScale(30),
    justifyContent: "space-between",
    marginBottom: moderateScale(16),
    marginLeft: moderateScale(11),
  },
  backgroundImage: {
    flex: 1,
    justifyContent: "space-between",
    borderRadius: moderateScale(30),
    overflow: "hidden",
  },
  backgroundImageStyle: {
    borderRadius: moderateScale(30),
  },
  gradient: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: moderateScale(16),
    flexWrap: "wrap",
  },
  tagContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: verticalScale(4),
    paddingHorizontal: moderateScale(9),
    borderRadius: moderateScale(20),
    maxWidth: "40%",
  },
  tagText: {
    color: "white",
    marginLeft: moderateScale(4),
    fontSize: scale(14),
    fontFamily: "Urbanist-Bold",
    flexShrink: 1,
  },
  rating: {
    color: "#FFFFFF",
    fontSize: scale(14),
    fontFamily: "Urbanist-Bold",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: verticalScale(4),
    paddingHorizontal: moderateScale(9),
    borderRadius: moderateScale(20),
  },
  contentRow: {
    alignItems: "center",
    flexDirection: "row",
    marginLeft: moderateScale(30),
  },
  infoContainer: {
    alignItems: "flex-start",
    width: "100%",
    gap: moderateScale(8),
    paddingRight: moderateScale(10),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16),
    width: "90%",
  },
  infoText: {
    color: "white",
    fontSize: scale(13),
    fontFamily: "Urbanist-Medium",
    flex: 1,
    flexWrap: "wrap",
  },
  namez: {
    color: "#FFFFFF",
    fontSize: scale(25),
    fontFamily: "Urbanist-SemiBold",
    marginBottom: moderateScale(12),
    maxWidth: '95%',
    flexShrink: 1,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D12D2D",
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(20),
    margin: moderateScale(13),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  buttonText: {
    color: "white",
    fontSize: scale(16),
    marginLeft: moderateScale(8),
    fontFamily: "Urbanist-Bold",
  },
  completedCard: {
    backgroundColor: '#fff',
    borderRadius: '12@s',
    padding: '12@s',
    marginBottom: '8@s',
    borderWidth: 0,
    borderColor: 'transparent',
    height: 'auto',
    width: '100%',
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    overflow: 'hidden',
  },
  providerInfoContainer: {
    flexDirection: 'row',
    marginBottom: '10@s',
    width: '100%',
  },
  completedProviderImage: {
    width: '50@s',
    height: '50@s',
    borderRadius: '25@s',
    marginRight: '12@s',
  },
  providerDetailsNew: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: '8@s',
  },
  rightContent: {
    alignItems: 'flex-end',
    maxWidth: '50%',
    paddingLeft: '8@s',
    justifyContent: 'center',
  },
  timeAgo: {
    fontSize: '12@s',
    color: '#888',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@s',
  },
  providerName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '4@s',
    flexShrink: 1,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteIcon: {
    marginRight: '4@s',
  },
  favoriteText: {
    fontSize: '12@s',
    color: '#007BFF',
    fontFamily: 'Urbanist-Medium',
  },
  serviceHeader: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'right',
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  serviceId: {
    fontSize: '12@s',
    color: '#888',
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@s',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@s',
  },
  bookAgainButton: {
    backgroundColor: '#007BFF',
    paddingVertical: '8@s',
    paddingHorizontal: '20@s',
    borderRadius: '8@s',
    alignItems: 'center',
    elevation: 0,
  },
  bookAgainText: {
    color: '#fff',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Bold',
  },
  cancelledCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: scale(1),
    borderColor: "#FFCCCC",
    borderRadius: moderateScale(8),
    marginBottom: moderateScale(16),
    padding: moderateScale(12),
    width: '100%',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  cancelledImage: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    marginRight: moderateScale(12),
  },
  cancelledDetails: {
    flex: 1,
  },
  reportButton: {
    marginTop: moderateScale(4),
  },
  reportText: {
    fontSize: '12@s',
    color: '#FF4B55',
    textDecorationLine: 'underline',
    fontFamily: 'Urbanist-Medium',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  paymentSection: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: '8@ms',
    borderRadius: '12@ms',
    marginHorizontal: '16@ms',
  },
  paymentNote: {
    fontSize: '14@ms',
    color: '#64748B',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '8@ms',
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(20),
    marginHorizontal: moderateScale(16),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8@ms',
  },
  payButtonText: {
    color: '#fff',
    fontSize: scale(16),
    fontFamily: 'Urbanist-Bold',
    marginLeft: moderateScale(8),
  },
  serviceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: '2@ms',
    maxWidth: '90%',
  },
  serviceCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: '4@ms',
    paddingVertical: '1@ms',
    borderRadius: '8@ms',
    minWidth: '20@ms',
    alignItems: "center",
    marginRight: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  serviceCountText: {
    color: '#fff',
    fontSize: '11@ms',
    fontFamily: 'Urbanist-Bold',
  },
  time: {
    fontSize: '12@s',
    color: '#888',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@s',
  },
  name: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '4@s',
  },
  service: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '8@s',
  },
  code: {
    fontSize: '12@s',
    color: '#007BFF',
    fontFamily: 'Urbanist-Medium',
  },
  serviceMore: {
    fontSize: '12@s',
    color: '#007BFF',
    fontFamily: 'Urbanist-Medium',
  },
  mainContainer: {
    marginBottom: '10@ms',
    width: '100%',
    backfaceVisibility: 'hidden',
  },
  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(20),
    margin: moderateScale(13),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  acceptedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.27)",
    paddingVertical: verticalScale(4),
    paddingHorizontal: moderateScale(9),
    borderRadius: moderateScale(20),
    marginHorizontal: moderateScale(8),
  },
  acceptedText: {
    color: "#00FE37",
    marginLeft: moderateScale(4),
    fontSize: scale(14),
    fontFamily: "Urbanist-Bold"
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(16),
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    padding: verticalScale(4),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#D12D2D',
  },
  statusText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Urbanist-Bold',
  },
  providerImage: {
    width: '48@s',
    height: '48@s',
    borderRadius: '24@s',
    marginRight: '12@s',
  },
  providerDetails: {
    flex: 1,
  },
  serviceText: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: '12@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginLeft: '4@s',
  },
  priceSection: {
    padding: moderateScale(16),
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCurrency: {
    fontSize: scale(14),
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  priceValue: {
    fontSize: scale(14),
    color: '#666',
    fontFamily: 'Urbanist-Bold',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@s',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: verticalScale(8),
    borderRadius: moderateScale(20),
    marginLeft: moderateScale(8),
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: scale(16),
    fontFamily: 'Urbanist-Bold',
    marginLeft: moderateScale(8),
  },
  completedButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: verticalScale(8),
    borderRadius: moderateScale(20),
    marginLeft: moderateScale(8),
  },
  actionButtonText: {
    color: '#666',
    fontSize: scale(16),
    fontFamily: 'Urbanist-Bold',
  },
  paymentPlanTag: {
    padding: verticalScale(4),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFB800',
  },
  paymentPlanText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Urbanist-Bold',
  },
  container: {
    width: scale(329),
    height: verticalScale(270),
    backgroundColor: "rgba(26,26,26,0.86)",
    borderRadius: moderateScale(30),
    justifyContent: "space-between",
    marginBottom: moderateScale(16),
    marginLeft: moderateScale(11),
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(16),
  },
  cancellationDate: {
    fontSize: scale(14),
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  codeBadge: {
    padding: verticalScale(4),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#F3F4F6',
  },
  codeText: {
    color: '#666',
    fontSize: scale(14),
    fontFamily: 'Urbanist-Medium',
  },
  cancelledProviderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(16),
  },
  cancelledProviderImage: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    marginRight: moderateScale(12),
  },
  cancelledProviderDetails: {
    flex: 1,
    maxWidth: '80%',
  },
  cancelledProviderName: {
    fontSize: scale(16),
    color: '#000',
    fontFamily: 'Urbanist-Bold',
  },
  cancelledService: {
    fontSize: scale(14),
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
});