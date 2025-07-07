import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, TouchableWithoutFeedback, Pressable, TextInput, Dimensions, useWindowDimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { ScaledSheet } from 'react-native-size-matters';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import SearchBar from '../../components/SearchBar';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo2svg.svg';

type DatabaseProvider = {
  id: string;
  user_id: string;
  services: string[];
  bio: string | null;
  pricing: { [key: string]: number };
  availability: boolean;
  bank_details: {
    account_number: string;
    bank_name: string;
  };
  completed_jobs: number;
  experience: number;
  level: number;
  location: {
    city: string;
    state: string;
  };
  rating: number;
  reviews_count: number;
  total_earnings: number;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    name: string;
    profile_pic: string | null;
  };
};

type Provider = DatabaseProvider & {
  distance: number;
};

export default function ServiceProvidersScreen() {
  const { name } = useLocalSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'distance',
    priceRange: { min: 0, max: 1000000 },
    maxDistance: 50 
  });
  const { width } = useWindowDimensions();
  const { isDark, colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0.4)).current;
  
  
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      fadeAnim.setValue(1);
      fadeAnim.stopAnimation();
    }
  }, [loading]);

  useEffect(() => {
    fetchProviders();
  }, [name]);

  useEffect(() => {
    let filtered = [...providers];
    
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(provider => 
        provider.users?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const getProviderPrice = (provider: Provider) => {
      if (!provider.pricing || !name) return 0;
      
      const searchName = name.toString().trim();
      
      if (provider.pricing[searchName] !== undefined) {
        return provider.pricing[searchName];
      }
      
      if (provider.pricing[searchName + ' '] !== undefined) {
        return provider.pricing[searchName + ' '];
      }
      
      const pricingKeys = Object.keys(provider.pricing);
      for (const key of pricingKeys) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes(searchName.toLowerCase()) || 
            lowerKey.startsWith(searchName.toLowerCase() + ' -')) {
          return provider.pricing[key];
        }
      }
      
      if (searchName.includes(' - ')) {
        const [mainCategory, subCategory] = searchName.split(' - ');
        for (const key of pricingKeys) {
          if (key.toLowerCase().includes(mainCategory.toLowerCase()) && 
              key.toLowerCase().includes(subCategory.toLowerCase())) {
            return provider.pricing[key];
          }
        }
      }
      
      return 0;
    };

    filtered = filtered.filter(provider => {
      const price = getProviderPrice(provider);
      return price >= filters.priceRange.min && price <= filters.priceRange.max;
    });

    filtered = filtered.filter(provider => 
      provider.distance <= filters.maxDistance
    );

    filtered.sort((a, b) => {
      const priceA = getProviderPrice(a);
      const priceB = getProviderPrice(b);

      switch (filters.sortBy) {
        case 'price_low':
          return priceA - priceB;
        case 'price_high':
          return priceB - priceA;
        case 'distance':
        default:
          return a.distance - b.distance;
      }
    });

    setFilteredProviders(filtered);
  }, [searchQuery, providers, filters, name]);

  const fetchProviders = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('providers')
        .select(`
          id,
          user_id,
          services,
          bio,
          pricing,
          availability,
          bank_details,
          completed_jobs,
          experience,
          level,
          location,
          rating,
          reviews_count,
          total_earnings,
          wallet_balance,
          created_at,
          updated_at,
          users!inner (
            id,
            name,
            profile_pic
          )
        `)
        .eq('availability', true)
        .not('users', 'is', null);

      console.log('All providers:', data);

      const searchService = name?.toString().toLowerCase().trim();
      console.log('Searching for service:', searchService);
      
      const filteredData = data?.filter(provider => {
        if (!provider.services || !Array.isArray(provider.services)) {
          return false;
        }
       
        const normalizedServices = provider.services.map(service => 
          service.toLowerCase().trim()
        );
    
        const hasService = normalizedServices.some(service => 
          service.includes(searchService) || 
          service.startsWith(`${searchService} -`) ||
          (service.includes(' - ') && service.split(' - ')[1].trim().toLowerCase() === searchService)
        );
        
        
        const hasUser = provider.users && 
          typeof provider.users === 'object' &&
          'id' in provider.users &&
          'name' in provider.users;
        
        return hasService && hasUser;
      });


      if (error) throw error;

      if (filteredData) {
        const providersWithDistance = filteredData.map(provider => {
          const users = provider.users as unknown as { id: string; name: string; profile_pic: string | null };
          
          const typedProvider: DatabaseProvider = {
            id: provider.id,
            user_id: provider.user_id,
            services: provider.services,
            bio: provider.bio,
            pricing: provider.pricing,
            availability: provider.availability,
            bank_details: provider.bank_details,
            completed_jobs: provider.completed_jobs,
            experience: provider.experience,
            level: provider.level,
            location: provider.location,
            rating: provider.rating,
            reviews_count: provider.reviews_count,
            total_earnings: provider.total_earnings,
            wallet_balance: provider.wallet_balance,
            created_at: provider.created_at,
            updated_at: provider.updated_at,
            users: users
          };
          
          return {
            ...typedProvider,
            distance: Math.floor(Math.random() * 20),
          };
        });
        
        console.log('Final providers data:', providersWithDistance);
        setProviders(providersWithDistance);
      } else {
        setProviders([]);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      setProviders([]); 
    } finally {
      setLoading(false);
    }
  };

  const renderProvider = ({ item }: { item: Provider }) => {
    if (!item.users) {
      return null;
    }

    const isSmallScreen = width < 360;

    const getServicePrice = () => {
      if (!item.pricing || !name) return 'Price on request';
      
      const searchName = name.toString().trim();
      
      // Try exact match first
      if (item.pricing[searchName] !== undefined) {
        return `₦${item.pricing[searchName]?.toLocaleString()}`;
      }
      
      if (item.pricing[searchName + ' '] !== undefined) {
        return `₦${item.pricing[searchName + ' ']?.toLocaleString()}`;
      }
      
      const pricingKeys = Object.keys(item.pricing);
      for (const key of pricingKeys) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes(searchName.toLowerCase()) || 
            lowerKey.startsWith(searchName.toLowerCase() + ' -')) {
          return `₦${item.pricing[key]?.toLocaleString()}`;
        }
      }
      
      if (searchName.includes(' - ')) {
        const [mainCategory, subCategory] = searchName.split(' - ');
        for (const key of pricingKeys) {
          if (key.toLowerCase().includes(mainCategory.toLowerCase()) && 
              key.toLowerCase().includes(subCategory.toLowerCase())) {
            return `₦${item.pricing[key]?.toLocaleString()}`;
          }
        }
      }
      
      return 'Price on request';
    };

    return (
      <View style={[
        styles.providerCard,
        isDark && { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border 
        },
        isSmallScreen && styles.providerCardSmall
      ]}>
        <Image
          source={{ uri: item.users.profile_pic || 'https://via.placeholder.com/150' }}
          style={[
            styles.providerImage,
            isSmallScreen && { width: 105 }
          ]}
        />
        <View style={[
          styles.providerInfo,
          isSmallScreen && { 
            paddingVertical: 8,
            paddingHorizontal: 8
          }
        ]}>
          <View style={styles.contentContainer}>
            <View style={[
              styles.headerRow,
              isSmallScreen && { marginBottom: 2 }
            ]}>
              <View style={styles.distanceContainer}>
                <Ionicons name="location" size={isSmallScreen ? 12 : 14} color="#FF4B55" />
                <Text style={[
                  styles.distanceText,
                  isDark && { color: colors.subtext },
                  isSmallScreen && { fontSize: 9 }
                ]}>
                  {item.distance <= 9 ? 'Closest to you' : `${item.distance}KM AWAY`}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={[
                  styles.priceText,
                  isDark && { color: colors.tint },
                  isSmallScreen && { fontSize: 12 }
                ]}>
                  {getServicePrice()}
                </Text>
              </View>
            </View>
            <Text 
              style={[
                styles.providerName,
                isDark && { color: colors.text },
                isSmallScreen && { 
                  fontSize: 14,
                  marginBottom: 1,
                  marginTop: 2,
                  lineHeight: 18
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.users?.name || 'Unknown Provider'}
            </Text>
            <Text style={[
              styles.bioText,
              isDark && { color: colors.subtext },
              isSmallScreen && { 
                fontSize: 10,
                lineHeight: 13,
                marginTop: 0,
                opacity: 0.8
              }
            ]} numberOfLines={isSmallScreen ? 1 : 2}>
              {item.bio || "I make use of advanced professional tools for ease and accurate results"}
            </Text>
          </View>
          <View style={[
            styles.buttonContainer,
            isSmallScreen && { 
              gap: 6,
              paddingTop: 5,
              marginTop: 3
            }
          ]}>
            <TouchableOpacity 
              style={[
                styles.viewButton,
                isDark && { 
                  backgroundColor: 'rgba(0, 102, 204, 0.15)'
                },
                isSmallScreen && {
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: 4
                }
              ]} 
              onPress={() => router.push(`/(provider)/${item.id}`)}
            >
              <Text style={[
                styles.viewButtonText,
                isDark && { color: colors.tint },
                isSmallScreen && { fontSize: 10 }
              ]}>View more</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.requestButton,
                { backgroundColor: colors.tint },
                isSmallScreen && {
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: 4
                }
              ]} 
              onPress={() => router.push({
                pathname: "/request/[id]",
                params: {
                  id: item.id,
                  service: name?.toString().trim() || '',
                  price: item.pricing ? 
                    (getServicePrice().startsWith('₦') 
                      ? parseFloat(getServicePrice().substring(1).replace(/,/g, '')) 
                      : 0)
                    : 0
                }
              })}
            >
              <Text style={[
                styles.requestButtonText,
                isSmallScreen && { fontSize: 10 }
              ]}>Make request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="people-outline" 
        size={64} 
        color={isDark ? colors.inactive : "#ccc"} 
      />
      <Text style={[
        styles.emptyTitle,
        isDark && { color: colors.text }
      ]}>No Providers Found</Text>
      <Text style={[
        styles.emptyText,
        isDark && { color: colors.subtext }
      ]}>
        There are no {name} providers available at the moment
      </Text>
    </View>
  );

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
    }
  };

  const toggleFilterModal = () => {
    setShowFilterModal(!showFilterModal);
  };

  const handleOutsidePress = () => {
    if (showSearch) {
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={toggleFilterModal}
    >
      <TouchableWithoutFeedback onPress={toggleFilterModal}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.modalContent,
              isDark && { backgroundColor: colors.cardBackground }
            ]}>
              <View style={[
                styles.modalHeader,
                isDark && { borderBottomColor: colors.border }
              ]}>
                <Text style={[
                  styles.modalTitle,
                  isDark && { color: colors.text }
                ]}>Filter & Sort</Text>
                <TouchableOpacity onPress={toggleFilterModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={isDark ? colors.text : "#000"} />
                </TouchableOpacity>
              </View>

              <View style={styles.filterSection}>
                <Text style={[
                  styles.filterLabel,
                  isDark && { color: colors.text }
                ]}>Sort By</Text>
                <View style={styles.sortOptions}>
                  {[
                    { id: 'distance', label: 'Distance', icon: 'location-outline' },
                    { id: 'price_low', label: 'Price: Low to High', icon: 'trending-up-outline' },
                    { id: 'price_high', label: 'Price: High to Low', icon: 'trending-down-outline' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.sortButton,
                        isDark && { 
                          backgroundColor: filters.sortBy === option.id ? colors.tint : 'transparent',
                          borderColor: filters.sortBy === option.id ? colors.tint : colors.border
                        },
                        !isDark && filters.sortBy === option.id && styles.activeSortButton
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, sortBy: option.id }))}
                    >
                      <Ionicons 
                        name={option.icon as any} 
                        size={20} 
                        color={
                          isDark 
                            ? (filters.sortBy === option.id ? '#fff' : colors.inactive) 
                            : (filters.sortBy === option.id ? '#fff' : '#666')
                        } 
                      />
                      <Text style={[
                        styles.sortButtonText,
                        isDark && { color: filters.sortBy === option.id ? '#fff' : colors.subtext },
                        !isDark && filters.sortBy === option.id && styles.activeSortButtonText
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={[
                  styles.filterLabel,
                  isDark && { color: colors.text }
                ]}>Maximum Distance</Text>
                <View style={styles.distanceOptions}>
                  {[5, 10, 25, 50].map((distance) => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.distanceButton,
                        isDark && {
                          backgroundColor: filters.maxDistance === distance ? colors.tint : 'rgba(255,255,255,0.05)',
                          borderColor: filters.maxDistance === distance ? colors.tint : colors.border
                        },
                        !isDark && filters.maxDistance === distance && styles.activeDistanceButton
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, maxDistance: distance }))}
                    >
                      <Text style={[
                        styles.distanceButtonText,
                        isDark && { 
                          color: filters.maxDistance === distance ? '#fff' : colors.subtext 
                        },
                        !isDark && filters.maxDistance === distance && styles.activeDistanceButtonText
                      ]}>
                        {distance} KM
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={[
                  styles.filterLabel,
                  isDark && { color: colors.text }
                ]}>Price Range</Text>
                <View style={styles.priceInputContainer}>
                  <View style={[
                    styles.priceInput,
                    isDark && { 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: colors.border 
                    }
                  ]}>
                    <Text style={[
                      styles.currencySymbol,
                      isDark && { color: colors.text }
                    ]}>₦</Text>
                    <TextInput
                      style={[
                        styles.input,
                        isDark && { color: colors.text }
                      ]}
                      value={filters.priceRange.min.toString()}
                      onChangeText={(value) => setFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, min: parseInt(value) || 0 }
                      }))}
                      keyboardType="numeric"
                      placeholder="Min"
                      placeholderTextColor={isDark ? colors.inactive : '#999'}
                    />
                  </View>
                  <Text style={[
                    styles.priceSeparator,
                    isDark && { color: colors.text }
                  ]}>to</Text>
                  <View style={[
                    styles.priceInput,
                    isDark && { 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: colors.border 
                    }
                  ]}>
                    <Text style={[
                      styles.currencySymbol,
                      isDark && { color: colors.text }
                    ]}>₦</Text>
                    <TextInput
                      style={[
                        styles.input,
                        isDark && { color: colors.text }
                      ]}
                      value={filters.priceRange.max.toString()}
                      onChangeText={(value) => setFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, max: parseInt(value) || 0 }
                      }))}
                      keyboardType="numeric"
                      placeholder="Max"
                      placeholderTextColor={isDark ? colors.inactive : '#999'}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[
                    styles.resetButton,
                    isDark && { 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: colors.border 
                    }
                  ]}
                  onPress={() => setFilters({
                    sortBy: 'distance',
                    priceRange: { min: 0, max: 100000 },
                    maxDistance: 50
                  })}
                >
                  <Text style={[
                    styles.resetButtonText,
                    isDark && { color: colors.text }
                  ]}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.applyButton,
                    { backgroundColor: colors.tint }
                  ]}
                  onPress={toggleFilterModal}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={[
        styles.container,
        isDark && { backgroundColor: colors.background }
      ]}>
        <View style={styles.headerBackground}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={isDark ? '#000000' : '#1a1a1a'} stopOpacity="0.9" />
                <Stop offset="1" stopColor={isDark ? '#121212' : '#000000'} stopOpacity="0.85" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#grad)" />
          </Svg>
          <View style={[
            styles.headerContent,
            { paddingBottom: showSearch ? 8 : 16 }
          ]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
                  <Ionicons name="search" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={toggleFilterModal}>
                  <Ionicons name="options-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            {showSearch ? (
              <TouchableWithoutFeedback>
                <View>
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search providers by name or bio..."
                  />
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <>
                <Text style={styles.headerTitle}>{name}</Text>
                <View style={styles.titleUnderline} />
                <Text style={styles.subtitle}>
                  Get help from professionals to fix all home and office appliances
                </Text>
              </>
            )}
          </View>
        </View>
        {loading ? (
          <View style={[
            styles.loadingContainer,
            isDark && { backgroundColor: colors.background }
          ]}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <Logo width={80} height={80} />
            </Animated.View>
            <Text style={[
              styles.loadingText,
              isDark && { color: colors.subtext }
            ]}>Loading providers...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProviders}
            renderItem={renderProvider}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContainer,
              filteredProviders.length === 0 && { flexGrow: 1 }
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyComponent}
          />
        )}
        {renderFilterModal()}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerBackground: {
    height: '180@vs',
    backgroundColor: '#0066CC', 
  },
  headerContent: {
    flex: 1,
    paddingTop: '25@vs',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '16@s',
  },
  headerRight: {
    flexDirection: 'row',
    gap: '16@s',
  },
  headerButton: {
    padding: '8@s',
  },
  headerTitle: {
    fontSize: '28@s',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
    marginTop: '16@vs',
    marginLeft: '24@s',
  },
  titleUnderline: {
    height: '2@vs',
    width: '40@s',
    backgroundColor: '#FF6B00',
    marginLeft: '24@s',
    marginTop: '8@vs',
    borderRadius: '1@vs',
  },
  subtitle: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#fff',
    marginTop: '8@vs',
    marginLeft: '24@s',
    opacity: 0.8,
  },
  listContainer: {
    padding: '16@s',
    paddingBottom: '100@vs', // Extra padding for safe bottom area
  },
  providerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: '16@s',
    marginBottom: '12@vs',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
    position: 'relative',
    height: '130@vs',
    minHeight: '120@s',
  },
  providerCardSmall: {
    height: '115@vs',
    minHeight: '110@s',
    borderRadius: '12@s',
  },
  providerImage: {
    width: '100@s',
    height: '100%',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 0,
    paddingVertical: '12@vs',
    paddingHorizontal: '12@s',
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4@vs',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: '10@s',
    fontFamily: 'Urbanist-Medium',
    color: '#FF4B55',
    marginLeft: '4@s',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF6B00',
  },
  providerName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '2@vs',
  },
  bioText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '16@vs',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: '8@s',
    paddingTop: '8@vs',
  },
  viewButton: {
    backgroundColor: '#E5F3FF',
    paddingVertical: '6@vs',
    paddingHorizontal: '16@s',
    borderRadius: '6@s',
  },
  viewButtonText: {
    color: '#0066CC',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
  requestButton: {
    backgroundColor: '#0066CC',
    paddingVertical: '6@vs',
    paddingHorizontal: '16@s',
    borderRadius: '6@s',
  },
  requestButtonText: {
    color: '#fff',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: '16@vs',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '32@vs',
    paddingHorizontal: '16@s',
  },
  emptyTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginVertical: '8@vs',
  },
  emptyText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: '24@s',
    borderTopRightRadius: '24@s',
    padding: '24@s',
    minHeight: '60%',
    maxHeight: '90%', 
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20@vs',
    paddingBottom: '12@vs',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  modalTitle: {
    fontSize: '22@s', 
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  closeButton: {
    padding: '4@s',
  },
  filterSection: {
    marginBottom: '20@vs',
  },
  filterLabel: {
    fontSize: '16@s', 
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '12@vs',
  },
  sortOptions: {
    gap: '10@vs',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '12@vs',
    borderRadius: '12@s',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: '8@s',
  },
  activeSortButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortButtonText: {
    fontSize: '14@s', 
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
  },
  activeSortButtonText: {
    color: '#fff',
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '8@s',
  },
  distanceButton: {
    paddingVertical: '8@vs', // Reduced for smaller screens
    paddingHorizontal: '14@s', // Reduced for smaller screens
    borderRadius: '10@s',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F8F9FA',
  },
  activeDistanceButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  distanceButtonText: {
    fontSize: '13@s', // Reduced for smaller screens
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
  },
  activeDistanceButtonText: {
    color: '#fff',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@s',
  },
  priceInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: '12@s',
    paddingHorizontal: '12@s',
    paddingVertical: '8@vs',
    backgroundColor: '#F8F9FA',
  },
  currencySymbol: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginRight: '4@s',
  },
  input: {
    flex: 1,
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  priceSeparator: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  resetButton: {
    flex: 1,
    paddingVertical: '14@vs', // Slightly reduced
    borderRadius: '12@s',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resetButtonText: {
    color: '#666',
    fontSize: '14@s', // Reduced for smaller screens
    fontFamily: 'Urbanist-Bold',
  },
  applyButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: '14@vs', // Slightly reduced
    borderRadius: '12@s',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: '14@s', // Reduced for smaller screens
    fontFamily: 'Urbanist-Bold',
  },
}); 