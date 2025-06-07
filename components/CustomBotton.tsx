import { StyleSheet, Text, TouchableOpacity, Dimensions, Platform, View } from "react-native";
import React from "react";
import { Colors } from "../constants/Colors";

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375;
const isLargeDevice = width >= 768;

interface CustomButtonProps {
  title: string;
  containerStyle?: any;
  handlePress: () => void;
  textStyles?: any;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const CustomButton = ({
  title,
  containerStyle,
  handlePress,
  textStyles,
  isLoading,
  leftIcon,
  rightIcon,
}: CustomButtonProps) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`${isLoading ? "opacity-50" : ""}`}
      style={[styles.container, containerStyle]}
      disabled={isLoading}
    >
      <View style={styles.buttonContent}>
        {leftIcon}
        <Text style={[styles.buttonText, textStyles]}>{title}</Text>
        {rightIcon}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: isSmallDevice ? 20 : isLargeDevice ? 30 : 25,
    padding: isSmallDevice ? 8 : isLargeDevice ? 12 : 10,
    width: "100%",
  },
  buttonText: {
    color: "white",
    fontSize: isSmallDevice ? 16 : isLargeDevice ? 20 : 18,
    fontFamily: "Urbanist-Bold",
    paddingVertical: Platform.OS === 'ios' ? height * 0.005 : 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default CustomButton;
