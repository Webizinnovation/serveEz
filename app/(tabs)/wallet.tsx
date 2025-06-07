import React from 'react';
import { View } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { useUserStore } from '../../store/useUserStore';
import { UserWallet } from '../../components/user/UserWallet';
import { ProviderWallet } from '../../components/provider/ProviderWallet';
import { useTheme } from '../../components/ThemeProvider';

export default function WalletScreen() {
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();

  if (profile?.role === 'user') {
    return (
      <View style={[
        styles.container, 
        { backgroundColor: isDark ? colors.secondaryBackground : '#f9f9f9' }
      ]}>
        <UserWallet />
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      { backgroundColor: isDark ? colors.secondaryBackground : '#f9f9f9' }
    ]}>
      <ProviderWallet />
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
});