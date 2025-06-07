import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../components/ThemeProvider';

export default function AllTransactions() {
  const { profile } = useUserStore();
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;
  const { isDark, colors } = useTheme();
  
  // Get screen dimensions for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenHeight < 700;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} at ${date.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  };

  const fetchTransactions = async (pageNumber = 1, shouldRefresh = false) => {
    try {
      setLoading(true);
      const start = (pageNumber - 1) * ITEMS_PER_PAGE;
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .range(start, start + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      if (shouldRefresh) {
        setTransactions(data || []);
      } else {
        setTransactions(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
      setPage(pageNumber);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions(1, true);
  }, []);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(page + 1);
    }
  };

  useEffect(() => {
    fetchTransactions(1, true);
  }, []);

  const handleTransactionPress = (transaction: any) => {
    // Navigate to transaction details page
    router.push({
      pathname: '/transactions/[id]',
      params: { id: transaction.id }
    });
  };

  const renderTransactionItem = ({ item: transaction }: { item: any }) => (
    <TouchableOpacity 
      style={[
        styles.transactionItem,
        isDark && {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          borderWidth: 1
        },
        isSmallDevice && { 
          paddingVertical: 10,
          paddingHorizontal: 12
        }
      ]}
      onPress={() => handleTransactionPress(transaction)}
    >
      {transaction.status === 'failed' ? (
        <Ionicons 
          name="close-circle" 
          size={24} 
          color="#D32F2F" 
        />
      ) : (
        <Ionicons 
          name={transaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
          size={24} 
          color={transaction.type === 'deposit' ? 'green' : 'red'} 
        />
      )}
      <View style={styles.transactionDetails}>
        <Text style={[
          styles.transactionName,
          isDark && { color: colors.text }
        ]}>
          {transaction.status === 'failed' 
            ? `Failed ${transaction.type === 'deposit' ? 'Deposit' : transaction.type === 'withdrawal' ? 'Withdrawal' : 'Payment'}`
            : transaction.type === 'deposit' 
              ? `Deposit via ${transaction.metadata?.payment_method || 'Paystack'}`
              : transaction.type === 'payment'
                ? `Payment to ${transaction.metadata?.provider_name || 'Provider'}`
                : `Transfer to ${transaction.metadata?.bank_name || 'Bank'}${
                  transaction.metadata?.account_name ? ` - ${transaction.metadata.account_name}` : ''
                }`
          }
        </Text>
        <Text style={[
          styles.transactionDate,
          isDark && { color: colors.subtext }
        ]}>
          {formatDate(transaction.created_at)}
        </Text>
        {transaction.metadata?.service && (
          <Text style={[
            styles.serviceText,
            isDark && { color: colors.tint }
          ]}>
            Service: {transaction.metadata.service}
          </Text>
        )}
      </View>
      <View style={styles.amountContainer}>
        <Text style={[
          styles.transactionAmount,
          { 
            color: transaction.status === 'failed' ? '#D32F2F' :
                    transaction.type === 'deposit' ? 'green' : 'red' 
          }
        ]}>
          {transaction.status === 'failed' ? 'x' : 
           transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
        </Text>
        <Text style={[
          styles.statusText,
          { 
            color: transaction.status === 'completed' ? 'green' : 
                   transaction.status === 'failed' ? '#D32F2F' : 'orange' 
          }
        ]}>
          {transaction.status.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={isDark ? colors.tint : Colors.primary} />
      </View>
    );
  };

  return (
    <View style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'All Transactions',
          headerStyle: {
            backgroundColor: isDark ? colors.cardBackground : '#fff',
          },
          headerTitleStyle: [
            styles.headerTitle,
            isDark && { color: colors.text }
          ],
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#333"} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <FlatList
        data={transactions}
        renderItem={renderTransactionItem}
        keyExtractor={item => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={isDark ? colors.tint : Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={[
            styles.emptyState,
            isDark && { 
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
              borderWidth: 1,
              marginTop: 20
            }
          ]}>
            <Ionicons name="receipt-outline" size={48} color={isDark ? colors.inactive : "#ccc"} />
            <Text style={[
              styles.emptyTitle,
              isDark && { color: colors.text }
            ]}>No Transactions Yet</Text>
            <Text style={[
              styles.emptyText,
              isDark && { color: colors.subtext }
            ]}>
              Your transaction history will appear here once you make or receive payments
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: '16@ms',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '12@ms',
    marginHorizontal: '10@ms',
    marginVertical: '4@ms',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  transactionDetails: {
    flex: 1,
    paddingLeft: '8@ms',
  },
  transactionName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  transactionDate: {
    fontSize: '12@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginTop: '2@ms',
  },
  serviceText: {
    fontSize: '12@ms',
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginTop: '2@ms',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '2@ms',
  },
  statusText: {
    fontSize: '10@ms',
    fontFamily: 'Urbanist-Medium',
  },
  footerLoader: {
    paddingVertical: '16@ms',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24@ms',
    marginTop: '40@ms',
    borderRadius: '16@ms',
    marginHorizontal: '16@ms',
  },
  emptyTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '12@ms',
    marginBottom: '4@ms',
  },
  emptyText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: '20@ms',
  },
}); 