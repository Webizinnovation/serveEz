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
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import Logo from '../../assets/images/Svg/logo2svg.svg';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../components/ThemeProvider';
import * as Crypto from 'expo-crypto';

// PIN Input Components
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

const CELL_COUNT = 4;

export default function WithdrawPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, refreshProfile, updateProfile } = useUserStore();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [stage, setStage] = useState<'check' | 'create' | 'confirm' | 'verify'>('check');
  const { isDark, colors } = useTheme();
  const amount = params.amount as string;
  
  // Animation for the logo
  const fadeValue = React.useRef(new Animated.Value(0.4)).current;
  
  // For the PIN input field
  const pinRef = useBlurOnFulfill({ value: pin, cellCount: CELL_COUNT });
  const confirmPinRef = useBlurOnFulfill({ value: confirmPin, cellCount: CELL_COUNT });
  
  const [pinProps, getPinCellOnLayoutHandler] = useClearByFocusCell({
    value: pin,
    setValue: setPin,
  });
  
  const [confirmPinProps, getConfirmPinCellOnLayoutHandler] = useClearByFocusCell({
    value: confirmPin,
    setValue: setConfirmPin,
  });

  // Start the fading animation when loading
  useEffect(() => {
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
  
  // Check if the user has a PIN set
  useEffect(() => {
    if (profile) {
      // Use type assertion to handle the withdraw_pin property
      const userProfile = profile as typeof profile & { withdraw_pin?: string };
      const userHasPin = !!userProfile.withdraw_pin;
      setHasPin(userHasPin);
      setStage(userHasPin ? 'verify' : 'create');
    }
  }, [profile]);

  // Function to hash the PIN
  const hashPin = async (pinToHash: string) => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinToHash
    );
    return hash;
  };

  // Function to set a new PIN
  const handleCreatePin = async () => {
    if (pin.length !== CELL_COUNT) {
      Toast.show({
        type: 'error',
        text1: 'Invalid PIN',
        text2: `PIN must be ${CELL_COUNT} digits`,
        position: 'bottom'
      });
      return;
    }
    
    setStage('confirm');
    setConfirmPin('');
  };

  // Function to confirm the PIN
  const handleConfirmPin = async () => {
    if (confirmPin !== pin) {
      Toast.show({
        type: 'error',
        text1: 'PINs Do Not Match',
        text2: 'Please try again',
        position: 'bottom'
      });
      setConfirmPin('');
      return;
    }
    
    setLoading(true);
    
    try {
      // Store PIN in plain text (not hashed) for admin recovery purposes
      // Note: Storing PINs in plain text has security implications
      await updateProfile({ withdraw_pin: pin } as any);
      
      Toast.show({
        type: 'success',
        text1: 'PIN Created',
        text2: 'Your withdrawal PIN has been set',
        position: 'bottom'
      });
      
      setStage('verify');
      setPin('');
    } catch (error) {
      console.error('Error creating PIN:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create PIN. Please try again.',
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to verify PIN and proceed with withdrawal
  const handleVerifyPin = async () => {
    if (pin.length !== CELL_COUNT) {
      Toast.show({
        type: 'error',
        text1: 'Invalid PIN',
        text2: `PIN must be ${CELL_COUNT} digits`,
        position: 'bottom'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Compare with stored PIN using type assertion (now comparing plain text)
      const userProfile = profile as typeof profile & { withdraw_pin?: string };
      if (pin !== userProfile.withdraw_pin) {
        Toast.show({
          type: 'error',
          text1: 'Incorrect PIN',
          text2: 'Please try again',
          position: 'bottom'
        });
        setPin('');
        setLoading(false);
        return;
      }
      
      // PIN is correct, proceed to withdrawal
      Toast.show({
        type: 'success',
        text1: 'PIN Verified',
        text2: 'Proceeding to withdrawal',
        position: 'bottom'
      });
      
      // Navigate to withdraw page with amount and verified flag
      router.replace({
        pathname: '/payment/withdraw',
        params: { amount, verified: 'true' }
      });
      
    } catch (error) {
      console.error('Error verifying PIN:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to verify PIN. Please try again.',
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTitle = () => {
    switch (stage) {
      case 'create':
        return 'Create Withdrawal PIN';
      case 'confirm':
        return 'Confirm Withdrawal PIN';
      case 'verify':
        return 'Enter Withdrawal PIN';
      default:
        return 'Withdrawal PIN';
    }
  };

  const renderSubtitle = () => {
    switch (stage) {
      case 'create':
        return 'Create a 4-digit PIN to secure your withdrawals';
      case 'confirm':
        return 'Re-enter your PIN to confirm';
      case 'verify':
        return 'Enter your PIN to proceed with the withdrawal';
      default:
        return 'Secure your withdrawals with a PIN';
    }
  };

  const handleActionButton = () => {
    switch (stage) {
      case 'create':
        handleCreatePin();
        break;
      case 'confirm':
        handleConfirmPin();
        break;
      case 'verify':
        handleVerifyPin();
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen
        options={{
          title: 'Secure Withdrawal',
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
        {loading ? (
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
              {stage === 'verify' ? 'Verifying PIN...' : 'Creating PIN...'}
            </Text>
            
            {/* Cancel button for processing state */}
            <TouchableOpacity
              style={[
                styles.cancelButton,
                isDark && { borderColor: colors.border }
              ]}
              onPress={() => {
                setLoading(false);
                setPin('');
                setConfirmPin('');
              }}
            >
              <Text style={[
                styles.cancelButtonText,
                isDark && { color: colors.text }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Logo and Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <Logo width={80} height={80} />
              </View>
              
              <Text style={[
                styles.title,
                isDark && { color: colors.text }
              ]}>
                {renderTitle()}
              </Text>
              
              <Text style={[
                styles.subtitle,
                isDark && { color: colors.subtext }
              ]}>
                {renderSubtitle()}
              </Text>
            </View>

            {/* PIN Input Section */}
            <View style={[
              styles.card,
              isDark && { backgroundColor: colors.cardBackground }
            ]}>
              <Text style={[
                styles.pinLabel,
                isDark && { color: colors.subtext }
              ]}>
                {stage === 'confirm' ? 'Confirm PIN' : 'Enter PIN'}
              </Text>
              
              <CodeField
                ref={stage === 'confirm' ? confirmPinRef : pinRef}
                {...(stage === 'confirm' ? confirmPinProps : pinProps)}
                value={stage === 'confirm' ? confirmPin : pin}
                onChangeText={stage === 'confirm' ? setConfirmPin : setPin}
                cellCount={CELL_COUNT}
                rootStyle={styles.codeFieldRoot}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                renderCell={({ index, symbol, isFocused }: { 
                  index: number; 
                  symbol: string; 
                  isFocused: boolean 
                }) => (
                  <View
                    key={index}
                    style={[
                      styles.cell,
                      isDark && { 
                        backgroundColor: colors.cardBackground, 
                        borderColor: colors.border 
                      },
                      isFocused && styles.focusCell,
                      isFocused && isDark && { borderColor: colors.tint }
                    ]}
                    onLayout={
                      stage === 'confirm'
                        ? getConfirmPinCellOnLayoutHandler(index)
                        : getPinCellOnLayoutHandler(index)
                    }
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isDark && { color: colors.text }
                      ]}
                    >
                      {symbol ? '•' : null}
                      {isFocused && (
                        <Text style={{ color: isDark ? colors.text : '#000' }}>|</Text>
                      )}
                    </Text>
                  </View>
                )}
              />
              
              {amount && (
                <View style={[
                  styles.amountContainer,
                  isDark && { backgroundColor: colors.background }
                ]}>
                  <Text style={[
                    styles.amountLabel,
                    isDark && { color: colors.subtext }
                  ]}>
                    Withdrawal Amount:
                  </Text>
                  <Text style={[
                    styles.amountValue,
                    isDark && { color: colors.text }
                  ]}>
                    ₦{parseFloat(amount).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                isDark && { backgroundColor: colors.tint },
                ((stage === 'create' || stage === 'verify') && pin.length !== CELL_COUNT) && styles.disabledButton,
                (stage === 'confirm' && confirmPin.length !== CELL_COUNT) && styles.disabledButton
              ]}
              onPress={handleActionButton}
              disabled={
                (stage === 'create' && pin.length !== CELL_COUNT) ||
                (stage === 'confirm' && confirmPin.length !== CELL_COUNT) ||
                (stage === 'verify' && pin.length !== CELL_COUNT) ||
                loading
              }
            >
              <Text style={styles.actionButtonText}>
                {stage === 'create' ? 'Create PIN' : 
                 stage === 'confirm' ? 'Confirm PIN' : 'Verify PIN'}
              </Text>
            </TouchableOpacity>

            {/* Reset PIN option for users who already have a PIN */}
            {hasPin && stage === 'verify' && (
              <TouchableOpacity
                style={styles.resetPinButton}
                onPress={() => {
                  Alert.alert(
                    "Contact Support",
                    "For security reasons, please contact customer support to reset your withdrawal PIN.",
                    [
                      { text: "OK", style: "default" }
                    ]
                  );
                }}
              >
                <Text style={[
                  styles.resetPinText,
                  isDark && { color: colors.tint }
                ]}>
                  Forgot PIN?
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  content: {
    flex: 1,
    padding: '16@s',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: '24@s',
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
    paddingHorizontal: '16@s',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16@s',
    padding: '20@s',
    marginBottom: '24@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pinLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginBottom: '16@s',
    textAlign: 'center',
  },
  codeFieldRoot: {
    marginBottom: '20@s',
    width: '100%',
    justifyContent: 'center',
  },
  cell: {
    width: '60@s',
    height: '60@s',
    lineHeight: '60@s',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: '8@s',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '5@s',
  },
  focusCell: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  cellText: {
    fontSize: '32@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    textAlign: 'center',
  },
  amountContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: '8@s',
    padding: '12@s',
    marginTop: '8@s',
  },
  amountLabel: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  amountValue: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '4@s',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  resetPinButton: {
    alignSelf: 'center',
    marginTop: '16@s',
    padding: '8@s',
  },
  resetPinText: {
    color: Colors.primary,
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16@s',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
    marginTop: '16@s',
  },
  cancelButton: {
    marginTop: '32@s',
    paddingVertical: '10@s',
    paddingHorizontal: '24@s',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: '8@s',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
  },
}); 