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
  Animated,
  Easing,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { TextInput } from 'react-native-paper';
import { useUserStore } from '../../store/useUserStore';
import { initializeTransaction, initializePayment, verifyTransaction } from '../../services/paystack';
import { supabase } from '../../services/supabase';
import * as Linking from 'expo-linking';
import Logo from '../../assets/images/Svg/logo2svg.svg';
import { logTransactionError, updateTransactionStatus } from '../../utils/errorHandling';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../components/ThemeProvider';
import { 
  sendDepositSuccessNotification, 
  sendTransactionFailedNotification, 
  sendTransactionPendingNotification 
} from '../../services/pushNotifications';

export default function DepositScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, refreshProfile } = useUserStore();
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { isDark, colors } = useTheme();
  
  // Animation for the logo - for fading effect
  const fadeValue = React.useRef(new Animated.Value(0.4)).current;
  
  // Start the fading animation when verifying is true
  React.useEffect(() => {
    if (verifying) {
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
  }, [verifying]);
  

  useEffect(() => {
    if (params.amount) {
      setDepositAmount(params.amount as string);
    }
  }, [params]);

  // Add a listener for deep links to handle Paystack callback
  useEffect(() => {
    // Flag to track if component is mounted
    let isMounted = true;
    
    // Setup deep linking listener
    const subscription = Linking.addEventListener('url', event => {
      // Only process if component is still mounted
      if (isMounted && event.url.includes('payment') && transactionReference) {
        verifyAndUpdateWallet(transactionReference);
      }
    });

    // Check if app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (isMounted && url && url.includes('payment') && transactionReference) {
        handleDeepLink({ url });
      }
    }).catch(err => console.error('Error getting initial URL:', err));

    return () => {
      // Set flag to prevent state updates after unmount
      isMounted = false;
      // Remove the event listener
      subscription.remove();
    };
  }, [transactionReference]);

  // Handle deep link when user is redirected back from Paystack
  const handleDeepLink = async ({ url }: { url: string }) => {
    if (url.includes('payment') && transactionReference) {
      await verifyAndUpdateWallet(transactionReference);
    }
  };

  // Verify transaction and update wallet balance
  const verifyAndUpdateWallet = async (reference: string) => {
    let transactionData: any = null;
    try {
      setVerifying(true);
      
      // Get transaction record
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();
        
      if (fetchError) throw fetchError;
      transactionData = transaction;

      // Verify the transaction with Paystack and get detailed response
      const verificationResponse = await verifyTransaction(reference);
      
      if (!verificationResponse || !verificationResponse.data) {
        throw new Error('Transaction verification failed');
      }

      // Get status from Paystack response
      const paystackStatus = verificationResponse.data.status;
      const transactionStatus = paystackStatus === 'success' ? 'completed' : 
                               paystackStatus === 'failed' ? 'failed' : 'pending';

      if (transactionStatus === 'failed') {
        throw new Error('Payment was not successful');
      }

      if (transactionStatus === 'pending') {
        Toast.show({
          type: 'info',
          text1: 'Transaction Pending',
          text2: 'Your payment is still being processed. Please check back later.',
          position: 'top',
          visibilityTime: 4000
        });
        return;
      }

      // If we get here, the transaction was successful
      // Update wallet balance using RPC function
      const { error: walletError } = await supabase.rpc('increase_wallet_balance', {
        amount: Number(depositAmount),
        p_user_id: profile?.id
      });

      if (walletError) {
        throw walletError;
      }

      // Update transaction status to completed with Paystack response data
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: transactionStatus,
          sender_type: 'user',
          metadata: {
            ...transactionData.metadata,
            verified_at: new Date().toISOString(),
            payment_status: paystackStatus,
            paystack_response: {
              status: paystackStatus,
              gateway_response: verificationResponse.data.gateway_response,
              channel: verificationResponse.data.channel,
              currency: verificationResponse.data.currency,
              ip_address: verificationResponse.data.ip_address,
              transaction_date: verificationResponse.data.transaction_date
            }
          }
        })
        .eq('id', transactionData.id);

      if (updateError) {
        console.error('Error updating transaction status:', updateError);
        throw new Error('Failed to update transaction status');
      }

      await refreshProfile();
      
      Toast.show({
        type: 'success',
        text1: 'Deposit Successful',
        text2: `Your wallet has been credited with ₦${depositAmount}`,
        position: 'top',
        visibilityTime: 4000
      });
      
      setTimeout(() => {
        router.back();
      }, 2000);

      // Send notification for successful deposit - using safer pattern
      try {
        setTimeout(() => {
          sendDepositSuccessNotification(Number(depositAmount))
            .catch(err => console.error('Error scheduling notification:', err));
        }, 300);
      } catch (notifError) {
        console.error('Error sending success notification:', notifError);
        // Fail silently - don't let notification errors crash the app
      }
    } catch (error: any) {
      // Determine the stage of failure
      const errorStage: 'verification' | 'wallet_update' = 
        error.message?.includes?.('verification') ? 'verification' : 'wallet_update';
        
      logTransactionError({
        type: 'deposit',
        stage: errorStage,
        error,
        details: {
          amount: Number(depositAmount),
          reference,
          userId: profile?.id
        }
      });

      if (transactionData?.id) {
        // Update transaction status to failed with error details
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transactionData.metadata,
              error: {
                message: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('id', transactionData.id);
      }

      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: 'Failed to verify transaction. Please contact support if your account was debited.',
        position: 'top'
      });

      // Send notification for failed deposit - using safer pattern
      try {
        setTimeout(() => {
          sendTransactionFailedNotification('deposit', Number(depositAmount), error.message || 'Unknown error')
            .catch(err => console.error('Error scheduling notification:', err));
        }, 300);
      } catch (notifError) {
        console.error('Error sending failure notification:', notifError);
        // Fail silently - don't let notification errors crash the app
      }
    } finally {
      setVerifying(false);
      setTransactionReference(null);
    }
  };

  const handleDepositSubmit = async () => {
    if (!depositAmount || Number(depositAmount) < 100) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Minimum deposit amount is ₦100',
        position: 'top'
      });
      return;
    }

    let transactionData: any = null;
    
    try {
      setLoading(true);

      const transaction = await initializeTransaction(
        Number(depositAmount),
        profile?.email || '',
        { 
          user_id: profile?.id,
          sender_type: 'user'
        }
      );
      
      transactionData = transaction;
      setTransactionReference(transaction.reference);

      // Update transaction status to pending
      const { error: statusError } = await supabase
        .from('transactions')
        .update({
          status: 'pending',
          sender_type: 'user'
        })
        .eq('reference', transaction.reference);

      if (statusError) {
        console.error('Error updating transaction status:', statusError);
      }

      const paymentUrl = await initializePayment({
        email: profile?.email || '',
        amount: transaction.amount, 
        reference: transaction.reference,
        metadata: {
          user_id: profile?.id,
          sender_type: 'user'
        }
      });
      
      const supported = await Linking.canOpenURL(paymentUrl);
      if (!supported) {
        throw new Error('Cannot open payment page');
      }
      
      Toast.show({
        type: 'info',
        text1: 'Redirecting to Payment',
        text2: 'Please complete your payment on the Paystack page',
        position: 'top',
        visibilityTime: 3000
      });
      
      await Linking.openURL(paymentUrl);

      // Send notification for pending deposit - using safer pattern
      try {
        setTimeout(() => {
          sendTransactionPendingNotification('deposit', Number(depositAmount))
            .catch(err => console.error('Error scheduling notification:', err));
        }, 300);
      } catch (notifError) {
        console.error('Error sending pending notification:', notifError);
        // Fail silently - don't let notification errors crash the app
      }
    } catch (error: any) {
      logTransactionError({
        type: 'deposit',
        stage: 'initialization',
        error,
        details: {
          amount: Number(depositAmount),
          reference: transactionData?.reference,
          userId: profile?.id
        }
      });

      // Update reference if we have one
      if (transactionData?.reference) {
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              error: error.message || 'Unknown error',
              timestamp: new Date().toISOString()
            }
          })
          .eq('reference', transactionData.reference);
      }

      Toast.show({
        type: 'error',
        text1: 'Deposit Failed',
        text2: error.message || 'Failed to initialize payment',
        position: 'top'
      });

      // Send notification for failed deposit - using safer pattern
      try {
        setTimeout(() => {
          sendTransactionFailedNotification('deposit', Number(depositAmount), error.message || 'Failed to initialize payment')
            .catch(err => console.error('Error scheduling notification:', err));
        }, 300);
      } catch (notifError) {
        console.error('Error sending failure notification:', notifError);
        // Fail silently - don't let notification errors crash the app
      }
    } finally {
      setLoading(false);
    }
  };


  const checkTransactionStatus = async () => {
    if (!transactionReference) {
      Toast.show({
        type: 'error',
        text1: 'No Transaction',
        text2: 'No ongoing transaction to verify',
        position: 'top'
      });
      return;
    }

    await verifyAndUpdateWallet(transactionReference);
  };

  return (
    <SafeAreaView style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen
        options={{
          title: 'Fund Wallet',
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Logo width={100} height={100} />
            </View>
            
            <Text style={[
              styles.title,
              isDark && { color: colors.text }
            ]}>
              Add Money to Your Wallet
            </Text>
            
            <Text style={[
              styles.subtitle,
              isDark && { color: colors.subtext }
            ]}>
              Quick and secure payments with Paystack
            </Text>
          </View>

          {verifying ? (
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
                Verifying your payment...
              </Text>
              <Text style={[
                styles.processingSubtext,
                isDark && { color: colors.subtext }
              ]}>
                Please wait while we confirm your transaction
              </Text>
            </View>
          ) : transactionReference ? (
            <View style={[
              styles.processingCard,
              isDark && { backgroundColor: colors.cardBackground }
            ]}>
              <Ionicons 
                name="hourglass-outline" 
                size={60} 
                color={isDark ? colors.tint : Colors.primary} 
              />
              <Text style={[
                styles.pendingTitle,
                isDark && { color: colors.text }
              ]}>
                Payment In Progress
              </Text>
              <Text style={[
                styles.pendingText,
                isDark && { color: colors.subtext }
              ]}>
                We're waiting for confirmation from Paystack. This may take a moment.
              </Text>
              
              <TouchableOpacity 
                style={[
                  styles.checkStatusButton,
                  isDark && { backgroundColor: colors.tint }
                ]}
                onPress={checkTransactionStatus}
              >
                <Text style={styles.checkStatusText}>
                  Check Status
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.cancelButton,
                  isDark && { 
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    borderWidth: 1
                  }
                ]}
                onPress={() => {
                  setTransactionReference(null);
                  router.back();
                }}
              >
                <Text style={[
                  styles.cancelText,
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
                  Deposit Amount
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
                    value={depositAmount}
                    onChangeText={setDepositAmount}
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
              </View>

              {/* Quick Amounts Card */}
              <View style={[
                styles.card,
                isDark && { backgroundColor: colors.cardBackground }
              ]}>
                <Text style={[
                  styles.cardTitle,
                  isDark && { color: colors.text }
                ]}>
                  Quick Select
                </Text>
                
                <View style={styles.quickAmounts}>
                  {[1000, 2000, 5000, 10000].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.quickAmount,
                        isDark && { 
                          backgroundColor: colors.background,
                          borderColor: colors.border 
                        },
                        depositAmount === amount.toString() && [
                          styles.selectedAmount,
                          isDark && { 
                            backgroundColor: 'rgba(33, 150, 243, 0.15)', 
                            borderColor: colors.tint 
                          }
                        ]
                      ]}
                      onPress={() => setDepositAmount(amount.toString())}
                    >
                      <Text style={[
                        styles.quickAmountText,
                        isDark && { color: colors.subtext },
                        depositAmount === amount.toString() && [
                          styles.selectedAmountText,
                          isDark && { color: colors.tint }
                        ]
                      ]}>
                        ₦{amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Info Card */}
              <View style={[
                styles.card,
                isDark && { backgroundColor: colors.cardBackground }
              ]}>
                <View style={[
                  styles.paymentInfo,
                  isDark && { backgroundColor: 'rgba(33, 150, 243, 0.07)' }
                ]}>
                  <Ionicons 
                    name="information-circle-outline" 
                    size={20} 
                    color={isDark ? colors.tint : "#666"} 
                  />
                  <Text style={[
                    styles.paymentInfoText,
                    isDark && { color: colors.subtext }
                  ]}>
                    You'll be redirected to Paystack to complete your payment securely.
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.depositButton,
                    isDark && { backgroundColor: colors.tint },
                    (!depositAmount || loading) && [
                      styles.disabledButton,
                      isDark && { opacity: 0.4 }
                    ]
                  ]}
                  onPress={handleDepositSubmit}
                  disabled={!depositAmount || loading}
                >
                  {loading ? (
                    <Animated.View style={{ opacity: fadeValue, marginRight: 10 }}>
                      <Logo width={24} height={24} />
                    </Animated.View>
                  ) : (
                    <Text style={styles.depositButtonText}>
                      Proceed to Payment
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
  // Quick amounts section
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAmount: {
    width: '48%',
    paddingVertical: '16@s',
    paddingHorizontal: '12@s',
    backgroundColor: '#f0f0f0',
    borderRadius: '12@s',
    marginBottom: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedAmount: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  quickAmountText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  selectedAmountText: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Bold',
  },
  // Payment info section
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: '12@s',
    borderRadius: '12@s',
    marginBottom: '20@s',
  },
  paymentInfoText: {
    fontSize: '14@s',
    color: '#666',
    marginLeft: '8@s',
    fontFamily: 'Urbanist-Medium',
    flex: 1,
  },
  // Action buttons
  depositButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabledButton: {
    opacity: 0.6,
  },
  depositButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  // Verification states
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
  // Transaction pending state
  pendingTitle: {
    fontSize: '22@s',
    fontFamily: 'Urbanist-Bold',
    marginTop: '16@s',
    marginBottom: '8@s',
    textAlign: 'center',
    color: '#333',
  },
  pendingText: {
    fontSize: '14@s',
    color: '#666',
    marginBottom: '24@s',
    textAlign: 'center',
    paddingHorizontal: '16@s',
    fontFamily: 'Urbanist-Medium',
  },
  checkStatusButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '14@s',
    paddingHorizontal: '24@s',
    borderRadius: '12@s',
    marginBottom: '12@s',
    width: '100%',
    alignItems: 'center',
  },
  checkStatusText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: '14@s',
    paddingHorizontal: '24@s',
    borderRadius: '12@s',
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
  },
}); 