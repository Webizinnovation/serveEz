import {
    Animated,
    RefreshControl,
    StyleSheet,
    View,
    Text,
    Pressable,
    Dimensions,
    Platform,
    useColorScheme,
  } from "react-native";
  import React, { useEffect, memo, useCallback, useState } from "react";
  import { Colors } from "../../constants/Colors";
  import { SafeAreaView } from "react-native-safe-area-context";
  import { useRouter } from "expo-router";
  import AntDesign from "@expo/vector-icons/AntDesign";
  import Logo from "../../assets/images/Svg/logo1.svg";
  import Logo1 from "../../assets/images/Svg/people.svg";
  import Logo3 from "../../assets/images/Svg/Page indicator.svg";
  import { scale, verticalScale, moderateScale } from "react-native-size-matters";


  const { width, height } = Dimensions.get("window");
  const isSmallDevice = width < 375;
  const isLargeDevice = width >= 768;
  
  const Welcome = memo(() => {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [showLoading, setShowLoading] = useState(false);

  
    const onRefresh = useCallback(() => {
      setRefreshing(true);
      setTimeout(() => {
        setRefreshing(false);
      }, 2000);
    }, []);
  
    const handleSkipPress = useCallback(() => {
      setShowLoading(true);
      setTimeout(() => {
        router.push("/onboarding/getStarted");
      }, 300);
    }, [router]);
  
    return (
      <SafeAreaView style={[styles.container, isDark && { backgroundColor: '#121212' }]}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.skipContainer}>
            <Pressable onPress={handleSkipPress} style={styles.skipButton}>
              <Text style={[styles.skipText, isDark && { color: '#F58220' }]}>Skip</Text>
              <AntDesign name="right" size={17} color={isDark ? '#F58220' : Colors.primary} />
            </Pressable>
          </View>
          <View style={styles.logoContainer}>
            <Logo 
              width={isSmallDevice ? 65 : isLargeDevice ? 90 : 77} 
              height={isSmallDevice ? 65 : isLargeDevice ? 90 : 77} 
            />
            <View style={styles.quoteContainer}>
              <Text style={[styles.quoteText, isDark && { color: '#A8BAC4' }]}>"Find services anywhere"</Text>
              <View style={[styles.logo1Container, isDark && { borderColor: 'rgba(100,100,100,0.4)' }]}>
                <Logo1 
                  width={isSmallDevice ? 340 : isLargeDevice ? 420 : 374} 
                  height={isSmallDevice ? 180 : isLargeDevice ? 220 : 197} 
                  style={styles.logo1}
                />
              </View>
            </View>
            <View style={styles.textBlockContainer}>
              <Text style={[styles.welcomeText, isDark && { color: '#F58220' }]}>
                Welcome to serve<Text style={styles.serveEzText}>ez</Text>
              </Text>
              <View style={styles.pageIndicatorContainer}>
                <Logo3 />
              </View>
              <Text style={[styles.descriptionText, isDark && { color: '#E0E0E0' }]}>
                Find professionals for your domestic needs quickly, and without
                hassles.
              </Text>
            </View>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    );
  });
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#fff",
    },
    scrollView: {
      minHeight: "100%",
      flexGrow: 1,
    },
    skipContainer: {
      alignSelf: "flex-end",
      paddingHorizontal: width * 0.05,
      paddingTop: Platform.OS === 'ios' ? height * 0.02 : height * 0.03,
    },
    skipButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: moderateScale(8),
    },
    skipText: {
      color: Colors.primary,
      fontSize: moderateScale(isSmallDevice ? 15 : 17),
      fontFamily: "Urbanist-SemiBold",
      marginRight: 4,
    },
    logoContainer: {
      flex: 1,
      alignItems: "center",
      marginTop: verticalScale(20),
      paddingHorizontal: scale(10),
    },
    quoteContainer: {
      alignItems: "center",
      marginTop: verticalScale(15),
      marginBottom: verticalScale(10),
    },
    quoteText: {
      fontFamily: "Urbanist-Regular",
      fontSize: moderateScale(isSmallDevice ? 13 : isLargeDevice ? 17 : 15),
      textAlign: "center",
      paddingBottom: verticalScale(20),
      color: "#5A8192",
    },
    logo1Container: {
      borderRadius: 2,
      borderWidth: isSmallDevice ? 90 : isLargeDevice ? 120 : 103,
      borderColor: "#D9D9D966",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: verticalScale(14),
    },
    logo1: {
      position: "absolute",
    },
    textBlockContainer: {
      alignItems: "center",
      width: "100%",
      paddingHorizontal: scale(15),
      maxWidth: 500,
    },
    welcomeText: {
      fontFamily: "Urbanist-Bold",
      fontSize: moderateScale(isSmallDevice ? 15 : isLargeDevice ? 20 : 17),
      textAlign: "center",
      paddingTop: verticalScale(20),
      paddingBottom: verticalScale(5),
      color: Colors.primary,
    },
    serveEzText: {
      color: "#F58220",
    },
    pageIndicatorContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginVertical: verticalScale(8),
    },
    descriptionText: {
      fontFamily: "Urbanist-Regular",
      fontSize: moderateScale(isSmallDevice ? 13 : isLargeDevice ? 18 : 15),
      textAlign: "center",
      paddingTop: verticalScale(15),
      paddingHorizontal: scale(10),
    },
  });
  
  export default Welcome;
  