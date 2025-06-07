import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Animated,
  Easing,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { TextInput } from 'react-native-paper';
import { useUserStore } from '../../store/useUserStore';
import { validateBankAccount, createTransferRecipient, initiateTransfer, verifyTransfer } from '../../services/bank';
import { logTransactionError, updateTransactionStatus } from '../../utils/errorHandling';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../../assets/images/Svg/logo2svg.svg';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../components/ThemeProvider';
import { 
  sendWithdrawalSuccessNotification, 
  sendTransactionFailedNotification,
  sendTransactionPendingNotification,
  scheduleLocalNotification
} from '../../services/pushNotifications';

interface Bank {
  id: string;
  name: string;
  code: string;
  logo: string;
}

const NIGERIAN_BANKS: Bank[] = [
  { 
    id: '1', 
    name: 'Access Bank', 
    code: '044',
    logo: 'https://nigerianbanks.xyz/logo/access-bank.png',
  },
  { 
    id: '2', 
    name: 'GTBank', 
    code: '058',
    logo: 'https://nigerianbanks.xyz/logo/guaranty-trust-bank.png',
  },
  { 
    id: '3', 
    name: 'First Bank', 
    code: '011',
    logo: 'https://nigerianbanks.xyz/logo/first-bank-of-nigeria.png',
  },
  { 
    id: '4', 
    name: 'UBA', 
    code: '033',
    logo: 'https://nigerianbanks.xyz/logo/united-bank-for-africa.png',
  },
  { 
    id: '5', 
    name: 'Zenith Bank', 
    code: '057',
    logo: 'https://nigerianbanks.xyz/logo/zenith-bank.png',
  },
  {
    id: '6',
    name: 'OPay',
    code: '999992',
    logo: 'https://nigerianbanks.xyz/logo/paycom.png',
  },
  {
    id: '7',
    name: "PalmPay",
    code: "999991",
    logo: "https://nigerianbanks.xyz/logo/palmpay.png"
  },
  {
    id: '8',
    name: "Moniepoint MFB",
    code: "50515",
    logo: "https://nigerianbanks.xyz/logo/moniepoint-mfb-ng.png"
  },
  {
    id: '9',
    name: "Fidelity Bank",
    code: "070",
    logo: "https://nigerianbanks.xyz/logo/fidelity-bank.png"
  },
  {
    id: '10',
    name: "Keystone Bank",
    code: "082",
    logo: "https://nigerianbanks.xyz/logo/keystone-bank.png"
  },
  {
    id: '11',
    name: "Access Bank (Diamond)",
    code: "063",
    logo: "https://nigerianbanks.xyz/logo/access-bank-diamond.png"
  },
  {
    id: '12',
    name: "ALAT by WEMA",
    code: "035A",
    logo: "https://nigerianbanks.xyz/logo/alat-by-wema.png"
  },
  {
    id: '13',
    name: "ASO Savings and Loans",
    code: "401",
    logo: "https://nigerianbanks.xyz/logo/asosavings.png"
  },
  {
    id: '14',
    name: "Bowen Microfinance Bank",
    code: "50931",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '15',
    name: "CEMCS Microfinance Bank",
    code: "50823",
    logo: "https://nigerianbanks.xyz/logo/cemcs-microfinance-bank.png"
  },
  {
    id: '16',
    name: "Citibank Nigeria",
    code: "023",
    logo: "https://nigerianbanks.xyz/logo/citibank-nigeria.png"
  },
  {
    id: '17',
    name: "Ecobank Nigeria",
    code: "050",
    logo: "https://nigerianbanks.xyz/logo/ecobank-nigeria.png"
  },
  {
    id: '18',
    name: "Ekondo Microfinance Bank",
    code: "562",
    logo: "https://nigerianbanks.xyz/logo/ekondo-microfinance-bank.png"
  },
  {
    id: '19',
    name: "Heritage Bank",
    code: "030",
    logo: "https://nigerianbanks.xyz/logo/heritage-bank.png"
  },
  {
    id: '20',
    name: "Jaiz Bank",
    code: "301",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '21',
    name: "Parallex Bank",
    code: "526",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '23',
    name: "Polaris Bank",
    code: "076",
    logo: "https://nigerianbanks.xyz/logo/polaris-bank.png"
  },
  {
    id: '24',
    name: "Providus Bank",
    code: "101",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '25',
    name: "Rubies MFB",
    code: "125",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '26',
    name: "Sparkle Microfinance Bank",
    code: "51310",
    logo: "https://nigerianbanks.xyz/logo/sparkle-microfinance-bank.png"
  },
  {
    id: '27',
    name: "Stanbic IBTC Bank",
    code: "221",
    logo: "https://nigerianbanks.xyz/logo/stanbic-ibtc-bank.png"
  },
  {
    id: '28',
    name: "Standard Chartered Bank",
    code: "068",
    logo: "https://nigerianbanks.xyz/logo/standard-chartered-bank.png"
  },
  {
    id: '29',
    name: "Sterling Bank",
    code: "232",
    logo: "https://nigerianbanks.xyz/logo/sterling-bank.png"
  },
  {
    id: '30',
    name: "Suntrust Bank",
    code: "100",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '31',
    name: "TAJ Bank",
    code: "302",
    logo: "https://nigerianbanks.xyz/logo/taj-bank.png"
  },
  {
    id: '32',
    name: "TCF MFB",
    code: "51211",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '33',
    name: "Titan Trust Bank",
    code: "102",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '34',
    name: "Union Bank of Nigeria",
    code: "032",
    logo: "https://nigerianbanks.xyz/logo/union-bank-of-nigeria.png"
  },
  {
    id: '35',
    name: "Unity Bank",
    code: "215",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '36',
    name: "VFD",
    code: "566",
    logo: "https://nigerianbanks.xyz/logo/default-image.png"
  },
  {
    id: '37',
    name: "Wema Bank",
    code: "035",
    logo: "https://nigerianbanks.xyz/logo/wema-bank.png"
  },
];

