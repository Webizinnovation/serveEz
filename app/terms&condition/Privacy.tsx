import React from 'react'
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native'
import { Colors } from '../../constants/Colors'
import { useTheme } from '../../components/ThemeProvider'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

export default function PrivacyPolicy() {
  const { isDark, colors } = useTheme()
  const router = useRouter()

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, isDark && { backgroundColor: colors.cardBackground }]}>
        <View style={styles.headerContent}>
          <Ionicons 
            name="chevron-back" 
            size={28} 
            color={isDark ? colors.text : Colors.primary} 
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>
            Privacy Policy
          </Text>
          <View style={{ width: 28 }} />
        </View>
      </View>
      
      <ScrollView 
        style={[styles.container, isDark && { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={[styles.welcomeText, isDark && { color: colors.text }]}>
            <Text style={[styles.textBold, isDark && { color: colors.tint }]}>PRIVACY POLICY FOR SERVEEZ</Text>
          </Text>
          
          <Text style={[styles.dateText, isDark && { color: colors.subtext }]}>
            Last Updated: March 3, 2025
          </Text>
          
          <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
            At ServeEz, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our App.
          </Text>
          
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              1. Information We Collect
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Personal Information:</Text> When you create an account, we may collect your name, email address, phone number, and location data.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Usage Data:</Text> We collect information about how you interact with the App, including IP addresses, device information, and browsing activity.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Content:</Text> We may collect any content you post or share on the App, including messages, reviews, and feedback.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              2. How We Use Your Information
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                To provide and improve the App and its services.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                To facilitate connections between Users and Professionals.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                To track user behavior and location data to enhance user experience.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                To communicate with you about updates, promotions, and customer support.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              3. Sharing Your Information
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>With Professionals:</Text> We share necessary information with Professionals to facilitate the services you request.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Third-Party Service Providers:</Text> We may share your information with third-party service providers who assist us in operating the App (e.g., hosting providers, analytics tools).
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Legal Requirements:</Text> We may disclose your information if required by law or to protect our rights and safety.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              4. Data Security
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              We implement industry-standard security measures to protect your information from unauthorized access, alteration, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              5. Your Rights
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Access and Correction:</Text> You may access and update your personal information through your account settings.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Deletion:</Text> You may request the deletion of your account and personal information by contacting us at <Text style={[styles.link, isDark && { color: colors.tint }]}>serveezapp@gmail.com</Text>.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Opt-Out:</Text> You may opt out of receiving promotional communications from us by following the unsubscribe link in our emails.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              6. Children's Privacy
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              The App is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              7. Changes to This Policy
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              We may update this Privacy Policy from time to time. Any changes will be posted on the App, and your continued use of the App constitutes acceptance of the updated policy.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              8. Contact Us
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              If you have any questions about these Terms or the Privacy Policy, please contact us at <Text style={[styles.link, isDark && { color: colors.tint }]}>serveezapp@gmail.com</Text>.
            </Text>
          </View>
          
          <View style={styles.footer}>
            <Text style={[styles.footerText, isDark && { color: colors.subtext }]}>
              ServeEz © 2025 All Rights Reserved
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginTop: 15,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 19,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: 'Urbanist-Bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    marginBottom: 24,
    color: '#777',
    textAlign: 'center',
  },
  textBold: {
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  paragraph: {
    fontSize: 16,
    fontFamily: 'Urbanist-Regular',
    lineHeight: 24,
    color: '#333',
    marginBottom: 16,
  },
  section: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingRight: 8,
  },
  bullet: {
    fontSize: 16,
    color: Colors.primary,
    marginRight: 8,
    fontFamily: 'Urbanist-Bold',
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    lineHeight: 22,
  },
  bulletTitle: {
    fontFamily: 'Urbanist-Bold',
  },
  link: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: '#777',
  },
});
