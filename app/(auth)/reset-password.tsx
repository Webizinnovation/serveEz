import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome, MaterialIcons, AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight, FadeIn } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { useColorScheme } from 'react-native';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
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

  const handleResetPassword = async () => {
    if (!email) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter your email address',
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'serveez://reset-password-confirm',
      });

      if (error) throw error;

      setResetSent(true);
      Toast.show({
        type: 'success',
        text1: 'Reset Link Sent',
        text2: 'Check your email for the password reset link',
        position: 'bottom',
        visibilityTime: 4000,
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      Toast.show({
        type: 'error',
        text1: 'Reset Failed',
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
      <TouchableOpacity 
        style={styles.backLink}
        onPress={() => router.back()}
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
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            entering={FadeInDown.delay(200).duration(800).springify()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}
          >
            <Animated.Text
              style={[styles.title, { color: isDark ? colors.tint : Colors.primary }]}
            >
              Reset Password
            </Animated.Text>
            <Animated.View entering={FadeInRight.delay(300).duration(700)}>
              <Ionicons name="lock-open-outline" size={30} color={isDark ? colors.tint : Colors.primary} style={{ marginLeft: 10 }} />
            </Animated.View>
          </Animated.View>

          {!resetSent ? (
            <>
              <Animated.Text 
                entering={FadeIn.delay(300).duration(800)}
                style={[styles.instructions, { color: isDark ? colors.subtext : '#666' }]}
              >
                Enter your email address below, and we'll send you a link to reset your password.
              </Animated.Text>

              <Animated.View 
                entering={FadeInRight.delay(400).duration(800).springify()}
                style={styles.inputGroup}
              >
                <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Email</Text>
                <View style={[styles.inputContainer, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                }]}>
                  <MaterialCommunityIcons 
                    name="email-outline" 
                    size={20} 
                    color={isDark ? colors.subtext : "#666"} 
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: 'transparent',
                      color: isDark ? colors.text : '#000'
                    }]}
                    placeholder="Enter your email"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.5)" : "#666"}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(500).duration(800).springify()}>
                <Button 
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={loading}
                  disabled={loading}
                  style={[styles.resetButton, { 
                    backgroundColor: isDark ? colors.tint : "#00456C",
                    borderRadius: 12,
                    elevation: 4
                  }]}
                  contentStyle={styles.buttonContent}
                  icon={() => <MaterialIcons name="send" size={20} color="white" />}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </Animated.View>
            </>
          ) : (
            <Animated.View 
              entering={FadeIn.duration(800).springify()}
              style={styles.successContainer}
            >
              <MaterialIcons name="email" size={60} color={isDark ? colors.tint : Colors.primary} style={styles.emailIcon} />
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(800)}
                style={[styles.successText, { color: isDark ? colors.text : '#333' }]}
              >
                A password reset link has been sent to {email}
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(300).duration(800)}
                style={[styles.successSubtext, { color: isDark ? colors.subtext : '#666' }]}
              >
                Please check your email and follow the instructions to reset your password.
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
                  Back to Login
                </Button>
              </Animated.View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(600).duration(800).springify()}>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.loginLink}>
                <Text style={[styles.loginText, { color: isDark ? colors.subtext : '#666' }]}>
                  Remember your password? <Text style={[styles.loginHighlight, { color: isDark ? colors.tint : Colors.primary }]}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </ScrollView>
      </View>
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  inputContainer: {
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
    height: 50,
  },
  input: {
    flex: 1,
    height: '100%',
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
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  loginText: {
    fontSize: 16,
    color: '#666',
    fontFamily: "Urbanist-Medium",
  },
  loginHighlight: {
    color: Colors.primary,
    fontFamily: "Urbanist-Bold",
  },
  successContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emailIcon: {
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