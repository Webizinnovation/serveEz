import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Platform,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ScaledSheet } from 'react-native-size-matters';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';
import { useUserStore } from '../../store/useUserStore';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

export default function CustomerCareScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { profile } = useUserStore();
  
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleCall = () => {
    Alert.alert(
      "Call Customer Support",
      "Would you like to call our customer service?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Call", 
          onPress: () => {
            Linking.openURL('tel:+1234567890')
              .catch(err => Alert.alert('Unable to make call', 'Please try again later'));
          } 
        }
      ]
    );
  };

  const handleEmail = () => {
    Alert.alert(
      "Email Customer Support",
      "Would you like to send an email to our support team?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Send Email", 
          onPress: () => {
            Linking.openURL('mailto:support@servez.com?subject=Customer%20Support')
              .catch(err => Alert.alert('Unable to open email', 'Please try again later'));
          } 
        }
      ]
    );
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // User-specific FAQs with simpler answers
  const userFaqData = [
    {
      question: "How do I book a service?",
      answer: "Go to the Services tab, pick a service, choose a provider, and tap Book. Follow the steps to confirm your booking."
    },
    {
      question: "How do I cancel a booking?",
      answer: "Open your Orders, find the booking you want to cancel, and tap the Cancel button. Cancellation fees may apply depending on timing."
    },
    {
      question: "How do payments work?",
      answer: "Pay securely using credit cards, digital wallets, or our in-app wallet. All payments are processed after your service is complete."
    },
    {
      question: "Can I reschedule a service?",
      answer: "Yes! Go to your Services, find your booking, and tap the Reschedule option. Choose a new date and time that works for you."
    },
    {
      question: "What if I'm not satisfied?",
      answer: "Rate the service and leave feedback. If there's a problem, tap Report Issue in your completed order or contact our support team."
    }
  ];

  // Provider-specific FAQs
  const providerFaqData = [
    {
      question: "How do I receive bookings?",
      answer: "After setting up your profile and services, you'll receive booking requests in the Orders tab. Accept or decline them based on your availability."
    },
    {
      question: "How do I get paid?",
      answer: "Payments are processed automatically after service completion. Funds will be transferred to your linked bank account within 24 hours."
    },
    {
      question: "How can I adjust my availability?",
      answer: "Go to Profile > Availability to set your working hours and blocked days. Update this regularly to prevent unwanted bookings."
    },
    {
      question: "What if I need to cancel a booking?",
      answer: "Go to your Bookings, select the appointment, and tap Cancel. Please provide a reason. Note that frequent cancellations may affect your rating."
    },
    {
      question: "How do I respond to customer feedback?",
      answer: "View your ratings in the Reviews section. You can respond to any feedback left by customers to address concerns or thank them for positive reviews."
    }
  ];

  const getFaqData = () => {
    // If profile is null or undefined (e.g., during logout), default to user FAQs
    if (!profile) return userFaqData;
    return profile.role === 'provider' ? providerFaqData : userFaqData;
  };
  
  const faqData = getFaqData();

  // Define gradients based on theme
  const gradientColors = isDark 
    ? ['#1E3A8A', colors.tint] as [string, string]
    : [Colors.primary, '#F58220'] as [string, string];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Customer Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.heroSection}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>How can we help you?</Text>
              <Text style={styles.heroSubtitle}>We're here to assist you 24/7</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.supportOptionsContainer}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Support Options
          </Text>
          
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <TouchableOpacity 
              style={[styles.supportOption, { backgroundColor: colors.cardBackground }]}
              onPress={() => router.push('/support/report')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#F39C12' }]}>
                <MaterialIcons name="report-problem" size={24} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Report a Problem</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>Let us know about an issue</Text>
              </View>
              <AntDesign name="right" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <TouchableOpacity 
              style={[styles.supportOption, { backgroundColor: colors.cardBackground }]}
              onPress={handleCall}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#2ECC71' }]}>
                <FontAwesome5 name="phone-alt" size={22} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Call Support</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>Talk to a representative</Text>
              </View>
              <AntDesign name="right" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity 
              style={[styles.supportOption, { backgroundColor: colors.cardBackground }]}
              onPress={handleEmail}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#E74C3C' }]}>
                <MaterialIcons name="email" size={24} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Email Support</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>support@servez.com</Text>
              </View>
              <AntDesign name="right" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.faqSection}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Frequently Asked Questions
          </Text>
          
          {faqData.map((faq, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(600 + index * 100).duration(400)}
            >
              <TouchableOpacity 
                style={[
                  styles.faqItem, 
                  { backgroundColor: colors.cardBackground },
                  expandedFaq === index && styles.expandedFaqItem
                ]}
                onPress={() => toggleFaq(index)}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
                  <Ionicons 
                    name={expandedFaq === index ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={colors.subtext}
                  />
                </View>
                
                {expandedFaq === index && (
                  <Text style={[styles.faqAnswer, { color: colors.subtext }]}>
                    {faq.answer}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
        
        <Animated.View 
          entering={FadeInDown.delay(1100).duration(400)}
          style={styles.contactCard}
        >
          <View style={[styles.contactCardContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.contactCardTitle, { color: colors.text }]}>
              Need immediate assistance?
            </Text>
            <Text style={[styles.contactCardSubtitle, { color: colors.subtext }]}>
              Our support team is ready to help with your questions
            </Text>
            <TouchableOpacity 
              style={[styles.chatButton, { backgroundColor: colors.tint }]}
              onPress={handleCall}
            >
              <FontAwesome5 name="headset" size={16} color="#fff" style={styles.chatButtonIcon} />
              <Text style={styles.chatButtonText}>Contact Support Team</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: '30@s',
  },
  heroSection: {
    marginBottom: '20@s',
    borderRadius: '16@s',
    marginHorizontal: '16@s',
    marginTop: '16@s',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  heroGradient: {
    borderRadius: '16@s',
  },
  heroContent: {
    padding: '24@s',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: isSmallDevice ? '22@s' : '24@s',
    fontFamily: 'Urbanist-Bold',
    color: 'white',
    marginBottom: '4@s',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: isSmallDevice ? '14@s' : '16@s',
    fontFamily: 'Urbanist-Medium',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@s',
    paddingHorizontal: '16@s',
  },
  supportOptionsContainer: {
    marginBottom: '24@s',
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '16@s',
    borderRadius: '16@s',
    marginHorizontal: '16@s',
    marginBottom: '12@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: '44@s',
    height: '44@s',
    borderRadius: '12@s',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '16@s',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '2@s',
  },
  optionSubtitle: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
  },
  faqSection: {
    marginBottom: '24@s',
  },
  faqItem: {
    borderRadius: '16@s',
    marginHorizontal: '16@s',
    marginBottom: '10@s',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  expandedFaqItem: {
    marginBottom: '12@s',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16@s',
  },
  faqQuestion: {
    fontSize: '15@s',
    fontFamily: 'Urbanist-SemiBold',
    flex: 1,
    marginRight: '8@s',
  },
  faqAnswer: {
    paddingHorizontal: '16@s',
    paddingBottom: '16@s',
    paddingTop: '4@s',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    lineHeight: '20@s',
  },
  businessHoursContainer: {
    marginBottom: '24@s',
  },
  businessHoursCard: {
    borderRadius: '16@s',
    padding: '16@s',
    marginHorizontal: '16@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  businessHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: '10@s',
  },
  separator: {
    height: 1,
    width: '100%',
    opacity: 0.6,
  },
  dayText: {
    fontSize: '15@s',
    fontFamily: 'Urbanist-SemiBold',
  },
  hoursText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
  },
  contactCard: {
    marginHorizontal: '16@s',
    marginBottom: '24@s',
  },
  contactCardContent: {
    borderRadius: '16@s',
    padding: '20@s',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  contactCardTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
    textAlign: 'center',
  },
  contactCardSubtitle: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    textAlign: 'center',
    marginBottom: '16@s',
    paddingHorizontal: '8@s',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '12@s',
    paddingHorizontal: '20@s',
    borderRadius: '30@s',
    marginTop: '4@s',
  },
  chatButtonIcon: {
    marginRight: '8@s',
  },
  chatButtonText: {
    color: 'white',
    fontFamily: 'Urbanist-Bold',
    fontSize: '16@s',
  },
}); 