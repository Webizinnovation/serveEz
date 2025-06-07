import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground,
  FlatList,
  Image,
  Alert,
  Modal,
  Easing,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Wallet } from '../../types';
import { WalletTransaction } from '../../types/wallet';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';
import DrawerModal from '../common/DrawerModal';
import Toast from 'react-native-toast-message';
import { useTheme } from '../ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  scheduleLocalNotification,
  sendWithdrawalSuccessNotification
} from '../../services/pushNotifications';

export function ProviderWallet() {
  const { profile } = useUserStore();
  const router = useRouter();
  const { isDark, colors } = useTheme();


  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState<number>(Date.now());
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const channelRef = useRef<any>(null);

  const withdrawScaleAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim = React.useRef(new Animated.Value(0)).current;

  // Create rotation interpolate for the spin effect
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const fetchWalletData = useCallback(async () => {
    if (!profile?.id) return;
    
    setRefreshing(true);

    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (walletData) {
        setWallet(walletData);
      }

      await fetchTransactions();
      
      setLastTransactionTimestamp(Date.now());
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setRefreshing(false);
    }
  }, [profile?.id]);


  const filterTransactions = (transactions: WalletTransaction[], tab: string) => {
    if (!transactions) return [];
    
    switch (tab) {
      case 'all':
        return transactions;
      case 'earnings':
        return transactions.filter(t => t.type === 'payment' || t.type === 'booking_payment');
      case 'withdrawals':
        return transactions.filter(t => t.type === 'withdrawal');
      default:
        return transactions;
    }
  };

  const fetchTransactions = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (providerError) throw providerError;

      if (!providerData?.id) {
        console.error('No provider found for user');
        return;
      }

      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`provider_id.eq.${providerData.id},and(user_id.eq.${profile.id},type.eq.withdrawal)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (transactionsData) {
        setTransactions(transactionsData);
        setFilteredTransactions(filterTransactions(transactionsData, selectedTab));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to load transaction data');
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  useEffect(() => {
    if (transactions.length > 0) {
      setFilteredTransactions(filterTransactions(transactions, selectedTab));
    }
  }, [selectedTab, transactions]);

  useEffect(() => {
    if (!profile?.id) return;

    const setupSubscription = async () => {
      const { data: providerData } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (!providerData?.id) return;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel('wallet_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `provider_id=eq.${providerData.id}`,
          },
          async (payload: any) => {
            console.log('New transaction:', payload);
            
            await fetchWalletData();
            
            // Display Toast notification
            Toast.show({
              type: 'success',
              text1: 'Payment Received',
              text2: `₦${payload.new.amount.toLocaleString()} has been added to your wallet`,
              position: 'top',
              visibilityTime: 4000,
            });
            
            // Send push notification safely using the same pattern we used before
            try {
              // Get additional metadata for better notification content
              const paymentAmount = payload.new.amount;
              const customerName = payload.new.metadata?.user_name || 'A customer';
              const serviceName = payload.new.metadata?.service || 'your service';
              
              // Use setTimeout to prevent UI blocking and delay slightly to avoid crashes
              setTimeout(() => {
                scheduleLocalNotification(
                  'Payment Received! 💰',
                  `${customerName} paid ₦${paymentAmount.toLocaleString()} for ${serviceName}. Your wallet has been credited.`,
                  { 
                    type: 'provider_payment_received', 
                    amount: paymentAmount,
                    customer: customerName,
                    service: serviceName,
                    transactionId: payload.new.id
                  }
                ).catch(err => console.error('Error scheduling payment notification:', err));
              }, 300);
            } catch (error) {
              console.error('Error sending payment received notification:', error);
              // Fail silently - don't let notification errors crash the app
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
      
      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
      };
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [profile?.id]);

  useEffect(() => {
    // Create a continuous floating animation
    const startFloatingAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          })
        ])
      ).start();
    };
    
    startFloatingAnimation();
    
    return () => {
      floatAnim.stopAnimation();
    };
  }, []);

  const handleWithdrawPress = () => {
    if (!wallet?.balance || wallet.balance <= 0 || isWithdrawLoading) return; 
    
    // Set loading state to true to show spinner
    setIsWithdrawLoading(true);
    
    // Wait a moment before navigating to show the spinner
    setTimeout(() => {
      try {
        // Set a flag to indicate this is a provider withdrawal
        // This will be useful in the withdraw.tsx page to differentiate between user and provider withdrawals
        AsyncStorage.setItem('withdrawalContext', 'provider');
        
        // Navigate to withdraw pin screen
        router.push('/payment/withdraw-pin');
        
        // Reset loading state after a brief delay to ensure smooth transition
        setTimeout(() => {
          setIsWithdrawLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error navigating to withdrawal screen:', error);
        setIsWithdrawLoading(false);
        
        // Show error toast if navigation fails
        Toast.show({
          type: 'error',
          text1: 'Navigation Error',
          text2: 'Could not open the withdrawal screen. Please try again.',
          position: 'top',
        });
      }
    }, 1000);
  };

  const handlePressIn = () => {
    Animated.spring(withdrawScaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(withdrawScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleMenuPress = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const handleItemPress = (itemKey: string) => {
    setIsDrawerOpen(false);
    if (itemKey === 'Switch to User Account') {
    } else if (itemKey === 'Transactions history') {
      router.push('/transactions');
    }
  };

  const todayEarnings = transactions
    .filter(t => 
      (t.type === 'payment' || t.type === 'booking_payment') && 
      new Date(t.created_at).toDateString() === new Date().toDateString()
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const monthEarnings = transactions
    .filter(t => 
      (t.type === 'payment' || t.type === 'booking_payment') && 
      new Date(t.created_at).getMonth() === new Date().getMonth()
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const handleTransactionPress = (transaction: WalletTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  };

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

  const renderTransaction = ({ item: transaction }: { item: WalletTransaction }) => {
    const getTransactionTypeDisplay = () => {
      switch (transaction.type) {
        case 'payment':
        case 'booking_payment':
          return `Payment from ${transaction.metadata?.user_name || 'Customer'}`;
        case 'withdrawal':
          return `Withdrawal to ${transaction.metadata?.account_name || 'Bank'}`;
        default:
          return transaction.type;
      }
    };

    const isIncomingPayment = transaction.type === 'payment' || transaction.type === 'booking_payment';

    return (
      <TouchableOpacity 
        key={transaction.id} 
        style={[
          styles.transactionItem, 
          isDark && { 
            backgroundColor: colors.cardBackground, 
            shadowColor: 'transparent',
            borderColor: '#333',
            borderWidth: 1
          }
        ]}
        onPress={() => {
          setSelectedTransaction(transaction);
          setShowTransactionModal(true);
        }}
      >
        <Ionicons 
          name={isIncomingPayment ? 'arrow-down' : 'arrow-up'} 
          size={20} 
          color={isIncomingPayment ? 'green' : 'red'} 
        />
        <View style={styles.transactionDetails}>
          <Text style={[styles.transactionName, isDark && { color: colors.text }]}>
            {getTransactionTypeDisplay()}
          </Text>
          <Text style={[styles.transactionDate, isDark && { color: '#aaa' }]}>
            {new Date(transaction.created_at).toLocaleDateString()}
          </Text>
          {transaction.type === 'withdrawal' ? (
            <Text style={[styles.bookingReference, isDark && { color: isDark ? '#ff6b6b' : '#FF4B55' }]}>
              Ref: #{transaction.reference || 'N/A'}
            </Text>
          ) : (
            transaction.metadata?.user_name && (
              <Text style={[styles.bookingReference, isDark && { color: isDark ? '#00aaff' : '#0066CC' }]}>
                Customer: {transaction.metadata.user_name}
              </Text>
            )
          )}
        </View>
        <Text style={[
          styles.transactionAmount,
          isIncomingPayment ? styles.earning : styles.withdrawal,
          isDark && { 
            color: isIncomingPayment ? '#4CAF50' : '#ff6b6b' 
          }
        ]}>
          {isIncomingPayment ? '+' : '-'}₦{transaction.amount.toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTransactionModal = () => {
    if (!selectedTransaction) return null;

    const isIncomingPayment = selectedTransaction.type === 'payment' || selectedTransaction.type === 'booking_payment';

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTransactionModal}
        onRequestClose={() => setShowTransactionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent, 
            isDark && { 
              backgroundColor: colors.cardBackground,
              borderTopColor: '#333',
              borderTopWidth: 1 
            }
          ]}>
            <View style={[
              styles.modalHeader, 
              isDark && { borderBottomColor: '#333' }
            ]}>
              <Text style={[
                styles.modalTitle, 
                isDark && { color: colors.text }
              ]}>Transaction Details</Text>
              <TouchableOpacity 
                onPress={() => setShowTransactionModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={isDark ? "#fff" : "#333"} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Ionicons 
                  name={isIncomingPayment ? 'arrow-down-circle' : 'arrow-up-circle'} 
                  size={40} 
                  color={isIncomingPayment ? 'green' : 'red'} 
                  style={styles.modalIcon}
                />
                <Text style={[
                  styles.transactionType, 
                  isDark && { color: colors.text }
                ]}>
                  {isIncomingPayment ? 'Payment Received' : 'Withdrawal'}
                </Text>
              </View>

              <Text style={[styles.amountLarge, { color: isIncomingPayment ? 'green' : 'red' }]}>
                {isIncomingPayment ? '+' : '-'}₦{selectedTransaction.amount.toLocaleString()}
              </Text>

              <View style={[
                styles.detailsContainer, 
                isDark && { 
                  backgroundColor: '#262626', 
                  borderColor: '#444',
                  borderWidth: 1
                }
              ]}>
                <View style={styles.detailItem}>
                  <Text style={[
                    styles.detailLabel, 
                    isDark && { color: '#aaa' }
                  ]}>Date & Time</Text>
                  <Text style={[
                    styles.detailValue, 
                    isDark && { color: colors.text }
                  ]}>
                    {new Date(selectedTransaction.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={[
                    styles.detailLabel,
                    isDark && { color: '#aaa' }
                  ]}>Reference Number</Text>
                  <Text style={[
                    styles.detailValue,
                    isDark && { color: colors.text }
                  ]}>#{selectedTransaction.reference || selectedTransaction.id}</Text>
                </View>

                {isIncomingPayment ? (
                  <>
                    <View style={styles.detailItem}>
                      <Text style={[
                        styles.detailLabel,
                        isDark && { color: '#aaa' }
                      ]}>Customer Name</Text>
                      <Text style={[
                        styles.detailValue,
                        isDark && { color: colors.text }
                      ]}>
                        {selectedTransaction.metadata?.user_name || 'N/A'}
                      </Text>
                    </View>
                    {selectedTransaction.metadata?.booking_id && (
                      <View style={styles.detailItem}>
                        <Text style={[
                          styles.detailLabel,
                          isDark && { color: '#aaa' }
                        ]}>Booking ID</Text>
                        <Text style={[
                          styles.detailValue,
                          isDark && { color: colors.text }
                        ]}>
                          #{selectedTransaction.metadata.booking_id}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.service && (
                      <View style={styles.detailItem}>
                        <Text style={[
                          styles.detailLabel,
                          isDark && { color: '#aaa' }
                        ]}>Service</Text>
                        <Text style={[
                          styles.detailValue,
                          isDark && { color: colors.text }
                        ]}>
                          {selectedTransaction.metadata.service}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.payment_type && (
                      <View style={styles.detailItem}>
                        <Text style={[
                          styles.detailLabel,
                          isDark && { color: '#aaa' }
                        ]}>Payment Type</Text>
                        <Text style={[
                          styles.detailValue,
                          isDark && { color: colors.text }
                        ]}>
                          {selectedTransaction.metadata.payment_type.split('_').map(
                            word => word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.detailItem}>
                      <Text style={[
                        styles.detailLabel,
                        isDark && { color: '#aaa' }
                      ]}>Account Name</Text>
                      <Text style={[
                        styles.detailValue,
                        isDark && { color: colors.text }
                      ]}>
                        {selectedTransaction.metadata?.account_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={[
                        styles.detailLabel,
                        isDark && { color: '#aaa' }
                      ]}>Bank Name</Text>
                      <Text style={[
                        styles.detailValue,
                        isDark && { color: colors.text }
                      ]}>
                        {selectedTransaction.metadata?.bank_name || 'N/A'}
                      </Text>
                    </View>
                  </>
                )}

                <View style={styles.detailItem}>
                  <Text style={[
                    styles.detailLabel,
                    isDark && { color: '#aaa' }
                  ]}>Status</Text>
                  <Text style={[
                    styles.detailValue,
                    { 
                      color: selectedTransaction.status === 'completed' ? 'green' : 
                             selectedTransaction.status === 'failed' ? 'red' : 'orange' 
                    }
                  ]}>
                    {selectedTransaction.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderHeader = () => {
    return (
      <View>
        {/* Header with profile info */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/40' }}
              style={styles.profilePic}
            />
            <Text style={[styles.greeting, isDark && { color: colors.text }]}>Hi, {profile?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleMenuPress}>
            <Ionicons name="menu-outline" size={24} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>
        </View>
        
        {/* Balance Card with floating animation */}
        <Animated.View style={[
          styles.balanceCardContainer,
          {
            transform: [
              { translateY: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8]
              })}
            ]
          }
        ]}>
          <ImageBackground
            source={require('../../assets/images/Mask group.png')}
            style={styles.balanceCard}
            imageStyle={styles.backgroundImageStyle}
          >
            <Text style={styles.balanceTitle}>Available Balance</Text>
            <Text style={styles.balanceAmount}>₦{wallet?.balance?.toLocaleString() || '0.00'}</Text>
            <View style={styles.buttonRow}>
              <Animated.View style={{ 
                transform: [
                  { scale: withdrawScaleAnim },
                  { rotate: spin }
                ] 
              }}>
                <TouchableOpacity
                  style={[
                    styles.withdrawButton,
                    isWithdrawLoading && { opacity: 0.8 }
                  ]}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={handleWithdrawPress}
                  disabled={isWithdrawLoading}
                  activeOpacity={0.8}
                >
                  {isWithdrawLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.buttonText, { marginLeft: 8 }]}>Processing...</Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="arrow-up-circle" size={20} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.buttonText}>Withdraw to Bank</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </ImageBackground>
        </Animated.View>

        {/* Stats Card */}
        <View style={[
          styles.statsCard, 
          isDark && { 
            backgroundColor: colors.cardBackground,
            borderColor: '#333',
            borderWidth: 1,
            elevation: 0
          }
        ]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, isDark && { color: '#aaa' }]}>Today's Earnings</Text>
              <Text style={[styles.statAmount, isDark && { color: colors.text }]}>₦{todayEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, isDark && { color: '#aaa' }]}>This Month</Text>
              <Text style={[styles.statAmount, isDark && { color: colors.text }]}>₦{monthEarnings.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          {['all', 'earnings', 'withdrawals'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab, 
                selectedTab === tab && styles.activeTab,
                isDark && selectedTab !== tab && { backgroundColor: 'transparent' }
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[
                styles.tabText, 
                selectedTab === tab && styles.activeTabText,
                isDark && { color: selectedTab === tab ? '#FFFFFF' : '#aaa' }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions Header */}
        <View style={styles.transactionsHeader}>
          <Text style={[styles.transactionsTitle, isDark && { color: colors.text }]}>Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/transactions/all')}>
            <Text style={[styles.seeAllText, isDark && { color: isDark ? '#00aaff' : '#0066CC' }]}>See All</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[
      styles.container, 
      isDark && { backgroundColor: colors.secondaryBackground }
    ]}>
      <FlatList
        style={styles.flatList}
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        onRefresh={fetchWalletData}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color={isDark ? "#444" : "#ccc"} />
            <Text style={[styles.emptyTitle, isDark && { color: colors.text }]}>No Transactions</Text>
            <Text style={[styles.emptyText, isDark && { color: '#aaa' }]}>
              {selectedTab === 'earnings' 
                ? 'You haven\'t received any payments yet'
                : selectedTab === 'withdrawals'
                ? 'You haven\'t made any withdrawals yet'
                : 'Your transaction history will appear here'}
            </Text>
          </View>
        }
      />

      {renderTransactionModal()}
      <Toast />
      
      <DrawerModal
        isVisible={isDrawerOpen}
        onClose={handleMenuPress}
        items={[
          { key: "Home" },
          { key: "Bookings" },
          { key: "Notifications" },
          { key: "Transactions history" },
          { key: "Switch to User Account", color: "orange" },
          { key: "Edit Profile" },
          { key: "Settings" },
          { key: "Help" },
        ]}
        profileImageUri={profile?.profile_pic}
        onItemPress={handleItemPress}
        role='provider'
      />
    </View>
  );
}

const styles = ScaledSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9f9f9',
    paddingTop: '16@ms',
  },
  flatList: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: '16@ms',
    paddingBottom: '16@ms',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: '16@ms',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePic: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    marginRight: '12@ms',
  },
  greeting: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  balanceCard: {
    width: 'auto',
    height: '210@ms',
    backgroundColor: '#263238',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '16@ms',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    transform: [{ translateY: -4 }],
  },
  backgroundImageStyle: {
    borderRadius: '16@ms',
  },
  balanceTitle: {
    color: '#A9BCCF',
    fontSize: '14.56@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: '44@ms',
    fontFamily: 'Urbanist-Regular',
    marginVertical: '8@ms',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingVertical: '40@ms',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: '12@ms',
    paddingHorizontal: '25@ms',
    borderRadius: '8@ms',
    width: '180@ms',
    height: '45@ms',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: '8@ms',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '18@ms',
    marginBottom: '16@ms',
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  statAmount: {
    fontSize: '24@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
    marginTop: '4@ms',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: '16@ms',
  },
  tab: {
    flex: 1,
    paddingVertical: '8@ms',
    alignItems: 'center',
    borderRadius: '8@ms',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  transactionsTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: '12@ms',
    color: Colors.primary,
    fontFamily: 'Urbanist-SemiBold',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '12@ms',
    marginBottom: '8@ms',
    elevation: 3,
  },
  transactionDetails: {
    flex: 1,
    marginLeft: '12@ms',
  },
  transactionName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  transactionDate: {
    fontSize: '12@ms',
    color: '#777',
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@ms',
  },
  transactionAmount: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
  },
  withdrawal: {
    color: '#dc3545',
  },
  earning: {
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32@ms',
  },
  emptyTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '16@ms',
  },
  emptyText: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    marginTop: '8@ms',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  bookingReference: {
    fontSize: '12@ms',
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@ms',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: '20@ms',
    borderTopRightRadius: '20@ms',
    padding: '16@ms',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  closeButton: {
    padding: '4@ms',
  },
  modalBody: {
    paddingVertical: '16@ms',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@ms',
  },
  modalIcon: {
    marginRight: '12@ms',
  },
  transactionType: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  amountLarge: {
    fontSize: '32@ms',
    fontFamily: 'Urbanist-Bold',
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
  detailLabel: {
    fontSize: '12@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  detailValue: {
    fontSize: '14@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCardContainer: {
    marginTop: '10@ms',
    marginBottom: '8@ms',
  },
});