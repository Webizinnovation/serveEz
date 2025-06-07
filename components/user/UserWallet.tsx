import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground,
  Image,
  Alert,
  RefreshControl,
  Modal,
  Platform,
  Dimensions,
  FlexAlignType
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase';
import { UserWalletStyles } from '../../utils/styles';
import { useTheme } from '../../components/ThemeProvider';
import DrawerModal from '../common/DrawerModal';
import { sendTransactionPendingNotification } from '../../services/pushNotifications';

interface PendingPayment {
  id: string;
  amount: number;
  provider_id: string;
  booking_date: string;
  service: string;
  provider: {
    id: string;
    users: {
      id: string;
      name: string;
      profile_pic: string | null;
    }
  }
}

interface UserWalletProps {
  initialBalance?: number;
  pendingPayments?: any[];
  onPayNow?: (paymentId: string) => Promise<void>;
  onMenuPress?: () => void;
}

// Helper function to format date must be defined outside the component
const formatDateString = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}`;
    }
    
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}`;
    }
    
    // Otherwise show full date
    return `${date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} at ${date.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  } catch (e) {
    // Fallback in case of invalid date
    return dateString;
  }
};

// Add a memoized transaction item component for better performance
const MemoizedTransactionItem = memo(({ 
  transaction, 
  onPress, 
  isDark, 
  colors, 
  isSmallDevice 
}: { 
  transaction: any; 
  onPress: () => void; 
  isDark: boolean; 
  colors: any; 
  isSmallDevice: boolean;
}) => {
  // Define properly typed icon container styles inline
  const iconContainerStyle = {
    width: 40,
    height: 40,
    justifyContent: 'center' as 'center',
    alignItems: 'center' as FlexAlignType,
    borderRadius: 20,
    marginRight: 8,
  };

  return (
    <TouchableOpacity 
      key={transaction.id} 
      style={[
        UserWalletStyles.transactionItem,
        isDark && {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          borderWidth: 1
        },
        isSmallDevice && { 
          paddingVertical: 10,
          paddingHorizontal: 12
        },
        // Add elevation for better visual hierarchy
        {
          shadowColor: isDark ? '#000' : "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 2,
          elevation: 2,
          marginBottom: 8
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={iconContainerStyle}>
        {transaction.status === 'failed' ? (
          <Ionicons 
            name="close-circle" 
            size={24} 
            color="red" 
          />
        ) : (
          <Ionicons 
            name={transaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
            size={24} 
            color={transaction.type === 'deposit' ? 'green' : 'red'} 
          />
        )}
      </View>
      <View style={UserWalletStyles.transactionDetails}>
        <Text style={[
          UserWalletStyles.transactionName,
          isDark && { color: colors.text },
          isSmallDevice && { fontSize: 14 }
        ]}>
          {transaction.status === 'failed' 
            ? `Failed ${transaction.type === 'deposit' ? 'Deposit' : transaction.type === 'withdrawal' ? 'Withdrawal' : 'Payment'}`
            : transaction.type === 'deposit' 
              ? `Deposit via ${transaction.metadata?.payment_method || 'Paystack'}`
              : transaction.metadata?.provider_name 
                ? `Transfer to ${transaction.metadata.provider_name}`
                : `Transfer to ${transaction.metadata?.bank_name || 'Bank'}${
                  transaction.metadata?.account_name ? ` - ${transaction.metadata.account_name}` : ''
                }`
          }
        </Text>
        <Text style={[
          UserWalletStyles.transactionDate,
          isDark && { color: colors.subtext },
          isSmallDevice && { fontSize: 12 }
        ]}>
          {formatDateString(transaction.created_at)}
        </Text>
      </View>
      <Text style={[
        UserWalletStyles.transactionAmount,
        { 
          color: transaction.status === 'failed' ? '#D32F2F' :
                 transaction.type === 'deposit' ? 'green' : 'red' 
        },
        isSmallDevice && { fontSize: 15 }
      ]}>
        {transaction.status === 'failed' ? 'x' :
         transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
});

export function UserWallet({ 
  initialBalance = 0,
  pendingPayments = [],
  onPayNow = async () => {},
  onMenuPress,
}: UserWalletProps) {
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);
  const depositScaleAnim = React.useRef(new Animated.Value(1)).current;
  const withdrawScaleAnim = React.useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState(Date.now());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingBookingPayments, setPendingBookingPayments] = useState<PendingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get screen dimensions for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenHeight < 700;

  // Add refs for channel subscriptions
  const transactionsChannelRef = useRef<any>(null);
  const bookingsChannelRef = useRef<any>(null);

  const handlePressIn = (
    anim: Animated.Value,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    setLoading(true);
    Animated.spring(anim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (
    anim: Animated.Value,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
    }).start(() => setLoading(false));
  };

  const handleDeposit = () => {
    router.push('/payment/deposit');
  };

  const handleWithdrawPress = () => {
    router.push('/payment/withdraw-pin');
  };

  const fetchPendingBookingPayments = async () => {
    try {
      setIsLoading(true);
      
      if (!profile?.id) return;
      
      // Fetch all in-progress bookings for the current user
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          amount,
          provider_id,
          booking_date,
          status
        `)
        .eq('user_id', profile?.id)
        .eq('status', 'in_progress');

      if (bookingsError) throw bookingsError;

      if (!bookings?.length) {
        setPendingBookingPayments([]);
        return;
      }

      // Fetch provider details for each booking
      const providerIds = bookings.map(booking => booking.provider_id);
      const { data: providers, error: providersError } = await supabase
        .from('providers')
        .select(`
          id,
          users (
            id,
            name,
            profile_pic
          )
        `)
        .in('id', providerIds);

      if (providersError) throw providersError;

      // Transform bookings to match the pendingPayments format
      const transformedBookings: PendingPayment[] = bookings.map(booking => {
        const provider = providers?.find(p => p.id === booking.provider_id);
        
        // Make sure we handle the users object correctly
        let providerInfo: PendingPayment['provider'];
        
        if (provider && provider.users) {
          if (Array.isArray(provider.users) && provider.users.length > 0) {
            // If users is an array, take the first user
            const user = provider.users[0];
            providerInfo = {
              id: provider.id,
              users: {
                id: user.id || '',
                name: user.name || 'Unknown Provider',
                profile_pic: user.profile_pic
              }
            };
          } else {
            // If users is a direct object (not an array)
            const user = provider.users as any; // Use type assertion
            providerInfo = {
              id: provider.id,
              users: {
                id: user.id || '',
                name: user.name || 'Unknown Provider',
                profile_pic: user.profile_pic
              }
            };
          }
        } else {
          // Default fallback if provider or provider.users is undefined
          providerInfo = {
            id: booking.provider_id,
            users: {
              id: '',
              name: 'Unknown Provider',
              profile_pic: null
            }
          };
        }
        
        return {
          id: booking.id,
          amount: booking.amount,
          provider_id: booking.provider_id,
          booking_date: booking.booking_date,
          service: booking.service,
          provider: providerInfo
        };
      });

      setPendingBookingPayments(transformedBookings);
    } catch (error) {
      console.error('Error fetching pending booking payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletAndTransactions = async () => {
    try {
      setRefreshing(true);
      
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile?.id)
        .single();

      if (wallet) {
        setBalance(wallet.balance);
      }

      await fetchTransactions();
      
      setLastTransactionTimestamp(Date.now());
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handlePayBooking = async (bookingId: string) => {
    try {
      // Find the payment details to personalize the message
      const payment = pendingBookingPayments.find(p => p.id === bookingId);
      const providerName = payment?.provider.users.name || 'Provider';
      const serviceDisplayName = payment ? formatServiceName(payment.service) : 'service';
      
      // Check if we're dealing with multiple services
      const isMultipleServices = payment?.service && 
        (payment.service.includes(',') || payment.service.includes(';') || payment.service.includes('|'));
      
      Alert.alert(
        '💼 Payment Required',
        `To complete your payment for ${serviceDisplayName} with ${providerName}, please proceed to the Services tab where you can review and finalize ${isMultipleServices ? 'these transactions' : 'this transaction'}.`,
        [
          {
            text: 'Later',
            style: 'cancel'
          },
          {
            text: 'Go to Services',
            style: 'default',
            onPress: () => router.push('/(tabs)/services')
          }
        ],
        { cancelable: true }
      );

      // For payment notifications, use the safer approach to prevent issues during unmounting
      if (payment) {
        // Use a try-catch block to handle any errors with the notification
        try {
          // Use a safer import pattern with error handling
          import('../../services/pushNotifications')
            .then(({ scheduleLocalNotification }) => {
              // Put notification in a timeout to ensure it doesn't interfere with UI operations
              setTimeout(() => {
                scheduleLocalNotification(
                  'Payment Required',
                  `Your payment of ₦${payment.amount.toLocaleString()} for ${serviceDisplayName} with ${providerName} is waiting to be completed.`,
                  { type: 'payment_pending', amount: payment.amount }
                ).catch(err => console.error('Notification scheduling error:', err));
              }, 300);
            })
            .catch(err => console.error('Module import error:', err));
        } catch (error) {
          console.error('Error sending payment notification:', error);
          // Fail silently - don't let notification errors crash the app
        }
      }
    } catch (error) {
      console.error('Error handling booking payment:', error);
      Alert.alert('Error', 'Unable to process this payment request right now. Please try again later.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWalletAndTransactions();
      fetchPendingBookingPayments();
      return () => {};
    }, [])
  );

  useEffect(() => {
    fetchWalletAndTransactions();
    fetchPendingBookingPayments();

    // Clean up existing channels if they exist
    if (transactionsChannelRef.current) {
      supabase.removeChannel(transactionsChannelRef.current);
    }
    
    if (bookingsChannelRef.current) {
      supabase.removeChannel(bookingsChannelRef.current);
    }

    const transactionsSubscription = supabase
      .channel('transactions-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions',
          filter: `user_id=eq.${profile?.id}`
        }, 
        () => {
          fetchWalletAndTransactions();
        }
      )
      .subscribe();

    // Store the channel reference
    transactionsChannelRef.current = transactionsSubscription;

    const bookingsSubscription = supabase
      .channel('bookings-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${profile?.id}`
        },
        () => {
          fetchPendingBookingPayments();
        }
      )
      .subscribe();
      
    // Store the channel reference
    bookingsChannelRef.current = bookingsSubscription;

    // Cleanup function to prevent memory leaks and state updates on unmounted components
    return () => {
      // Cancel any ongoing animations or timers
      // Remove all supabase channels
      if (transactionsChannelRef.current) {
        supabase.removeChannel(transactionsChannelRef.current);
      }
      
      if (bookingsChannelRef.current) {
        supabase.removeChannel(bookingsChannelRef.current);
      }
      
      // Flag to prevent any async operations from updating state after unmount
      const isUnmounted = true;
    };
  }, [profile?.id]);

  const onRefresh = async () => {
    await fetchWalletAndTransactions();
    await fetchPendingBookingPayments();
  };

  // Update the formatDate function to use our helper
  const formatDate = formatDateString;

  // Format booking date for display
  const formatBookingDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleTransactionPress = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalVisible(true);
  };

  const renderTransactionModal = () => {
    if (!selectedTransaction) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={[
          UserWalletStyles.modalOverlay,
          isSmallDevice && {
            paddingTop: 40,
            paddingBottom: 20
          }
        ]}>
          <View style={[
            UserWalletStyles.modalContent,
            isDark && {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
              borderWidth: 1
            },
            isSmallDevice && { 
              width: '92%', 
              maxHeight: screenHeight * 0.75,
              borderRadius: 16
            }
          ]}>
            <View style={[
              UserWalletStyles.modalHeader,
              isDark && { borderBottomColor: colors.border }
            ]}>
              <Text style={[
                UserWalletStyles.modalTitle,
                isDark && { color: colors.text },
                isSmallDevice && { fontSize: 18 }
              ]}>Transaction Details</Text>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={UserWalletStyles.closeButton}
              >
                <Ionicons name="close" size={24} color={isDark ? colors.text : "#333"} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={isSmallDevice ? { maxHeight: screenHeight * 0.6 } : undefined}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <View style={[
                UserWalletStyles.modalBody,
                isSmallDevice && { 
                  padding: 12,
                  paddingBottom: 16
                }
              ]}>
                <View style={UserWalletStyles.detailRow}>
                  {selectedTransaction.status === 'failed' ? (
                    <Ionicons 
                      name="close-circle" 
                      size={40} 
                      color="red" 
                      style={UserWalletStyles.modalIcon}
                    />
                  ) : (
                    <Ionicons 
                      name={selectedTransaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                      size={40} 
                      color={selectedTransaction.type === 'deposit' ? 'green' : 'red'} 
                      style={UserWalletStyles.modalIcon}
                    />
                  )}
                  <Text style={[
                    UserWalletStyles.transactionType,
                    isDark && { color: colors.text },
                    isSmallDevice && { fontSize: 16 }
                  ]}>
                    {selectedTransaction.status === 'failed' ? 'Failed' : 
                     selectedTransaction.type === 'deposit' ? 'Deposit' : 'Payment'}
                  </Text>
                </View>

                <Text style={[
                  UserWalletStyles.amountLarge,
                  isDark && { color: colors.text },
                  isSmallDevice && { fontSize: 24, marginVertical: 10 },
                  selectedTransaction.status === 'failed' && { color: '#D32F2F' }
                ]}>
                  {selectedTransaction.status === 'failed' ? 'x' : 
                   selectedTransaction.type === 'deposit' ? '+' : '-'}₦{selectedTransaction.amount.toLocaleString()}
                </Text>

                <View style={[
                  UserWalletStyles.detailsContainer,
                  isDark && { backgroundColor: colors.secondaryBackground },
                  isSmallDevice && { 
                    padding: 10,
                    marginTop: 8,
                    borderRadius: 12
                  }
                ]}>
                  <View style={[
                    UserWalletStyles.detailItem,
                    isSmallDevice && { marginBottom: 8 }
                  ]}>
                    <Text style={[
                      UserWalletStyles.detailLabel,
                      isDark && { color: colors.subtext },
                      isSmallDevice && { fontSize: 12 }
                    ]}>Date & Time</Text>
                    <Text style={[
                      UserWalletStyles.detailValue,
                      isDark && { color: colors.text },
                      isSmallDevice && { fontSize: 13 }
                    ]}>{formatDate(selectedTransaction.created_at)}</Text>
                  </View>

                  <View style={[
                    UserWalletStyles.detailItem,
                    isSmallDevice && { marginBottom: 8 }
                  ]}>
                    <Text style={[
                      UserWalletStyles.detailLabel,
                      isDark && { color: colors.subtext },
                      isSmallDevice && { fontSize: 12 }
                    ]}>Reference Number</Text>
                    <Text style={[
                      UserWalletStyles.detailValue,
                      isDark && { color: colors.text },
                      isSmallDevice && { fontSize: 13 }
                    ]}>#{selectedTransaction.reference}</Text>
                  </View>

                  {selectedTransaction.type === 'deposit' && (
                    <>
                      <View style={[
                        UserWalletStyles.detailItem,
                        isSmallDevice && { marginBottom: 8 }
                      ]}>
                        <Text style={[
                          UserWalletStyles.detailLabel,
                          isDark && { color: colors.subtext },
                          isSmallDevice && { fontSize: 12 }
                        ]}>Payment Method</Text>
                        <Text style={[
                          UserWalletStyles.detailValue,
                          isDark && { color: colors.text },
                          isSmallDevice && { fontSize: 13 }
                        ]}>
                          {selectedTransaction.metadata?.payment_method || 'Paystack'}
                        </Text>
                      </View>
                      {selectedTransaction.metadata?.paystack_response && (
                        <View style={[
                          UserWalletStyles.detailItem,
                          isSmallDevice && { marginBottom: 8 }
                        ]}>
                          <Text style={[
                            UserWalletStyles.detailLabel,
                            isDark && { color: colors.subtext },
                            isSmallDevice && { fontSize: 12 }
                          ]}>Payment Channel</Text>
                          <Text style={[
                            UserWalletStyles.detailValue,
                            isDark && { color: colors.text },
                            isSmallDevice && { fontSize: 13 }
                          ]}>
                            {selectedTransaction.metadata.paystack_response.channel || 'N/A'}
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {selectedTransaction.type === 'payment' && (
                    <>
                      {selectedTransaction.metadata?.provider_name && (
                        <View style={[
                          UserWalletStyles.detailItem,
                          isSmallDevice && { marginBottom: 8 }
                        ]}>
                          <Text style={[
                            UserWalletStyles.detailLabel,
                            isDark && { color: colors.subtext },
                            isSmallDevice && { fontSize: 12 }
                          ]}>Provider Name</Text>
                          <Text style={[
                            UserWalletStyles.detailValue,
                            isDark && { color: colors.text },
                            isSmallDevice && { fontSize: 13 }
                          ]}>
                            {selectedTransaction.metadata.provider_name}
                          </Text>
                        </View>
                      )}
                      {selectedTransaction.metadata?.service && (
                        <View style={[
                          UserWalletStyles.detailItem,
                          isSmallDevice && { marginBottom: 8 }
                        ]}>
                          <Text style={[
                            UserWalletStyles.detailLabel,
                            isDark && { color: colors.subtext },
                            isSmallDevice && { fontSize: 12 }
                          ]}>Service</Text>
                          <Text style={[
                            UserWalletStyles.detailValue,
                            isDark && { color: colors.text },
                            isSmallDevice && { fontSize: 13 }
                          ]}>
                            {selectedTransaction.metadata.service}
                          </Text>
                        </View>
                      )}
                      {selectedTransaction.metadata?.payment_type && (
                        <View style={[
                          UserWalletStyles.detailItem,
                          isSmallDevice && { marginBottom: 8 }
                        ]}>
                          <Text style={[
                            UserWalletStyles.detailLabel,
                            isDark && { color: colors.subtext },
                            isSmallDevice && { fontSize: 12 }
                          ]}>Payment Type</Text>
                          <Text style={[
                            UserWalletStyles.detailValue,
                            isDark && { color: colors.text },
                            isSmallDevice && { fontSize: 13 }
                          ]}>
                            {selectedTransaction.metadata.payment_type.split('_').map((word: string) => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </Text>
                        </View>
                      )}
                      {selectedTransaction.booking_id && (
                        <View style={[
                          UserWalletStyles.detailItem,
                          isSmallDevice && { marginBottom: 8 }
                        ]}>
                          <Text style={[
                            UserWalletStyles.detailLabel,
                            isDark && { color: colors.subtext },
                            isSmallDevice && { fontSize: 12 }
                          ]}>Booking ID</Text>
                          <Text style={[
                            UserWalletStyles.detailValue,
                            isDark && { color: colors.text },
                            isSmallDevice && { fontSize: 13 }
                          ]}>
                            #{selectedTransaction.booking_id}
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {selectedTransaction.type === 'withdrawal' && (
                    <>
                      <View style={[
                        UserWalletStyles.detailItem,
                        isSmallDevice && { marginBottom: 8 }
                      ]}>
                        <Text style={[
                          UserWalletStyles.detailLabel,
                          isDark && { color: colors.subtext },
                          isSmallDevice && { fontSize: 12 }
                        ]}>Bank Name</Text>
                        <Text style={[
                          UserWalletStyles.detailValue,
                          isDark && { color: colors.text },
                          isSmallDevice && { fontSize: 13 }
                        ]}>
                          {selectedTransaction.metadata?.bank_name || 'N/A'}
                        </Text>
                      </View>
                      <View style={[
                        UserWalletStyles.detailItem,
                        isSmallDevice && { marginBottom: 8 }
                      ]}>
                        <Text style={[
                          UserWalletStyles.detailLabel,
                          isDark && { color: colors.subtext },
                          isSmallDevice && { fontSize: 12 }
                        ]}>Account Name</Text>
                        <Text style={[
                          UserWalletStyles.detailValue,
                          isDark && { color: colors.text },
                          isSmallDevice && { fontSize: 13 }
                        ]}>
                          {selectedTransaction.metadata?.account_name || 'N/A'}
                        </Text>
                      </View>
                      <View style={[
                        UserWalletStyles.detailItem,
                        isSmallDevice && { marginBottom: 8 }
                      ]}>
                        <Text style={[
                          UserWalletStyles.detailLabel,
                          isDark && { color: colors.subtext },
                          isSmallDevice && { fontSize: 12 }
                        ]}>Account Number</Text>
                        <Text style={[
                          UserWalletStyles.detailValue,
                          isDark && { color: colors.text },
                          isSmallDevice && { fontSize: 13 }
                        ]}>
                          {selectedTransaction.metadata?.account_number || 'N/A'}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={[
                    UserWalletStyles.detailItem,
                    isSmallDevice && { marginBottom: 8 }
                  ]}>
                    <Text style={[
                      UserWalletStyles.detailLabel,
                      isDark && { color: colors.subtext },
                      isSmallDevice && { fontSize: 12 }
                    ]}>Status</Text>
                    <Text style={[
                      UserWalletStyles.detailValue,
                      { 
                        color: selectedTransaction.status === 'completed' ? 'green' : 
                               selectedTransaction.status === 'failed' ? 'red' : 'orange' 
                      },
                      isSmallDevice && { fontSize: 13 }
                    ]}>
                      {selectedTransaction.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTransactionsList = () => {
    if (!transactions || transactions.length === 0) {
      return (
        <View style={[
          UserWalletStyles.emptyState,
          isDark && { 
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            borderWidth: 1
          }
        ]}>
          <Ionicons name="receipt-outline" size={48} color={isDark ? colors.inactive : "#ccc"} />
          <Text style={[
            UserWalletStyles.emptyTitle,
            isDark && { color: colors.text }
          ]}>No Transactions Yet</Text>
          <Text style={[
            UserWalletStyles.emptyText,
            isDark && { color: colors.subtext }
          ]}>
            Your transaction history will appear here once you make or receive payments
          </Text>
        </View>
      );
    }
    
    return (
      <>
        <View style={[
          UserWalletStyles.transactionsHeader,
          {
            paddingHorizontal: 2,
            marginBottom: 10
          }
        ]}>
          <Text style={[
            UserWalletStyles.transactionsTitle,
            isDark && { color: colors.text },
            isSmallDevice && { fontSize: 16 }
          ]}>Recent Transactions</Text>
          <TouchableOpacity 
            onPress={() => router.push('/transactions/all')}
            style={{
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Text style={[
              UserWalletStyles.seeAllText,
              isSmallDevice && { fontSize: 14 }
            ]}>See All</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.tint} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        <View style={[
          UserWalletStyles.transactionsList,
          { paddingHorizontal: 2 }  // Add slight padding for the shadow to be visible
        ]}>
          {transactions.map((transaction) => (
            <MemoizedTransactionItem
              key={transaction.id}
              transaction={transaction}
              onPress={() => handleTransactionPress(transaction)}
              isDark={isDark}
              colors={colors}
              isSmallDevice={isSmallDevice}
            />
          ))}
        </View>
      </>
    );
  };

  // Handle drawer menu item press
  const handleItemPress = (itemKey: string) => {
    setIsDrawerOpen(false);
    
    switch (itemKey) {
      case "Home":
        router.push('/(tabs)');
        break;
      case "Services":
        router.push('/(tabs)/services');
        break;
      case "Notifications":
        router.push('/notifications');
        break;
      case "Transactions history":
        router.push('/transactions/all');
        break;
      case "Edit Profile":
        router.push('/(tabs)/profile');
        break;
      default:
        break;
    }
  };

  // Toggle drawer
  const handleMenuPress = () => {
    setIsDrawerOpen(!isDrawerOpen);
    // If an external onMenuPress handler is provided, call it too
    if (onMenuPress) {
      onMenuPress();
    }
  };

  // Format service name nicely
  const formatServiceName = (service: string) => {
    if (!service) return '';
    
    // Check if it's a multi-service string (assuming services might be comma or semicolon separated)
    let services: string[] = [];
    
    if (service.includes(',')) {
      services = service.split(',').map(s => s.trim()).filter(Boolean);
    } else if (service.includes(';')) {
      services = service.split(';').map(s => s.trim()).filter(Boolean);
    } else if (service.includes('|')) {
      services = service.split('|').map(s => s.trim()).filter(Boolean);
    } else {
      // It's a single service
      // If the service is already a clean name, return it
      if (service.length < 30 && !service.includes('-') && !service.includes('_')) {
        return service;
      }
      
      // Otherwise, format it nicely
      return service
        .split('-').join('-')  // Replace hyphens with spaces
        .split('_').join('-')  // Replace underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // We have multiple services
    if (services.length <= 3) {
      // Display all services if there are 3 or fewer
      return services
        .map(svc => {
          // Format each service nicely
          if (svc.length < 30 && !svc.includes('-') && !svc.includes('_')) {
            return svc;
          }
          
          return svc
            .split('-').join('-')
            .split('_').join('-')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        })
        .join(', ');
    } else {
      // Display first 3 services + the count of remaining ones
      const displayedServices = services.slice(0, 3).map(svc => {
        // Format each service nicely
        if (svc.length < 30 && !svc.includes('-') && !svc.includes('_')) {
          return svc;
        }
        
        return svc
          .split('-').join('-')
          .split('_').join('-')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      });
      
      const remainingCount = services.length - 3;
      return `${displayedServices.join(', ')} +${remainingCount}`;
    }
  };

  // Add the Payroll Section (updated to use pending booking payments)
  const renderPayrollSection = () => {
    if (pendingBookingPayments.length === 0) {
      return null;
    }

    const shouldScroll = pendingBookingPayments.length > 2;

    return (
      <View style={[
        UserWalletStyles.payrollContainer,
        isDark && {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border
        },
        isSmallDevice && { 
          marginHorizontal: 12,
          padding: 12,
        },
        shouldScroll && {
          maxHeight: isSmallDevice ? 270 : 300,
        }
      ]}>
        <View style={UserWalletStyles.pallroll}>
          <Text style={[
            UserWalletStyles.payrollTitle,
            isDark && { color: colors.text }
          ]}>Your Payroll:</Text>
          <Text style={[
            UserWalletStyles.payrollServers,
            isDark && { color: colors.subtext }
          ]}>{pendingBookingPayments.length} provider{pendingBookingPayments.length > 1 ? 's' : ''} waiting</Text>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={shouldScroll}
          nestedScrollEnabled={true}
          style={shouldScroll ? { maxHeight: isSmallDevice ? 200 : 230 } : undefined}
        >
          {pendingBookingPayments.map((payment, index) => (
            <View 
              key={payment.id} 
              style={[
                UserWalletStyles.payrollDetails,
                // Remove bottom border for last item
                index === pendingBookingPayments.length - 1 && { 
                  borderBottomWidth: 0,
                  marginBottom: 0
                }
              ]}
            >
              <View style={{ width: 30 }}>
                <Ionicons name="person-circle" size={30} color={Colors.primary} />
              </View>
              <View style={UserWalletStyles.payrollTextContainer}>
                <Text style={[
                  UserWalletStyles.payrollName,
                  isDark && { color: colors.text }
                ]}>{payment.provider.users.name}</Text>
                <Text style={UserWalletStyles.payrollAmount}>
                  ₦{payment.amount.toLocaleString()} • Due {formatBookingDate(payment.booking_date)}
                </Text>
                <Text style={[
                  UserWalletStyles.payrollService,
                  isDark && { color: colors.subtext }
                ]}>
                  {formatServiceName(payment.service)}
                </Text>
              </View>
              <TouchableOpacity 
                style={UserWalletStyles.payNowButton}
                onPress={() => handlePayBooking(payment.id)}
              >
                <Text style={UserWalletStyles.payNowText}>Pay Now</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <ScrollView 
        style={[
          UserWalletStyles.container,
          isDark && { backgroundColor: colors.secondaryBackground }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={isDark ? colors.tint : Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header with responsive sizing */}
        <View style={[
          UserWalletStyles.headerContainer,
          isSmallDevice && { paddingVertical: 12 }
        ]}>
          <View style={UserWalletStyles.imageUploadContainer}>
            <Image
              source={{
                uri: profile?.profile_pic || 'https://via.placeholder.com/50',
              }}
              style={[
                UserWalletStyles.profileImage,
                isSmallDevice && { width: 40, height: 40 }
              ]}
            />
            <Text style={[
              UserWalletStyles.greeting,
              isDark && { color: colors.text },
              isSmallDevice && { fontSize: 16, marginLeft: 10 }
            ]}>Hi, {profile?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={handleMenuPress}>
            <Ionicons name="menu" size={24} color={isDark ? colors.text : "black"} />
          </TouchableOpacity>
        </View>

        {/* Balance Card with responsive sizing */}
        <ImageBackground
          source={require('../../assets/images/Mask group.png')}
          style={[
            UserWalletStyles.balanceCard,
            isSmallDevice && { paddingVertical: 20 },
            {
              // Add enhanced elevation for a premium look
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 10,
              // Add a subtle border for better definition
              borderWidth: isDark ? 0.5 : 0,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
              // Add slight transform for a more dynamic appearance
              transform: [{ perspective: 1000 }]
            }
          ]}
          imageStyle={[
            UserWalletStyles.backgroundImageStyle,
            // Enhance the background image style for better effect
            { borderRadius: 20 }
          ]}
        >
          <Text style={[
            UserWalletStyles.balanceTitle,
            isSmallDevice && { fontSize: 14 }
          ]}>Available Balance</Text>
          <Text style={[
            UserWalletStyles.balanceAmount,
            isSmallDevice && { fontSize: 28, marginTop: 6, marginBottom: 16 }
          ]}>₦{balance.toLocaleString()}.05</Text>
          <View style={UserWalletStyles.actionButtons}>
            <Animated.View style={{ transform: [{ scale: depositScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  UserWalletStyles.actionButton, 
                  UserWalletStyles.depositButton,
                  isSmallDevice && { paddingVertical: 8, paddingHorizontal: 16 }
                ]}
                onPress={handleDeposit}
                disabled={loadingDeposit}
                onPressIn={() => handlePressIn(depositScaleAnim, setLoadingDeposit)}
                onPressOut={() => handlePressOut(depositScaleAnim, setLoadingDeposit)}
              >
                {loadingDeposit ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle-outline" size={isSmallDevice ? 20 : 24} color="white" />
                    <Text style={[
                      UserWalletStyles.actionButtonText,
                      isSmallDevice && { fontSize: 14, marginLeft: 6 }
                    ]}>Deposit</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: withdrawScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  UserWalletStyles.actionButton, 
                  UserWalletStyles.withdrawButton,
                  isSmallDevice && { paddingVertical: 8, paddingHorizontal: 16 }
                ]}
                onPress={handleWithdrawPress}
                disabled={loadingWithdraw}
                onPressIn={() => handlePressIn(withdrawScaleAnim, setLoadingWithdraw)}
                onPressOut={() => handlePressOut(withdrawScaleAnim, setLoadingWithdraw)}
              >
                {loadingWithdraw ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle-outline" size={isSmallDevice ? 20 : 24} color="white" />
                    <Text style={[
                      UserWalletStyles.actionButtonText,
                      isSmallDevice && { fontSize: 14, marginLeft: 6 }
                    ]}>Withdraw</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ImageBackground>

        {/* Payroll Section - Now using pending booking payments */}
        {renderPayrollSection()}

        {/* Transactions Section with improved styling */}
        <View style={[
          UserWalletStyles.transactionsContainer,
          isSmallDevice && { paddingHorizontal: 12 },
          { 
            marginTop: 20,
            marginBottom: 40,  // Add more space at the bottom
            borderRadius: 16, 
            overflow: 'hidden' 
          }
        ]}>
          {renderTransactionsList()}
        </View>
      </ScrollView>

      {renderTransactionModal()}

      {/* Drawer Modal */}
      <DrawerModal
        isVisible={isDrawerOpen}
        onClose={handleMenuPress}
        items={[
          { key: "Home", icon: "home", route: "/(tabs)" },
          { key: "Services", icon: "list", route: "/(tabs)/services" },
          { key: "Notifications", icon: "notifications", route: "/notifications" },
          { key: "Transactions history", icon: "cash", route: "/transactions/all" },
          { key: "Create new request", icon: "add-circle", route: "/(tabs)/services" },
          { key: "Edit Profile", icon: "person", route: "/(tabs)/profile" },
        ]}
        profileImageUri={profile?.profile_pic}
        onItemPress={handleItemPress}
        showLogout={true}
        role='user'
      />
    </>
  );
}
