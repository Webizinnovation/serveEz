import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  useColorScheme,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome, AntDesign, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight, FadeIn } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;

export default function ResetPasswordConfirm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState('');

  const { token } = useLocalSearchParams();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Define theme colors based on system preference
  const colors = {
    background: isDark ? '#121212' : Colors.primary,
    cardBackground: isDark ? '#1E1E1E' : 'white',
    text: isDark ? 'white' : '#333',
    subtext: isDark ? 'rgba(255,255,255,0.6)' : '#666',
    tint: isDark ? '#F58220' : Colors.primary,
    secondaryBackground: isDark ? '#2C2C2C' : '#D9D9D9',
    border: isDark ? 'rgba(255,255,255,0.2)' : '#ccc',
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const toggleConfirmPasswordVisibility = () => {
    setIsConfirmPasswordVisible(!isConfirmPasswordVisible);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      // In a real app, we would use the hash from the params
      // Here we're simulating the update password function
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setResetComplete(true);
      Toast.show({
        type: 'success',
        text1: 'Password Updated',
        text2: 'Your password has been successfully updated',
        position: 'bottom',
        visibilityTime: 4000,
      });
    } catch (error: any) {
      console.error('Update password error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error instanceof Error ? error.message : 'An error occurred. Please try again.',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : Colors.primary }]}>
      <StatusBar backgroundColor={isDark ? colors.background : Colors.primary} barStyle="light-content" />
      
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}>
        <TouchableOpacity 
          style={styles.backLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <AntDesign name="left" size={24} color={isDark ? colors.text : "white"} />
        </TouchableOpacity>

        <Animated.View 
          entering={FadeInDown.duration(800).springify()}
          style={styles.logoContainer}
        >
          <Logo width={isSmallDevice ? 90 : 111} height={isSmallDevice ? 90 : 111} 
            style={[styles.logo, { 
              backgroundColor: isDark ? colors.cardBackground : "white",
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 8,
            }]} 
          />
        </Animated.View>

        <View style={[styles.formContainer, { 
          backgroundColor: isDark ? colors.cardBackground : 'white',
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5,
        }]}>
          <Animated.View 
            entering={FadeInDown.duration(800).springify()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}
          >
            <Animated.Text
              style={[styles.title, { color: isDark ? colors.tint : Colors.primary }]}
            >
              {resetComplete ? 'Password Updated' : 'Create New Password'}
            </Animated.Text>
            <Animated.View entering={FadeInRight.delay(300).duration(700)}>
              <Ionicons 
                name={resetComplete ? "checkmark-circle-outline" : "lock-closed-outline"} 
                size={30} 
                color={isDark ? colors.tint : Colors.primary} 
                style={{ marginLeft: 10 }} 
              />
            </Animated.View>
          </Animated.View>

          {!resetComplete ? (
            <>
              <Animated.Text 
                entering={FadeIn.delay(300).duration(800)}
                style={[styles.instructions, { color: isDark ? colors.subtext : '#666' }]}
              >
                Please enter and confirm your new password below.
              </Animated.Text>

              {error ? (
                <Animated.Text 
                  entering={FadeIn.duration(400)}
                  style={styles.errorText}
                >
                  {error}
                </Animated.Text>
              ) : null}

              <Animated.View 
                entering={FadeInRight.delay(400).duration(800).springify()}
                style={styles.inputGroup}
              >
                <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>New Password</Text>
                <View style={[styles.passwordContainer, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: 10,
                }]}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={isDark ? colors.subtext : "#666"} 
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: 'transparent',
                      color: isDark ? colors.text : '#000',
                      flex: 1,
                    }]}
                    placeholder="Enter new password"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.5)" : "#666"}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!isPasswordVisible}
                  />
                  <TouchableOpacity 
                    onPress={togglePasswordVisibility}
                    style={{ padding: 10 }}
                  >
                    <FontAwesome
                      name={isPasswordVisible ? "eye" : "eye-slash"}
                      size={18}
                      color={isDark ? colors.subtext : "#666"}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Animated.View 
                entering={FadeInRight.delay(500).duration(800).springify()}
                style={styles.inputGroup}
              >
                <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Confirm Password</Text>
                <View style={[styles.passwordContainer, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: 10,
                }]}>
                  <Ionicons 
                    name="shield-checkmark-outline" 
                    size={20} 
                    color={isDark ? colors.subtext : "#666"} 
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: 'transparent',
                      color: isDark ? colors.text : '#000',
                      flex: 1,
                    }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.5)" : "#666"}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!isConfirmPasswordVisible}
                  />
                  <TouchableOpacity 
                    onPress={toggleConfirmPasswordVisibility}
                    style={{ padding: 10 }}
                  >
                    <FontAwesome
                      name={isConfirmPasswordVisible ? "eye" : "eye-slash"}
                      size={18}
                      color={isDark ? colors.subtext : "#666"}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(600).duration(800).springify()}>
                <Button 
                  mode="contained"
                  onPress={handleUpdatePassword}
                  loading={loading}
                  disabled={loading}
                  style={[styles.resetButton, { 
                    backgroundColor: isDark ? colors.tint : "#00456C",
                    borderRadius: 12,
                    elevation: 4
                  }]}
                  contentStyle={styles.buttonContent}
                  icon={() => <MaterialIcons name="lock-reset" size={20} color="white" />}
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </Animated.View>
            </>
          ) : (
            <Animated.View 
              entering={FadeIn.duration(800).springify()}
              style={styles.successContainer}
            >
              <MaterialIcons 
                name="check-circle" 
                size={60} 
                color={isDark ? colors.tint : Colors.primary} 
                style={styles.successIcon} 
              />
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(800)}
                style={[styles.successText, { color: isDark ? colors.text : '#333' }]}
              >
                Your password has been successfully updated
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(300).duration(800)}
                style={[styles.successSubtext, { color: isDark ? colors.subtext : '#666' }]}
              >
                You can now use your new password to login to your account.
              </Animated.Text>
              <Animated.View entering={FadeInDown.delay(400).duration(800).springify()}>
                <Button 
                  mode="contained"
                  onPress={() => router.push('/(auth)/login')}
                  style={[styles.backToLoginButton, { 
                    backgroundColor: isDark ? colors.tint : Colors.primary,
                    borderRadius: 12,
                    elevation: 4
                  }]}
                  contentStyle={styles.buttonContent}
                  icon={() => <MaterialCommunityIcons name="login" size={20} color="white" />}
                >
                  Go to Login
                </Button>
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backLink: {
    margin: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    backgroundColor: "white",
    borderRadius: 300,
    resizeMode: "contain",
  },
  formContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 0,
    flex: 1,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: "Urbanist-Bold",
    marginBottom: 5,
    textAlign: 'left',
    color: Colors.primary,
  },
  instructions: {
    fontSize: 16,
    fontFamily: "Urbanist-Regular",
    marginBottom: 25,
    color: '#666',
    lineHeight: 22,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    fontFamily: "Urbanist-Regular",
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
    height: 50,
  },
  input: {
    backgroundColor: 'transparent',
    height: 50,
    fontSize: 16,
    fontFamily: "Urbanist-Regular",
    color: '#000',
  },
  resetButton: {
    marginTop: 15,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#00456C",
  },
  backToLoginButton: {
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  buttonContent: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContainer: {
    alignItems: 'center',
    padding: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successText: {
    fontSize: 18,
    fontFamily: "Urbanist-Bold",
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  successSubtext: {
    fontSize: 16,
    fontFamily: "Urbanist-Regular",
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
}); 