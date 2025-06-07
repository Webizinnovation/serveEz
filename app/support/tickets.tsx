import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, AntDesign } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { SupportTicket, getUserSupportTickets } from '../../services/supportChat';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';

export default function SupportTicketsScreen() {
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
  };

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = async () => {
    if (!profile?.id) return;
    
    try {
      const userTickets = await getUserSupportTickets(profile.id);
      setTickets(userTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [profile?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleCreateTicket = () => {
    router.push('/support/new-ticket');
  };

  const handleTicketPress = (ticket: SupportTicket) => {
    router.push({
      pathname: '/support/chat',
      params: { ticketId: ticket.id }
    });
  };

  const renderStatusBadge = (status: string) => {
    let color = '';
    let bgColor = '';
    let icon = '';
    
    switch (status) {
      case 'open':
        color = isDark ? '#A5D6A7' : '#2E7D32';
        bgColor = isDark ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.1)';
        icon = 'envelope-open-text';
        break;
      case 'in_progress':
        color = isDark ? '#90CAF9' : '#1976D2';
        bgColor = isDark ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)';
        icon = 'chat-processing';
        break;
      case 'resolved':
        color = isDark ? '#CE93D8' : '#7B1FA2';
        bgColor = isDark ? 'rgba(123, 31, 162, 0.2)' : 'rgba(123, 31, 162, 0.1)';
        icon = 'check-circle';
        break;
      case 'closed':
        color = isDark ? '#EF9A9A' : '#C62828';
        bgColor = isDark ? 'rgba(198, 40, 40, 0.2)' : 'rgba(198, 40, 40, 0.1)';
        icon = 'archive';
        break;
      default:
        color = isDark ? '#E0E0E0' : '#757575';
        bgColor = isDark ? 'rgba(117, 117, 117, 0.2)' : 'rgba(117, 117, 117, 0.1)';
        icon = 'information';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderEmptyList = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={extendedColors.tint} size="large" />
        </View>
      );
    }

    return (
      <Animated.View entering={FadeIn.duration(800)} style={styles.emptyContainer}>
        <LinearGradient
          colors={[extendedColors.gradientStart, extendedColors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyIconBackground}
        >
          <MaterialIcons name="support" size={50} color="white" />
        </LinearGradient>
        <Text style={[styles.emptyTitle, { color: extendedColors.text }]}>No Support Tickets</Text>
        <Text style={[styles.emptyText, { color: extendedColors.subtext }]}>
          You don't have any active support tickets. Tap the button below to create a new ticket.
        </Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: extendedColors.tint }]}
          onPress={handleCreateTicket}
        >
          <Text style={styles.createButtonText}>Create New Ticket</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTicketItem = ({ item, index }: { item: SupportTicket, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <TouchableOpacity
        style={[styles.ticketItem, { backgroundColor: extendedColors.cardBackground }]}
        onPress={() => handleTicketPress(item)}
      >
        <View style={styles.ticketHeader}>
          <Text style={[styles.ticketTitle, { color: extendedColors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {renderStatusBadge(item.status)}
        </View>
        
        <View style={styles.ticketDetails}>
          <View style={styles.ticketMeta}>
            <MaterialIcons 
              name="label" 
              size={16} 
              color={isDark ? extendedColors.subtext : '#666'} 
              style={styles.metaIcon} 
            />
            <Text style={[styles.metaText, { color: extendedColors.subtext }]}>
              {item.issue_type}
            </Text>
          </View>
          
          <View style={styles.ticketMeta}>
            <MaterialIcons 
              name="access-time" 
              size={16} 
              color={isDark ? extendedColors.subtext : '#666'} 
              style={styles.metaIcon} 
            />
            <Text style={[styles.metaText, { color: extendedColors.subtext }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
        
        <View style={styles.ticketFooter}>
          <Text style={[styles.viewDetails, { color: extendedColors.tint }]}>
            View Conversation
          </Text>
          <AntDesign name="right" size={16} color={extendedColors.tint} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: extendedColors.background }]}>
      <View style={[styles.header, { backgroundColor: extendedColors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={extendedColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: extendedColors.text }]}>Support Tickets</Text>
        <TouchableOpacity onPress={handleCreateTicket} style={styles.createTicketButton}>
          <AntDesign name="plus" size={24} color={extendedColors.tint} />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.statsBar, { backgroundColor: extendedColors.cardBackground }]}>
        <Text style={[styles.statsText, { color: extendedColors.text }]}>
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} found
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={[styles.refreshText, { color: extendedColors.tint }]}>Refresh</Text>
          <Ionicons name="refresh" size={16} color={extendedColors.tint} style={styles.refreshIcon} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={renderTicketItem}
        contentContainerStyle={[
          styles.listContent,
          tickets.length === 0 && styles.emptyListContent
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[extendedColors.tint]}
            tintColor={extendedColors.tint}
          />
        }
        ListEmptyComponent={renderEmptyList}
      />
      
      {!loading && tickets.length > 0 && (
        <TouchableOpacity 
          style={[styles.floatingButton, { backgroundColor: extendedColors.tint }]}
          onPress={handleCreateTicket}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
      )}
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
  createTicketButton: {
    padding: '8@s',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: '10@s',
    paddingHorizontal: '16@s',
    borderBottomWidth: '1@s',
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: '8@s',
  },
  statsText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
  },
  refreshIcon: {
    marginLeft: '4@s',
  },
  listContent: {
    paddingHorizontal: '16@s',
    paddingTop: '4@s',
    paddingBottom: '24@s',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  ticketItem: {
    borderRadius: '16@s',
    marginBottom: '12@s',
    padding: '16@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10@s',
  },
  ticketTitle: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    flex: 1,
    marginRight: '8@s',
  },
  statusBadge: {
    paddingHorizontal: '8@s',
    paddingVertical: '4@s',
    borderRadius: '6@s',
  },
  statusText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-SemiBold',
  },
  ticketDetails: {
    flexDirection: 'row',
    marginBottom: '12@s',
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: '16@s',
  },
  metaIcon: {
    marginRight: '4@s',
  },
  metaText: {
    fontSize: '13@s',
    fontFamily: 'Urbanist-Medium',
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  viewDetails: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
    marginRight: '4@s',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '24@s',
  },
  emptyIconBackground: {
    width: '100@s',
    height: '100@s',
    borderRadius: '50@s',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20@s',
  },
  emptyTitle: {
    fontSize: '20@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
  },
  emptyText: {
    fontSize: '15@s',
    fontFamily: 'Urbanist-Regular',
    textAlign: 'center',
    marginBottom: '24@s',
    lineHeight: '22@s',
  },
  createButton: {
    paddingVertical: '12@s',
    paddingHorizontal: '24@s',
    borderRadius: '30@s',
  },
  createButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  floatingButton: {
    position: 'absolute',
    bottom: '20@s',
    right: '20@s',
    width: '56@s',
    height: '56@s',
    borderRadius: '28@s',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
}); 