export default function WithdrawScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, refreshProfile } = useUserStore();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountName, setAccountName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [pinnedAccess, setPinnedAccess] = useState(false);
  const { isDark, colors } = useTheme();
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>(
    [...NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name))
  );
  // Track whether this is a provider withdrawal
  const [isProviderWithdrawal, setIsProviderWithdrawal] = useState(false);
  
  const fadeValue = React.useRef(new Animated.Value(0.4)).current;
  
  React.useEffect(() => {
    if (withdrawing) {
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
  }, [withdrawing]);
  
  useEffect(() => {
    // Check if this is a provider withdrawal
    const checkWithdrawalContext = async () => {
      try {
        const context = await AsyncStorage.getItem('withdrawalContext');
        setIsProviderWithdrawal(context === 'provider');
        // Clear the context after reading it to avoid affecting future withdrawals
        if (context) {
          await AsyncStorage.removeItem('withdrawalContext');
        }
      } catch (error) {
        console.error('Error checking withdrawal context:', error);
      }
    };
    
    checkWithdrawalContext();

    if (params.verified === 'true') {
      setPinnedAccess(true);
    } else if (params.amount) {
      router.replace({
        pathname: '/payment/withdraw-pin',
        params: { amount: params.amount }
      });
    }
    
    if (params.amount) {
      setWithdrawAmount(params.amount as string);
    }
    fetchWallet();
  }, [params]);

  const fetchWallet = async () => {
    if (!profile?.id) return;

    try {
      const { data: walletData, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setWallet(walletData);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const validateAccountNumber = async (accNumber: string) => {
    if (accNumber.length === 10 && selectedBank) {
      setIsValidating(true);
      try {
        const response = await validateBankAccount(accNumber, selectedBank.code);
        if (response.status && response.data) {
          setAccountName(response.data.account_name);
        } else {
          Alert.alert('Validation Error', response.message);
          setAccountName('');
        }
      } catch (error) {
        console.error('Error validating account:', error);
        Alert.alert('Error', 'Failed to validate account number');
        setAccountName('');
      } finally {
        setIsValidating(false);
      }
    }
  };

  const verifyTransferStatus = async (reference: string, transactionId: string) => {
    try {
      const verificationResponse = await verifyTransfer(reference);
      
      if (!verificationResponse.status || !verificationResponse.data) {
        throw new Error('Transfer verification failed');
      }

      const transferStatus = verificationResponse.data.status;
      const transactionStatus = 
        transferStatus === 'success' ? 'completed' :
        transferStatus === 'failed' ? 'failed' :
        transferStatus === 'reversed' ? 'failed' : 'processing';

      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', transactionId)
        .single();

      await supabase
        .from('transactions')
        .update({
          status: transactionStatus,
          metadata: {
            ...existingTransaction?.metadata,
            verified_at: new Date().toISOString(),
            transfer_status: transferStatus,
            paystack_response: verificationResponse.data
          }
        })
        .eq('id', transactionId);

      return { status: transactionStatus, response: verificationResponse.data };
    } catch (error) {
      console.error('Error verifying transfer:', error);
      throw error;
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount || Number(withdrawAmount) < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Minimum withdrawal amount is ₦10',
        position: 'bottom'
      });
      return;
    }

    if (!accountNumber || !selectedBank || !accountName) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Details',
        text2: 'Please provide all bank account details',
        position: 'bottom'
      });
      return;
    }

    if (!wallet?.balance || Number(withdrawAmount) > wallet.balance) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: 'You do not have enough balance for this withdrawal',
        position: 'bottom'
      });
      return;
    }

  
    if (!pinnedAccess) {
      router.replace({
        pathname: '/payment/withdraw-pin',
        params: { amount: withdrawAmount }
      });
      return;
    }

    let transactionRecord: any = null;
    const transactionRef = `WD-${Date.now()}`;
    
    try {
      setWithdrawing(true);

      const recipientResponse = await createTransferRecipient(
        accountName,
        accountNumber,
        selectedBank.code
      );

      if (!recipientResponse.status || !recipientResponse.data) {
        throw new Error(recipientResponse.message || 'Failed to create transfer recipient');
      }

      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: profile?.id,
          amount: Number(withdrawAmount),
          type: 'withdrawal',
          status: 'pending',
          sender_type: profile?.role || 'user',
          reference: transactionRef,
          metadata: {
            bank_name: selectedBank.name,
            account_number: accountNumber,
            account_name: accountName,
            recipient_code: recipientResponse.data.recipient_code,
            recipient_response: recipientResponse.data
          }
        })
        .select()
        .single();

      if (transactionError) throw transactionError;
      transactionRecord = transaction;

      const transferResponse = await initiateTransfer(
        Number(withdrawAmount),
        recipientResponse.data.recipient_code,
        transactionRef
      );

      if (!transferResponse.status) {
        throw new Error(transferResponse.message || 'Failed to initiate transfer');
      }

      const { status: transferStatus, response: verificationData } = 
        await verifyTransferStatus(transactionRef, transaction.id);

      if (transferStatus === 'failed') {
        throw new Error('Transfer failed: ' + verificationData.reason);
      }

      if (transferStatus === 'processing') {
        Toast.show({
          type: 'info',
          text1: 'Processing',
          text2: 'Your withdrawal is being processed. This may take a few minutes.',
          position: 'top',
          visibilityTime: 4000
        });
        
        // Send notification safely to prevent issues during unmounting
        try {
          setTimeout(() => {
            // Customize notification based on whether it's a provider or user
            const notificationTitle = isProviderWithdrawal 
              ? 'Provider Withdrawal Processing' 
              : 'Withdrawal Processing';
            
            const notificationBody = isProviderWithdrawal
              ? `Your business withdrawal of ₦${Number(withdrawAmount).toLocaleString()} is being processed.`
              : `Your withdrawal of ₦${Number(withdrawAmount).toLocaleString()} is being processed.`;
            
            // Use the generic scheduleLocalNotification for provider withdrawals for more customization
            if (isProviderWithdrawal) {
              scheduleLocalNotification(
                notificationTitle,
                notificationBody,
                { 
                  type: 'provider_withdrawal_pending',
                  amount: Number(withdrawAmount)
                }
              ).catch((err: Error) => console.error('Error scheduling notification:', err));
            } else {
              // Use the standard function for user withdrawals
              sendTransactionPendingNotification('withdrawal', Number(withdrawAmount))
                .catch((err: Error) => console.error('Error scheduling notification:', err));
            }
          }, 300);
        } catch (error) {
          console.error('Error sending pending notification:', error);
          // Fail silently - don't let notification errors affect the main flow
        }
        
        setTimeout(() => {
          router.back();
        }, 2000);
        return;
      }

      const { error: walletError } = await supabase.rpc('decrease_wallet_balance', {
        amount: Number(withdrawAmount),
        p_user_id: profile?.id
      });

      if (walletError) {
        throw walletError;
      }

      await refreshProfile();
      
      Toast.show({
        type: 'success',
        text1: 'Withdrawal Successful',
        text2: `₦${withdrawAmount} will be credited to your account shortly.`,
        position: 'top',
        visibilityTime: 4000
      });
      
      // Send success notification safely
      try {
        setTimeout(() => {
          if (isProviderWithdrawal) {
            // Use custom notification for providers
            scheduleLocalNotification(
              'Provider Withdrawal Successful',
              `Your business withdrawal of ₦${Number(withdrawAmount).toLocaleString()} to ${selectedBank?.name || 'your bank'} account has been processed.`,
              {
                type: 'provider_withdrawal_success',
                amount: Number(withdrawAmount),
                bankName: selectedBank?.name
              }
            ).catch((err: Error) => console.error('Error scheduling notification:', err));
          } else {
            // Use standard notification for users
            sendWithdrawalSuccessNotification(Number(withdrawAmount), selectedBank?.name)
              .catch((err: Error) => console.error('Error scheduling notification:', err));
          }
        }, 300);
      } catch (error) {
        console.error('Error sending success notification:', error);
        // Fail silently
      }
      
      setTimeout(() => {
        router.back();
      }, 2000);

    } catch (error: any) {
      const errorStage: 'initialization' | 'processing' | 'verification' | 'wallet_update' = 
        (error.message?.includes?.('recipient') ? 'initialization' :
        error.message?.includes?.('transfer') ? 'processing' :
        error.message?.includes?.('wallet') ? 'wallet_update' : 'processing');

      logTransactionError({
        type: 'withdrawal',
        stage: errorStage,
        error,
        details: {
          amount: Number(withdrawAmount),
          reference: transactionRef,
          userId: profile?.id
        }
      });

      if (transactionRecord?.id) {
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transactionRecord.metadata,
              error: {
                stage: errorStage,
                message: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('id', transactionRecord.id);
      }

      Toast.show({
        type: 'error',
        text1: 'Withdrawal Failed',
        text2: error.message || 'Failed to process withdrawal',
        position: 'top'
      });
      
      // Send failure notification safely
      try {
        setTimeout(() => {
          if (isProviderWithdrawal) {
            // Use custom notification for provider withdrawal failures
            scheduleLocalNotification(
              'Provider Withdrawal Failed',
              `Your business withdrawal of ₦${Number(withdrawAmount).toLocaleString()} could not be processed. Reason: ${error.message || 'Failed to process withdrawal'}`,
              {
                type: 'provider_withdrawal_failed',
                amount: Number(withdrawAmount),
                error: error.message || 'Failed to process withdrawal'
              }
            ).catch((err: Error) => console.error('Error scheduling notification:', err));
          } else {
            // Use standard notification for users
            sendTransactionFailedNotification('withdrawal', Number(withdrawAmount), error.message || 'Failed to process withdrawal')
              .catch((err: Error) => console.error('Error scheduling notification:', err));
          }
        }, 300);
      } catch (notifError) {
        console.error('Error sending failure notification:', notifError);
        // Fail silently
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const handleBankSearch = (query: string) => {
    setBankSearchQuery(query);
    if (query.trim() === '') {
      setFilteredBanks([...NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      const filtered = NIGERIAN_BANKS.filter(bank => 
        bank.name.toLowerCase().includes(query.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name));
      setFilteredBanks(filtered);
    }
  };

  const selectBank = (bank: Bank) => {
    setSelectedBank(bank);
    setShowBankSelector(false);
  };

  return (
    <SafeAreaView style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen
        options={{
          title: 'Withdraw Funds',
          headerStyle: {
            backgroundColor: isDark ? colors.cardBackground : '#fff',
          },
          headerTintColor: isDark ? colors.text : '#000',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#000"} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo and Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Logo width={100} height={100} />
            </View>
            
            <Text style={[
              styles.title,
              isDark && { color: colors.text }
            ]}>
              Withdraw to Bank Account
            </Text>
            
            <Text style={[
              styles.subtitle,
              isDark && { color: colors.subtext }
            ]}>
              Safe and secure withdrawals to your bank account
            </Text>
          </View>

          {/* Processing State */}
          {withdrawing ? (
            <View style={[
              styles.processingCard,
              isDark && { backgroundColor: colors.cardBackground }
            ]}>
              <Animated.View style={{ opacity: fadeValue }}>
                <Logo width={70} height={70} />
              </Animated.View>
              <Text style={[
                styles.processingText,
                isDark && { color: colors.text }
              ]}>
                Processing your withdrawal...
              </Text>
              <Text style={[
                styles.processingSubtext,
                isDark && { color: colors.subtext }
              ]}>
                Please wait while we transfer your funds
              </Text>
              
              {/* Cancel button for processing withdrawal */}
              <TouchableOpacity
                style={[
                  styles.cancelWithdrawButton,
                  isDark && { borderColor: colors.border }
                ]}
                onPress={() => {
                  Alert.alert(
                    "Cancel Withdrawal",
                    "Are you sure you want to cancel this withdrawal? This might not stop the transaction if it's already been initiated with the bank.",
                    [
                      { 
                        text: "No, Continue", 
                        style: "cancel" 
                      },
                      { 
                        text: "Yes, Cancel", 
                        style: "destructive",
                        onPress: () => {
                          setWithdrawing(false);
                          Toast.show({
                            type: 'info',
                            text1: 'Withdrawal Cancelled',
                            text2: 'The withdrawal process has been cancelled.',
                            position: 'top',
                          });
                        } 
                      }
                    ]
                  );
                }}
              >
                <Text style={[
                  styles.cancelWithdrawButtonText,
                  isDark && { color: colors.text }
                ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Amount Card */}
              <View style={[
                styles.card,
                isDark && { backgroundColor: colors.cardBackground }
              ]}>
                <Text style={[
                  styles.cardTitle,
                  isDark && { color: colors.text }
                ]}>
                  Withdrawal Amount
                </Text>
                
                <View style={[
                  styles.amountInputContainer,
                  isDark && { borderColor: colors.border }
                ]}>
                  <Text style={[
                    styles.currencySymbol,
                    isDark && { color: colors.text }
                  ]}>
                    ₦
                  </Text>
                  <TextInput
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    keyboardType="number-pad"
                    style={[
                      styles.amountInput,
                      isDark && { backgroundColor: 'transparent' }
                    ]}
                    theme={{
                      colors: { 
                        primary: colors.tint,
                        text: isDark ? colors.text : '#000',
                        placeholder: isDark ? colors.inactive : '#666',
                        background: 'transparent'
                      }
                    }}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? colors.inactive : "#666"}
                    mode="flat"
                    underlineColor="transparent"
                    textColor={isDark ? colors.text : '#000'}
                  />
                </View>
                
                {wallet && (
                  <View style={styles.balanceContainer}>
                    <Text style={[
                      styles.walletBalance,
                      isDark && { color: colors.subtext }
                    ]}>
                      Available Balance: ₦{wallet.balance?.toLocaleString() || '0'}
                    </Text>
                    
                    {withdrawAmount && Number(withdrawAmount) > 0 && (
                      <View style={styles.remainingBalanceWrapper}>
                        <Text style={[
                          styles.remainingBalanceLabel,
                          isDark && { color: colors.subtext }
                        ]}>
                          After withdrawal:
                        </Text>
                        <Text style={[
                          styles.remainingBalance,
                          isDark && { color: colors.subtext },
                          (wallet.balance - Number(withdrawAmount) < 0) && styles.negativeBalance
                        ]}>
                          ₦{(Math.max(0, wallet.balance - Number(withdrawAmount))).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Bank Selection Card */}
              <View style={[
                styles.card,
                isDark && { backgroundColor: colors.cardBackground }
              ]}>
                <Text style={[
                  styles.cardTitle,
                  isDark && { color: colors.text }
                ]}>
                  Select Bank
                </Text>
                
                <TouchableOpacity 
                  style={[
                    styles.bankSelector,
                    isDark && { 
                      backgroundColor: colors.background, 
                      borderColor: colors.border 
                    }
                  ]}
                  onPress={() => setShowBankSelector(true)}
                >
                  {selectedBank ? (
                    <View style={styles.selectedBankContainer}>
                      <Image 
                        source={{ uri: selectedBank.logo }} 
                        style={styles.bankLogo}
                        resizeMode="contain"
                      />
                      <Text style={[
                        styles.selectedBankName,
                        isDark && { color: colors.text }
                      ]}>
                        {selectedBank.name}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.bankPlaceholderContainer}>
                      <Ionicons 
                        name="search" 
                        size={20} 
                        color={isDark ? colors.inactive : "#666"}
                      />
                      <Text style={[
                        styles.bankPlaceholderText,
                        isDark && { color: colors.inactive }
                      ]}>
                        Search for your bank
                      </Text>
                    </View>
                  )}
                  <Ionicons 
                    name="chevron-down" 
                    size={24} 
                    color={isDark ? colors.inactive : "#666"}
                  />
                </TouchableOpacity>

                {/* Bank Selection Modal */}
                <Modal
                  visible={showBankSelector}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setShowBankSelector(false)}
                >
                  <View style={[
                    styles.modalOverlay,
                    isDark && { backgroundColor: 'rgba(0,0,0,0.7)' }
                  ]}>
                    <View style={[
                      styles.modalContent,
                      isDark && { backgroundColor: colors.cardBackground }
                    ]}>
                      <View style={styles.modalHeader}>
                        <Text style={[
                          styles.modalTitle,
                          isDark && { color: colors.text }
                        ]}>
                          Select Bank
                        </Text>
                        <TouchableOpacity 
                          onPress={() => setShowBankSelector(false)}
                          style={styles.closeButton}
                        >
                          <Ionicons 
                            name="close" 
                            size={24} 
                            color={isDark ? colors.text : "#000"}
                          />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        value={bankSearchQuery}
                        onChangeText={handleBankSearch}
                        placeholder="Search for bank..."
                        mode="outlined"
                        style={[
                          styles.searchInput,
                          isDark && { backgroundColor: 'transparent' }
                        ]}
                        outlineColor={isDark ? colors.border : '#ddd'}
                        activeOutlineColor={colors.tint}
                        theme={{
                          colors: { 
                            primary: colors.tint,
                            text: isDark ? colors.text : '#000',
                            placeholder: isDark ? colors.inactive : '#666',
                            background: isDark ? colors.cardBackground : 'transparent'
                          }
                        }}
                        textColor={isDark ? colors.text : '#000'}
                        placeholderTextColor={isDark ? colors.inactive : "#666"}
                        left={
                          <TextInput.Icon 
                            icon="magnify" 
                            color={isDark ? colors.inactive : "#666"}
                          />
                        }
                      />

                      <FlatList
                        data={filteredBanks}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.banksList}
                        renderItem={({ item }) => (
                          <TouchableOpacity 
                            style={[
                              styles.bankListItem,
                              isDark && { borderBottomColor: colors.border }
                            ]}
                            onPress={() => selectBank(item)}
                          >
                            <Image 
                              source={{ uri: item.logo }} 
                              style={styles.bankLogo}
                              resizeMode="contain"
                            />
                            <Text style={[
                              styles.bankItemName,
                              isDark && { color: colors.text }
                            ]}>
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                          <View style={styles.emptySearchContainer}>
                            <Text style={[
                              styles.emptySearchText,
                              isDark && { color: colors.subtext }
                            ]}>
                              No banks found matching "{bankSearchQuery}"
                            </Text>
                          </View>
                        }
                      />
                    </View>
                  </View>
                </Modal>
              </View>

              {/* Account Details Card */}
              <View style={[
                styles.card,
                isDark && { backgroundColor: colors.cardBackground }
              ]}>
                <Text style={[
                  styles.cardTitle,
                  isDark && { color: colors.text }
                ]}>
                  Account Details
                </Text>
                
                <Text style={[
                  styles.inputLabel,
                  isDark && { color: colors.subtext }
                ]}>
                  Account Number
                </Text>
                
                <TextInput
                  value={accountNumber}
                  onChangeText={(text) => {
                    setAccountNumber(text);
                    if (text.length === 10) {
                      validateAccountNumber(text);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                  mode="outlined"
                  style={[
                    styles.accountInput,
                    isDark && { backgroundColor: 'transparent' }
                  ]}
                  outlineColor={isDark ? colors.border : '#ddd'}
                  activeOutlineColor={colors.tint}
                  theme={{
                    colors: { 
                      primary: colors.tint,
                      text: isDark ? colors.text : '#000',
                      placeholder: isDark ? colors.inactive : '#666',
                      background: isDark ? colors.cardBackground : 'transparent'
                    }
                  }}
                  textColor={isDark ? colors.text : '#000'}
                  placeholder="Enter 10-digit account number"
                  placeholderTextColor={isDark ? colors.inactive : "#666"}
                />
                
                {isValidating && (
                  <View style={[
                    styles.statusCard,
                    styles.validationStatus,
                    isDark && { backgroundColor: 'rgba(33, 150, 243, 0.15)' }
                  ]}>
                    <ActivityIndicator size="small" color={isDark ? colors.tint : Colors.primary} />
                    <Text style={[
                      styles.statusText,
                      isDark && { color: colors.tint }
                    ]}>
                      Validating account...
                    </Text>
                  </View>
                )}

                {accountName && (
                  <View style={[
                    styles.statusCard,
                    styles.accountNameContainer,
                    isDark && { backgroundColor: 'rgba(76, 175, 80, 0.15)' }
                  ]}>
                    <Ionicons 
                      name="checkmark-circle" 
                      size={20} 
                      color={isDark ? "#4CAF50" : "green"} 
                    />
                    <Text style={[
                      styles.accountName,
                      isDark && { color: "#4CAF50" }
                    ]}>
                      {accountName}
                    </Text>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[
                  styles.withdrawButton,
                  isDark && { backgroundColor: colors.tint },
                  (!withdrawAmount || !accountNumber || !selectedBank || !accountName || loading) && [
                    styles.disabledButton,
                    isDark && { opacity: 0.4 }
                  ]
                ]}
                onPress={handleWithdrawSubmit}
                disabled={!withdrawAmount || !accountNumber || !selectedBank || !accountName || loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.withdrawButtonText}>
                    Withdraw Funds
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      
      <Toast />
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: '8@s',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: '24@s',
  },
  // Header section
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: '16@s',
    paddingTop: '16@s',
    paddingBottom: '24@s',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: '16@s',
  },
  title: {
    fontSize: '24@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16@s',
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Urbanist-SemiBold',
  },
  // Card components
  card: {
    backgroundColor: '#fff',
    borderRadius: '16@s',
    padding: '16@s',
    marginHorizontal: '16@s',
    marginBottom: '16@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@s',
  },
  // Amount input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: '12@s',
    paddingHorizontal: '12@s',
    marginBottom: '8@s',
  },
  currencySymbol: {
    fontSize: '28@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginRight: '4@s',
  },
  amountInput: {
    flex: 1,
    fontSize: '28@s',
    fontFamily: 'Urbanist-Bold',
    backgroundColor: 'transparent',
    height: '62@vs',
  },
  walletBalance: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-SemiBold',
    textAlign: 'right',
  },
  balanceContainer: {
    marginTop: '8@s',
  },
  remainingBalanceWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: '4@s',
  },
  remainingBalanceLabel: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  remainingBalance: {
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-Bold',
    marginLeft: '4@s',
  },
  negativeBalance: {
    color: '#EF4444',
  },
  // Bank selection
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '16@s',
    paddingVertical: '14@s',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: '12@s',
  },
  selectedBankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedBankName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    marginLeft: '12@s',
  },
  bankPlaceholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankPlaceholderText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginLeft: '8@s',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: '24@s',
    borderTopRightRadius: '24@s',
    paddingHorizontal: '16@s',
    paddingBottom: '24@s',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: '16@s',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  modalTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
  },
  closeButton: {
    padding: '4@s',
  },
  searchInput: {
    marginTop: '16@s',
    marginBottom: '8@s',
    backgroundColor: 'transparent',
  },
  banksList: {
    paddingTop: '8@s',
  },
  bankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '12@s',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bankItemName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    marginLeft: '12@s',
  },
  emptySearchContainer: {
    padding: '24@s',
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: '16@s',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
  },
  // Keep existing bank related styles
  bankLogo: {
    width: '24@s',
    height: '24@s',
    marginRight: '8@s',
  },
  // Account details
  inputLabel: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginBottom: '8@s',
  },
  accountInput: {
    backgroundColor: 'transparent',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '8@s',
  },
  // Status cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '12@s',
    borderRadius: '10@s',
    marginTop: '8@s',
  },
  validationStatus: {
    backgroundColor: '#E3F2FD',
  },
  accountNameContainer: {
    backgroundColor: '#E8F5E9',
  },
  statusText: {
    fontSize: '14@s',
    marginLeft: '8@s',
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
  },
  accountName: {
    marginLeft: '8@s',
    fontSize: '16@s',
    color: 'green',
    fontFamily: 'Urbanist-Bold',
  },
  // Withdrawal button
  withdrawButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8@s',
    marginHorizontal: '16@s',
  },
  disabledButton: {
    opacity: 0.6,
  },
  withdrawButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  // Processing view
  processingCard: {
    margin: '16@s',
    padding: '24@s',
    borderRadius: '16@s',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: '300@vs',
  },
  processingText: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '24@s',
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginTop: '8@s',
    textAlign: 'center',
  },
  // Cancel button for processing withdrawal
  cancelWithdrawButton: {
    marginTop: '32@s',
    alignSelf: 'center',
    paddingVertical: '12@s',
    paddingHorizontal: '24@s',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: '12@s',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cancelWithdrawButtonText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Bold',
    color: '#EF4444',
  },
}); 