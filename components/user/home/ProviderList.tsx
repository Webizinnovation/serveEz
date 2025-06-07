import React, { useCallback } from 'react';
import { View, TouchableOpacity, Text, Image, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider } from '../../../types';
import { Colors } from '../../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface ProviderListProps {
  providers: Provider[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onProviderPress: (id: string) => void;
  searchQuery: string;
  ListHeaderComponent: React.ReactElement;
  isDark?: boolean;
  themeColors?: any;
  loadingProviderId?: string | null;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  loading,
  refreshing,
  onRefresh,
  onLoadMore,
  onProviderPress,
  searchQuery,
  ListHeaderComponent,
  isDark = false,
  themeColors,
  loadingProviderId = null
}) => {
  const renderItem = useCallback(({ item }: { item: Provider }) => {
    // Use calculated rating from reviews if available, otherwise fall back to provider's rating
    const hasReviews = item.reviews && item.reviews.length > 0;
    const displayRating = (item.calculatedRating !== undefined && item.calculatedRating !== null) 
      ? item.calculatedRating 
      : (item.rating || 0);
    
    // Determine star color based on rating
    const getStarColor = () => {
      if (!hasReviews) return isDark ? '#fff' : Colors.primary; // Default color for new providers
      
      if (displayRating >= 4.5) return '#00C853'; // Green for excellent
      if (displayRating >= 3.5) return '#FFB300'; // Gold/Yellow for good
      if (displayRating >= 2.5) return '#FF9800'; // Orange for average
      return '#F44336'; // Red for poor
    };
    
    // Determine background color based on rating
    const getRatingBgColor = () => {
      if (!hasReviews) return isDark ? 'rgba(51,169,212,0.2)' : 'rgba(0,123,255,0.1)'; // Default color
      
      if (displayRating >= 4.5) return isDark ? 'rgba(0,200,83,0.2)' : 'rgba(0,200,83,0.1)'; // Green bg
      if (displayRating >= 3.5) return isDark ? 'rgba(255,179,0,0.2)' : 'rgba(255,179,0,0.1)'; // Yellow bg
      if (displayRating >= 2.5) return isDark ? 'rgba(255,152,0,0.2)' : 'rgba(255,152,0,0.1)'; // Orange bg
      return isDark ? 'rgba(244,67,54,0.2)' : 'rgba(244,67,54,0.1)'; // Red bg
    };
    
    const starColor = getStarColor();
    const ratingBgColor = getRatingBgColor();
    const isLoading = loadingProviderId === item.id;
    
    return (
    <TouchableOpacity 
      style={[
        styles.providerItem,
        { 
          backgroundColor: isDark ? '#262626' : '#fff',
          shadowOpacity: isDark ? 0.3 : 0.1,
        }
      ]}
      onPress={() => onProviderPress(item.id)}
      disabled={isLoading}
    >
      <View style={styles.avatarContainer}>
        {item.users?.profile_pic ? (
          <Image
            source={{ uri: item.users.profile_pic }}
            style={styles.providerAvatar}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.providerAvatar, styles.providerAvatarPlaceholder]}>
            <Ionicons name="person" size={isSmallDevice ? 36 : 40} color="#fff" />
          </View>
        )}
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator 
              size="small" 
              color="#fff" 
            />
          </View>
        )}
      </View>
      
      <View style={styles.providerInfo}>
        <Text style={[
          styles.providerName,
          { color: isDark ? '#fff' : '#333' }
        ]} numberOfLines={1}>{item.users?.name}</Text>
        <View style={styles.serviceContainer}>
          <Ionicons 
            name="briefcase-outline" 
            size={isSmallDevice ? 14 : 16} 
            color={isDark ? '#aaa' : '#666'} 
          />
          <View style={styles.servicesWrap}>
            {item.services.slice(0, 2).map((service, index) => (
              <View key={index} style={[
                styles.serviceTag,
                { backgroundColor: isDark ? 'rgba(51,169,212,0.2)' : 'rgba(28,126,222,0.1)' }
              ]}>
                <Text style={[
                  styles.serviceTagText,
                  { color: isDark ? '#fff' : Colors.primary }
                ]} numberOfLines={1}>
                  {service}
                </Text>
              </View>
            ))}
            {item.services.length > 3 && (
              <Text style={[
                styles.moreServices,
                { color: isDark ? '#aaa' : '#666' }
              ]}>
                +{item.services.length - 3}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.distanceContainer}>
          <Ionicons 
            name="location-outline" 
            size={isSmallDevice ? 14 : 16} 
            color={isDark ? '#888' : '#888'} 
          />
          <Text style={[
            styles.providerDistance,
            { color: isDark ? '#888' : '#888' }
          ]}>
            {typeof item.distance === 'number' 
              ? item.distance < 1 
                ? 'Less than 1km' 
                : `${item.distance.toFixed(1)}km away`
              : 'Distance unknown'}
          </Text>
        </View>
      </View>
      <View style={[
        styles.ratingContainer,
        { backgroundColor: ratingBgColor }
      ]}>
        <Ionicons 
          name="star" 
          size={isSmallDevice ? 14 : 16} 
          color={starColor} 
        />
        <Text style={[
          styles.providerRating,
          { color: starColor }
        ]}>
          {hasReviews 
            ? displayRating.toFixed(1)
            : 'New'}
        </Text>
      </View>
    </TouchableOpacity>
  )}, [onProviderPress, isDark, themeColors, loadingProviderId]);

  const renderEmptyComponent = useCallback(() => {
    // Search results case
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="search-outline" 
            size={isSmallDevice ? 56 : 64} 
            color={isDark ? '#555' : '#ccc'} 
          />
          <Text style={[
            styles.emptyTitle,
            { color: isDark ? '#fff' : '#333' }
          ]}>No Results Found</Text>
          <Text style={[
            styles.emptyText,
            { color: isDark ? '#aaa' : '#666' }
          ]}>
            Try searching with different keywords
          </Text>
        </View>
      );
    }

    // Initial loading case
    if (loading && !refreshing) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator 
            size="large" 
            color={isDark ? themeColors?.tint || '#33a9d4' : Colors.primary} 
          />
          <Text style={[
            styles.emptyText,
            { color: isDark ? '#aaa' : '#666', marginTop: 16 }
          ]}>Loading providers...</Text>
        </View>
      );
    }

    // Empty result after loading
    return (
      <View style={styles.emptyContainer}>
        <Ionicons 
          name="people-outline" 
          size={isSmallDevice ? 56 : 64} 
          color={isDark ? '#555' : '#ccc'} 
        />
        <Text style={[
          styles.emptyTitle,
          { color: isDark ? '#fff' : '#333' }
        ]}>No Providers Found</Text>
        <Text style={[
          styles.emptyText,
          { color: isDark ? '#aaa' : '#666' }
        ]}>
          {refreshing 
            ? 'Refreshing data...' 
            : 'There are no service providers in your area yet'}
        </Text>
        {!refreshing && (
          <TouchableOpacity 
            style={[
              styles.retryButton, 
              { backgroundColor: isDark ? 'rgba(51,169,212,0.2)' : 'rgba(28,126,222,0.1)' }
            ]}
            onPress={onRefresh}
          >
            <Text style={[
              styles.retryText, 
              { color: isDark ? themeColors?.tint || '#33a9d4' : Colors.primary }
            ]}>
              Pull down to refresh
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [searchQuery, loading, refreshing, isDark, themeColors, onRefresh]);

  return (
    <FlatList
      data={providers}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={renderEmptyComponent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={[
        styles.contentContainer,
        providers.length === 0 && { flex: 1 } // Make empty container fill screen
      ]}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = ScaledSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: isSmallDevice ? 12 : 16,
    borderRadius: 12,
    marginBottom: isSmallDevice ? 10 : 12,
    marginHorizontal: isSmallDevice ? 12 : 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    position: 'relative',
    width: isSmallDevice ? 60 : 70,
    height: isSmallDevice ? 60 : 70,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: isSmallDevice ? 10 : 12,
  },
  providerAvatar: {
    width: isSmallDevice ? 60 : 70,
    height: isSmallDevice ? 60 : 70,
    borderRadius: 10,
  },
  providerAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: isSmallDevice ? 3 : 4,
  },
  providerName: {
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallDevice ? 4 : 6,
    marginTop: isSmallDevice ? 3 : 4,
  },
  servicesWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isSmallDevice ? 3 : 4,
  },
  serviceTag: {
    backgroundColor: 'rgba(28,126,222,0.1)',
    paddingHorizontal: isSmallDevice ? 6 : 8,
    paddingVertical: isSmallDevice ? 3 : 4,
    borderRadius: 6,
  },
  serviceTagText: {
    fontSize: isSmallDevice ? 10 : 12,
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
  },
  moreServices: {
    fontSize: isSmallDevice ? 10 : 12,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    alignSelf: 'center',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallDevice ? 4 : 6,
  },
  providerDistance: {
    fontSize: isSmallDevice ? 10 : 12,
    color: '#888',
    fontFamily: 'Urbanist-Medium',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
    padding: isSmallDevice ? 5 : 6,
    borderRadius: 8,
    gap: isSmallDevice ? 3 : 4,
    minWidth: isSmallDevice ? 46 : 50,
    justifyContent: 'center',
  },
  providerRating: {
    fontSize: isSmallDevice ? 12 : 13,
    color: Colors.primary,
    fontFamily: 'Urbanist-SemiBold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? 24 : 32,
    paddingHorizontal: isSmallDevice ? 12 : 16,
  },
  emptyTitle: {
    fontSize: isSmallDevice ? 16 : 18,
    fontFamily: 'Urbanist-Bold',
    marginVertical: isSmallDevice ? 6 : 8,
  },
  emptyText: {
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    padding: isSmallDevice ? 12 : 16,
    borderRadius: 8,
    marginTop: isSmallDevice ? 12 : 16,
  },
  retryText: {
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: 'Urbanist-SemiBold',
    color: Colors.primary,
  },
}); 