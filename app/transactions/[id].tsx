import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo2svg.svg';

// Define proper types for the HeaderTitle component props
interface HeaderTitleProps {
  loading: boolean;
  isDark: boolean;
  colors: any; // Using 'any' for colors since we don't have direct access to the ThemeType
  fadeValue: Animated.Value;
}

// First, let's create a custom header component that can show either the logo or title
const HeaderTitle: React.FC<HeaderTitleProps> = ({ loading, isDark, colors, fadeValue }) => {
  if (loading) {
    return (
      <Animated.View style={{ opacity: fadeValue, alignItems: 'center' }}>
        <Logo width={32} height={32} />
      </Animated.View>
    );
  }
  
  return (
    <Text style={[
      styles.headerTitle,
      isDark && { color: colors.text }
    ]}>
      Transaction Details
    </Text>
  );
};

export default function TransactionDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isDark, colors } = useTheme();
  
  // Animation for the logo - for fading effect
  const fadeValue = React.useRef(new Animated.Value(0.4)).current;
  
  // Get screen dimensions for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenHeight < 700;
  
  // Start the fading animation when loading is true
  React.useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeValue, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(fadeValue, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      fadeValue.setValue(1);
    }
  }, [loading]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} at ${date.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  };

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setTransaction(data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [id]);

  if (loading) {
    return (
      <View style={[
        styles.container,
        isDark && { backgroundColor: colors.background }
      ]}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: "Loading Transaction...",
            headerStyle: {
              backgroundColor: isDark ? colors.cardBackground : '#fff',
            },
            headerTitle: () => <HeaderTitle loading={loading} isDark={isDark} colors={colors} fadeValue={fadeValue} />,
            headerShadowVisible: false,
            headerLeft: () => (
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#333"} />
              </TouchableOpacity>
            ),
          }} 
        />
        
        <View style={[
          styles.loadingContainer,
          isDark && { backgroundColor: colors.background }
        ]}>
          <Animated.View style={{ opacity: fadeValue }}>
            <Logo width={70} height={70} />
          </Animated.View>
          <Text style={[
            styles.loadingText,
            isDark && { color: colors.text }
          ]}>
            Loading transaction details...
          </Text>
        </View>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={[
        styles.container,
        isDark && { backgroundColor: colors.background }
      ]}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: "Transaction Not Found",
            headerStyle: {
              backgroundColor: isDark ? colors.cardBackground : '#fff',
            },
            headerTitle: () => <HeaderTitle loading={false} isDark={isDark} colors={colors} fadeValue={fadeValue} />,
            headerShadowVisible: false,
            headerLeft: () => (
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#333"} />
              </TouchableOpacity>
            ),
          }} 
        />
        
        <View style={[
          styles.errorContainer,
          isDark && { backgroundColor: colors.background }
        ]}>
          <Ionicons name="alert-circle-outline" size={60} color={isDark ? "#D32F2F" : "red"} />
          <Text style={[
            styles.errorText,
            isDark && { color: colors.text }
          ]}>Transaction not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: transaction ? `Transaction ${transaction.reference.substring(0, 8)}...` : "Transaction Details",
          headerStyle: {
            backgroundColor: isDark ? colors.cardBackground : '#fff',
          },
          headerTitle: () => <HeaderTitle loading={loading} isDark={isDark} colors={colors} fadeValue={fadeValue} />,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#333"} />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView style={styles.scrollView}>
        <View style={[
          styles.card,
          isDark && { 
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            borderWidth: 1
          }
        ]}>
          <View style={styles.header}>
            {transaction.status === 'failed' ? (
              <Ionicons 
                name="close-circle" 
                size={40} 
                color="#D32F2F" 
              />
            ) : (
              <Ionicons 
                name={transaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                size={40} 
                color={transaction.type === 'deposit' ? 'green' : 'red'} 
              />
            )}
            <Text style={[
              styles.type,
              isDark && { color: colors.text }
            ]}>
              {transaction.status === 'failed' ? 'Failed ' : ''}
              {transaction.type === 'deposit' ? 'Deposit' : 
              transaction.type === 'payment' ? 'Payment' : 'Withdrawal'}
            </Text>
          </View>

          <Text style={[
            styles.amount,
            isDark && { color: colors.text },
            transaction.status === 'failed' && { color: '#D32F2F' }
          ]}>
            {transaction.status === 'failed' ? 'x' : 
             transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
          </Text>

          <View style={[
            styles.detailsContainer,
            isDark && { backgroundColor: colors.secondaryBackground }
          ]}>
            <View style={styles.detailItem}>
              <Text style={[
                styles.label,
                isDark && { color: colors.subtext }
              ]}>Date & Time</Text>
              <Text style={[
                styles.value,
                isDark && { color: colors.text }
              ]}>{formatDate(transaction.created_at)}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[
                styles.label,
                isDark && { color: colors.subtext }
              ]}>Reference Number</Text>
              <Text style={[
                styles.value,
                isDark && { color: colors.text }
              ]}>#{transaction.reference}</Text>
            </View>

            {transaction.type === 'deposit' && (
              <>
                <View style={styles.detailItem}>
                  <Text style={[
                    styles.label,
                    isDark && { color: colors.subtext }
                  ]}>Payment Method</Text>
                  <Text style={[
                    styles.value,
                    isDark && { color: colors.text }
                  ]}>
                    {transaction.metadata?.payment_method || 'Paystack'}
                  </Text>
                </View>
                {transaction.metadata?.paystack_response && (
                  <View style={styles.detailItem}>
                    <Text style={[
                      styles.label,
                      isDark && { color: colors.subtext }
                    ]}>Payment Channel</Text>
                    <Text style={[
                      styles.value,
                      isDark && { color: colors.text }
                    ]}>
                      {transaction.metadata.paystack_response.channel || 'N/A'}
                    </Text>
                  </View>
                )}
              </>
            )}

            {transaction.type === 'payment' && (
              <>
                {transaction.metadata?.provider_name && (
                  <View style={styles.detailItem}>
                    <Text style={[
                      styles.label,
                      isDark && { color: colors.subtext }
                    ]}>Provider Name</Text>
                    <Text style={[
                      styles.value,
                      isDark && { color: colors.text }
                    ]}>{transaction.metadata.provider_name}</Text>
                  </View>
                )}
                {transaction.metadata?.service && (
                  <View style={styles.detailItem}>
                    <Text style={[
                      styles.label,
                      isDark && { color: colors.subtext }
                    ]}>Service</Text>
                    <Text style={[
                      styles.value,
                      isDark && { color: colors.text }
                    ]}>{transaction.metadata.service}</Text>
                  </View>
                )}
                {transaction.metadata?.payment_type && (
                  <View style={styles.detailItem}>
                    <Text style={[
                      styles.label,
                      isDark && { color: colors.subtext }
                    ]}>Payment Type</Text>
                    <Text style={[
                      styles.value,
                      isDark && { color: colors.text }
                    ]}>
                      {transaction.metadata.payment_type.split('_').map((word: string) => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </Text>
                  </View>
                )}
                {transaction.booking_id && (
                  <View style={styles.detailItem}>
                    <Text style={[
                      styles.label,
                      isDark && { color: colors.subtext }
                    ]}>Booking ID</Text>
                    <Text style={[
                      styles.value,
                      isDark && { color: colors.text }
                    ]}>#{transaction.booking_id}</Text>
                  </View>
                )}
              </>
            )}

            {transaction.type === 'withdrawal' && (
              <>
                <View style={styles.detailItem}>
                  <Text style={[
                    styles.label,
                    isDark && { color: colors.subtext }
                  ]}>Bank Name</Text>
                  <Text style={[
                    styles.value,
                    isDark && { color: colors.text }
                  ]}>
                    {transaction.metadata?.bank_name || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[
                    styles.label,
                    isDark && { color: colors.subtext }
                  ]}>Account Name</Text>
                  <Text style={[
                    styles.value,
                    isDark && { color: colors.text }
                  ]}>
                    {transaction.metadata?.account_name || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[
                    styles.label,
                    isDark && { color: colors.subtext }
                  ]}>Account Number</Text>
                  <Text style={[
                    styles.value,
                    isDark && { color: colors.text }
                  ]}>
                    {transaction.metadata?.account_number || 'N/A'}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.detailItem}>
              <Text style={[
                styles.label,
                isDark && { color: colors.subtext }
              ]}>Status</Text>
              <Text style={[
                styles.value,
                { 
                  color: transaction.status === 'completed' ? 'green' : 
                         transaction.status === 'failed' ? '#D32F2F' : 'orange' 
                }
              ]}>
                {transaction.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollView: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '50@ms',
  },
  loadingText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#555',
    marginTop: '16@ms',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '50@ms',
  },
  errorText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: 'red',
    marginTop: '12@ms',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16@ms',
    margin: '16@ms',
    padding: '16@ms',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@ms',
  },
  type: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginLeft: '12@ms',
  },
  amount: {
    fontSize: '32@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '24@ms',
  },
  detailsContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: '12@ms',
    padding: '16@ms',
  },
  detailItem: {
    marginBottom: '12@ms',
  },
  label: {
    fontSize: '12@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  value: {
    fontSize: '14@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
}); 