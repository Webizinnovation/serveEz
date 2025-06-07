import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, AntDesign } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { createSupportTicket } from '../../services/supportChat';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';

const ISSUE_TYPES = [
  'Account',
  'Booking',
  'Payment',
  'Technical Issue',
  'Feature Request',
  'Provider',
  'Service',
  'Other',
];

export default function NewSupportTicketScreen() {
  const router = useRouter();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  
  // Define additional theme colors specific to this screen
  const extendedColors = {
    ...colors,
    secondaryBackground: isDark ? '#2C2C2C' : '#f0f0f0',
    border: isDark ? 'rgba(255,255,255,0.2)' : '#e0e0e0',
    gradientStart: isDark ? '#1E3A8A' : '#00456B',
    gradientEnd: isDark ? '#F58220' : Colors.primary,
    inputBackground: isDark ? '#2A2A2A' : '#f5f5f5',
  };

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleIssueTypeSelect = (issueType: string) => {
    setSelectedIssueType(issueType);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your support ticket');
      return;
    }

    if (!selectedIssueType) {
      Alert.alert('Error', 'Please select an issue type');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message describing your issue');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'You must be logged in to create a support ticket');
      return;
    }

    setLoading(true);

    try {
      const ticket = await createSupportTicket(
        profile.id,
        profile.role as 'user' | 'provider',
        selectedIssueType,
        title
      );

      if (!ticket) {
        throw new Error('Failed to create ticket');
      }

      // Navigate to the new ticket's chat
      router.replace({
        pathname: '/support/chat',
        params: { 
          ticketId: ticket.id,
          newTicket: 'true',
          firstMessage: message
        }
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Failed to create support ticket. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: extendedColors.background }]}>
      <View style={[styles.header, { backgroundColor: extendedColors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={extendedColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: extendedColors.text }]}>New Support Ticket</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(800)} style={styles.formHeaderContainer}>
            <LinearGradient
              colors={[extendedColors.gradientStart, extendedColors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.formHeaderGradient}
            >
              <View style={styles.formHeaderContent}>
                <MaterialIcons name="support-agent" size={40} color="white" />
                <Text style={styles.formHeaderTitle}>How can we help you?</Text>
                <Text style={styles.formHeaderSubtitle}>Our team is ready to assist</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={styles.formContainer}>
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.formGroup}>
              <Text style={[styles.label, { color: extendedColors.text }]}>Title</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: extendedColors.inputBackground,
                  borderColor: extendedColors.border
                }
              ]}>
                <TextInput
                  style={[styles.input, { color: extendedColors.text }]}
                  placeholder="Enter a title for your support request"
                  placeholderTextColor={extendedColors.subtext}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.formGroup}>
              <Text style={[styles.label, { color: extendedColors.text }]}>Issue Type</Text>
              <View style={styles.issueTypeContainer}>
                {ISSUE_TYPES.map((issueType) => (
                  <TouchableOpacity
                    key={issueType}
                    style={[
                      styles.issueTypeButton,
                      { 
                        backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0',
                      },
                      selectedIssueType === issueType && { 
                        backgroundColor: isDark ? 'rgba(245,130,32,0.2)' : 'rgba(0,69,108,0.1)',
                        borderColor: extendedColors.tint,
                        borderWidth: 1
                      }
                    ]}
                    onPress={() => handleIssueTypeSelect(issueType)}
                  >
                    <Text 
                      style={[
                        styles.issueTypeText, 
                        { color: isDark ? extendedColors.subtext : '#666' },
                        selectedIssueType === issueType && { 
                          color: extendedColors.tint, 
                          fontFamily: 'Urbanist-Bold' 
                        }
                      ]}
                    >
                      {issueType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.formGroup}>
              <Text style={[styles.label, { color: extendedColors.text }]}>Message</Text>
              <View style={[
                styles.messageInputContainer,
                { 
                  backgroundColor: extendedColors.inputBackground,
                  borderColor: extendedColors.border
                }
              ]}>
                <TextInput
                  style={[styles.messageInput, { color: extendedColors.text }]}
                  placeholder="Describe your issue in detail..."
                  placeholderTextColor={extendedColors.subtext}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  textAlignVertical="top"
                />
              </View>
              <Text style={[styles.helperText, { color: extendedColors.subtext }]}>
                Please provide as much detail as possible to help us resolve your issue quickly.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: extendedColors.tint },
                  (loading || !title.trim() || !selectedIssueType || !message.trim()) && styles.disabledButton
                ]}
                onPress={handleSubmit}
                disabled={loading || !title.trim() || !selectedIssueType || !message.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Submit Ticket</Text>
                    <AntDesign name="arrowright" size={20} color="white" style={styles.submitIcon} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: '12@s',
    paddingHorizontal: '16@s',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: '8@s',
  },
  headerTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: '24@s',
  },
  formHeaderContainer: {
    margin: '16@s',
    borderRadius: '16@s',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  formHeaderGradient: {
    borderRadius: '16@s',
  },
  formHeaderContent: {
    padding: '24@s',
    alignItems: 'center',
  },
  formHeaderTitle: {
    fontSize: '20@s',
    fontFamily: 'Urbanist-Bold',
    color: 'white',
    marginTop: '12@s',
    marginBottom: '4@s',
    textAlign: 'center',
  },
  formHeaderSubtitle: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: '16@s',
  },
  formGroup: {
    marginBottom: '20@s',
  },
  label: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
  },
  inputContainer: {
    borderRadius: '12@s',
    borderWidth: '1@s',
    paddingHorizontal: '16@s',
  },
  input: {
    height: '50@s',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
  },
  issueTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: '-4@s',
  },
  issueTypeButton: {
    paddingVertical: '8@s',
    paddingHorizontal: '16@s',
    borderRadius: '30@s',
    marginHorizontal: '4@s',
    marginBottom: '8@s',
  },
  issueTypeText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
  },
  messageInputContainer: {
    borderRadius: '12@s',
    borderWidth: '1@s',
    paddingHorizontal: '16@s',
    paddingVertical: '8@s',
  },
  messageInput: {
    minHeight: '150@s',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Regular',
    marginTop: '6@s',
    marginLeft: '4@s',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '16@s',
    borderRadius: '30@s',
    marginTop: '8@s',
  },
  submitButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  submitIcon: {
    marginLeft: '8@s',
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 