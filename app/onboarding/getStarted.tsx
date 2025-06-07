import React from "react";
import {
  View,
  Dimensions,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Platform,
  useColorScheme,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { AntDesign, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomButton from "../../components/CustomBotton";
import Animated, {
  FadeInDown,
  FadeIn,
  FadeInRight,
} from "react-native-reanimated";
import Logo from "../../assets/images/Svg/logo2svg.svg";

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375;
const isLargeDevice = width >= 768;

export default function GetStarted() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#121212' : Colors.primary }]}>
      <StatusBar backgroundColor={isDark ? '#121212' : Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <AntDesign
          name="left"
          size={24}
          color="white"
          onPress={() => router.push("/onboarding/Skip")}
          style={styles.backButton}
        />
      </View>
      <View style={[styles.main, { backgroundColor: isDark ? '#121212' : Colors.primary }]}>
        <Animated.View 
          entering={FadeInDown.duration(800).springify()}
          style={styles.logoContainer}
        >
          <Logo 
            style={[styles.logo, {
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.3,
              shadowRadius: 5,
              elevation: 8,
            }]} 
            width={isSmallDevice ? 80 : 100} 
            height={isSmallDevice ? 80 : 100} 
          />
        </Animated.View>
        <View style={[styles.contentContainer, isDark && { backgroundColor: '#1E1E1E' }]}>
          <View style={styles.textContainer}>
            <Animated.View 
              style={{ flexDirection: 'row', alignItems: 'center' }}
              entering={FadeInDown.duration(700).springify()}
            >
              <Animated.Text
                style={[styles.title, isDark && { color: '#F58220' }]}
              >
                Almost There!
              </Animated.Text>
              <Animated.View entering={FadeInRight.delay(300).duration(700)}>
                <Ionicons name="rocket" size={30} color={isDark ? '#F58220' : Colors.primary} style={{ marginLeft: 10 }} />
              </Animated.View>
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(700).delay(200).springify()}>
              <Animated.Text style={[styles.subtitle, isDark && { color: '#E0E0E0' }]}>
                Experience the convenience of a seamless and personalized process,
                coming to you wherever you are.
              </Animated.Text>
            </Animated.View>
          </View>
          <View style={styles.buttonGroup}>
            <Animated.View entering={FadeIn.duration(700).delay(300)} style={styles.buttonWrapper}>
              <CustomButton
                title="Sign Up"
                handlePress={() => router.push("/(auth)/signup")}
                containerStyle={[styles.signUpButton, isDark && { backgroundColor: '#F58220' }]}
                textStyles={undefined}
                isLoading={undefined}
                leftIcon={<Ionicons name="person-add-outline" size={20} color="white" style={{ marginRight: 8 }} />}
              />
            </Animated.View>
            <Animated.View entering={FadeIn.duration(700).delay(600)} style={styles.buttonWrapper}>
              <CustomButton
                title="Log In"
                handlePress={() => router.push("/(auth)/login")}
                containerStyle={styles.logInButton}
                textStyles={undefined}
                isLoading={undefined}
                leftIcon={<MaterialCommunityIcons name="login" size={20} color="white" style={{ marginRight: 8 }} />}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    marginTop: Platform.OS === 'ios' ? height * 0.05 : height * 0.07,
    paddingHorizontal: width * 0.05,
  },
  backButton: {
    padding: 5,
  },
  main: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  logoContainer: {
    marginTop: height * 0.06,
    marginBottom: height * 0.04,
    alignItems: "center",
  },
  logo: {
    borderRadius: 100,
    backgroundColor: "white",
  },
  contentContainer: {
    width: "100%",
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: isSmallDevice ? 60 : 80,
    borderTopRightRadius: isSmallDevice ? 60 : 80,
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.08,
    paddingBottom: Platform.OS === 'ios' ? height * 0.05 : 0,
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: Colors.primary,
    fontSize: isSmallDevice ? 28 : isLargeDevice ? 40 : 34,
    fontFamily: "Urbanist-Bold",
    textAlign: "left",
    marginBottom: height * 0.02,
    paddingHorizontal: width * 0.03,
  },
  subtitle: {
    fontSize: isSmallDevice ? 15 : isLargeDevice ? 22 : 18,
    fontFamily: "Urbanist-Regular",
    paddingHorizontal: width * 0.03,
    marginBottom: height * 0.03,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: width * 0.04,
    paddingHorizontal: isSmallDevice ? width * 0.02 : 0,
    marginBottom: Platform.OS === 'ios' ? height * 0.08 : height * 0.10,
  },
  buttonWrapper: {
    flex: 1,
    maxWidth: isSmallDevice ? "48%" : isLargeDevice ? "40%" : "45%",
  },
  signUpButton: {
    paddingVertical: height * 0.02,
    paddingHorizontal: isSmallDevice ? width * 0.04 : width * 0.05,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    width: "100%",
  },
  logInButton: {
    paddingVertical: height * 0.02,
    paddingHorizontal: isSmallDevice ? width * 0.04 : width * 0.05,
    borderRadius: 40,
    backgroundColor: "#00456C",
    width: "100%",
  },
});
