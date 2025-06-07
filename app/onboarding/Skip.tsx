import { Animated, StyleSheet, View, Text, Dimensions, Platform, useColorScheme } from "react-native";
import React from "react";
import { Colors } from "../../constants/Colors";
import { SafeAreaView } from "react-native-safe-area-context";
import ScrollView = Animated.ScrollView;
import { Link, useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Logo from "../../assets/images/Svg/logo1.svg";
import Logo2 from "../../assets/images/Svg/Illustr--Man with tools.svg";
import Logo3 from "../../assets/images/Svg/Page indicator.svg";

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375;
const isLargeDevice = width >= 768;

export default function App() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    // useEffect(() => {
    //   setTimeout(() => {
    //     router.push("/onboarding/getStarted");
    //   }, 7000);
    // }, []);

    return (
        <SafeAreaView style={[styles.container, isDark && { backgroundColor: '#121212' }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                overScrollMode={"auto"}
            >
                <View style={styles.navigationContainer}>
                    <View>
                        <Link
                            href={"/onboarding/Welcome"}
                            style={[styles.navLink, isDark && { color: '#F58220' }]}
                        >
                            <AntDesign name="left" size={18} color={isDark ? '#F58220' : Colors.primary} /> Back
                        </Link>
                    </View>

                    <Link
                        dismissTo
                        href={"/onboarding/getStarted"}
                        style={[styles.navLink, isDark && { color: '#F58220' }]}
                    >
                        Skip
                        <AntDesign name="right" size={18} color={isDark ? '#F58220' : Colors.primary} />
                    </Link>
                </View>
                <View style={styles.contentContainer}>
                    <Logo width={isSmallDevice ? 65 : 77} height={isSmallDevice ? 65 : 77} />
                    <View style={styles.illustrationContainer}>
                        <Logo2 
                            width={isSmallDevice ? 240 : isLargeDevice ? 350 : 280.08} 
                            height={isSmallDevice ? 280 : isLargeDevice ? 400 : 329.6} 
                        />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={[styles.welcomeText, isDark && { color: '#F58220' }]}>
                            Welcome to serve<Text style={styles.highlightText}>ez</Text>
                        </Text>
                        <View style={styles.indicatorContainer}>
                            <Logo3 />
                        </View>
                        <Text style={[styles.descriptionText, isDark && { color: '#E0E0E0' }]}>
                            Book with us from anywhere, anytime. We'll take care of the
                            rest.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContent: {
        minHeight: "100%",
    },
    navigationContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: Platform.OS === 'ios' ? height * 0.02 : height * 0.03,
        paddingHorizontal: width * 0.05,
        marginBottom: height * 0.02,
    },
    navLink: {
        color: Colors.primary,
        fontSize: isSmallDevice ? 15 : 17,
        fontFamily: "Urbanist-SemiBold",
        padding: 10,
    },
    contentContainer: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: width * 0.05,
    },
    illustrationContainer: {
        marginTop: height * 0.03,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        alignItems: "center",
        width: "100%",
        maxWidth: 500,
        paddingHorizontal: width * 0.05,
    },
    welcomeText: {
        fontFamily: "Urbanist-Bold",
        fontSize: isSmallDevice ? 15 : isLargeDevice ? 20 : 17,
        textAlign: "center",
        paddingTop: height * 0.03,
        paddingBottom: height * 0.01,
        color: Colors.primary,
    },
    highlightText: { 
        color: "#F58220" 
    },
    indicatorContainer: {
        flexDirection: "row-reverse",
        justifyContent: "center",
        alignItems: "center",
        marginTop: height * 0.01,
        marginBottom: height * 0.02,
        gap: 7,
    },
    descriptionText: {
        fontFamily: "Urbanist-Regular",
        fontSize: isSmallDevice ? 13 : isLargeDevice ? 18 : 15,
        textAlign: "center",
        paddingTop: height * 0.02,
        width: "90%",
    },
});
