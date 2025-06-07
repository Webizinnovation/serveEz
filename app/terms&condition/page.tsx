import React from 'react'
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native'
import { Colors } from '../../constants/Colors'
import { useTheme } from '../../components/ThemeProvider'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

export default function TermsAndCondition() {
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
            Terms and Conditions
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
            <Text style={[styles.textBold, isDark && { color: colors.tint }]}>Welcome to ServeEz!</Text>
          </Text>
          
          <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
            These Terms and Conditions ("Terms") govern your use of our application ("App") and the services provided through it. By accessing or using the App, you agree to be bound by these Terms. If you do not agree with any part of these Terms, you must not use the App.
          </Text>
          
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              1. Acceptance of Terms
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              By using ServeEz, you confirm that you are at least 18 years old (or the legal age of majority in your jurisdiction) and have the legal capacity to enter into these Terms. If you are using the App on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              2. Description of Services
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              ServeEz is a platform that connects users ("Users") with professionals ("Providers") across various industries.
              The App allows Users to search for and engage Professionals for services.
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              ServeEz acts solely as a platform to facilitate these connections and does not provide any services itself. Professionals are independent entities and are not employees or agents of ServeEz.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              3. User Responsibilities
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Account Creation:</Text> To use the App, you must create an account and provide accurate, complete, and up-to-date information.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Prohibited Activities:</Text> You agree not to use the App for any illegal, fraudulent, or unauthorized purpose. This includes, but is not limited to, harassment, spamming, or violating intellectual property rights.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Content:</Text> You are solely responsible for any content you post or share on the App. You agree not to post any content that is offensive, defamatory, or violates any laws.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              4. Professional Responsibilities
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Accuracy of Information:</Text> Professionals must provide accurate and truthful information about their skills, experience, and services.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Conduct:</Text> Professionals agree to provide services in a professional and ethical manner. Any disputes between Professionals and Users are solely between them, and ServeEz is not responsible for resolving such disputes unless explicitly stated.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              5. Payments and Fees
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Direct Payments:</Text> Users may pay Professionals directly for services rendered. ServeEz does not currently charge fees for using the platform but reserves the right to introduce fees in the future.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Processed Payments:</Text> If ServeEz introduces payment processing in the future, fees and terms will be clearly disclosed to Users and Professionals.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Refunds:</Text> Refund policies are determined by individual Professionals and are not the responsibility of ServeEz.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              6. Dispute Resolution
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Mediation:</Text> ServeEz may mediate disputes between Users and Professionals to ensure a fair resolution. However, ServeEz is not obligated to resolve disputes and does not guarantee any specific outcome.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Reporting Issues:</Text> Users and Professionals can report disputes or issues by contacting ServeEz at <Text style={[styles.link, isDark && { color: colors.tint }]}>contact@serveezapp.com</Text>. ServeEz will review the issue and attempt to facilitate a resolution.
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={[styles.bullet, isDark && { color: colors.tint }]}>•</Text>
              <Text style={[styles.bulletText, isDark && { color: colors.text }]}>
                <Text style={styles.bulletTitle}>Legal Action:</Text> If a dispute cannot be resolved through mediation, either party may pursue legal action in accordance with the governing law stated below.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              7. Intellectual Property
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              All content, trademarks, logos, and software associated with the App are the property of ServeEz or its licensors. You may not use, copy, or distribute any content from the App without prior written permission.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              8. Limitation of Liability
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              ServeEz is not liable for any damages arising from your use of the App, including but not limited to direct, indirect, incidental, or consequential damages. We do not guarantee the accuracy, reliability, or availability of the App or the services provided by Professionals.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              9. Termination
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              We reserve the right to suspend or terminate your access to the App at any time, without notice, for any reason, including but not limited to a violation of these Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              10. Governing Law
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes arising out of or in connection with these Terms shall first be resolved amicably through mediation. If mediation fails, the dispute shall be referred to arbitration in accordance with the Arbitration and Conciliation Act of Nigeria. The arbitration shall be conducted in Lagos, and the language of the arbitration shall be English. The decision of the arbitrator(s) shall be final and binding on both parties.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.tint }]}>
              11. Changes to Terms
            </Text>
            <Text style={[styles.paragraph, isDark && { color: colors.text }]}>
              We may update these Terms from time to time. Any changes will be posted on the App, and your continued use of the App constitutes acceptance of the updated Terms.
            </Text>
          </View>
          
          <View style={styles.footer}>
            <Text style={[styles.footerText, isDark && { color: colors.subtext }]}>
              Last Updated: April 2025
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
    marginBottom: 16,
    color: '#333',
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
