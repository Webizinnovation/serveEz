import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity, Image, Text, RefreshControl, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { router } from 'expo-router';
import { ChatRoom, ChatParticipant } from '../../types';
import { EmptyChat } from '../common/EmptyChat';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import DrawerModal from '../common/DrawerModal';
import { useChatStore } from '../../store/useChatStore';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo1.svg';

interface ChatMessage {
  content: string;
  created_at: string;
  sender_id: string;
  sender_type: 'user' | 'provider';
  is_read: boolean;
  type: 'text' | 'image' | 'voice' | 'file';
  file_name?: string;
  duration?: string; 
}

interface ChatRoomWithParticipant extends ChatRoom {
  participant: ChatParticipant;
  isOnline: boolean;
  unreadCount?: number;
  lastMessageTime?: string;
  lastMessageDate?: Date | null;
  formattedDate?: string | null;
  last_message?: string;
  chat_messages: ChatMessage[];
}

export default function ProviderChatList() {
  const [selectedTab, setSelectedTab] = useState<'All' | 'Unread' | 'Read'>('All');
  const [chatRooms, setChatRooms] = useState<ChatRoomWithParticipant[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const { profile } = useUserStore();
  const { setProviderUnreadCount, refreshUnreadCounts } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isDark, colors } = useTheme();

  // References for tracking app state and fetch status
  const appStateRef = useRef(AppState.currentState);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number | null>(null);
  const fetchDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const badgeScaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const notificationAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const fadeLogoAnim = useRef(new Animated.Value(0.3)).current;

  // Animation for notification dot - continuous pulse when unread messages exist
  useEffect(() => {
    // Stop any existing animation
    if (notificationAnimRef.current) {
      notificationAnimRef.current.stop();
    }

    if (totalUnread > 0) {
      // Initial attention-grabbing pulse
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Setup continuous subtle pulse animation
      const pulseSequence = Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]);

      // Create a loop
      notificationAnimRef.current = Animated.loop(pulseSequence);
      notificationAnimRef.current.start();
    }

    // Cleanup animation on unmount
    return () => {
      if (notificationAnimRef.current) {
        notificationAnimRef.current.stop();
      }
    };
  }, [totalUnread]);

  // App state change handler
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('[ProviderChatList] App state changed from', appStateRef.current, 'to', nextAppState);
    
    // Check if app is coming from background to active state
    if (
      appStateRef.current.match(/inactive|background/) && 
      nextAppState === 'active'
    ) {
      console.log('[ProviderChatList] App has come to the foreground!');
      
      // Check if we should refresh data (if last fetch was more than 30 seconds ago)
      const shouldRefresh = 
        !lastFetchTimeRef.current || 
        Date.now() - lastFetchTimeRef.current > 30000;
      
      if (shouldRefresh && !isFetchingRef.current) {
        console.log('[ProviderChatList] Refreshing data after app foregrounded');
        fetchChatRoomsDebounced();
      }
    }
    
    // Update the app state reference
    appStateRef.current = nextAppState;
  }, []);

  // Debounced fetch function to prevent multiple rapid fetches
  const fetchChatRoomsDebounced = useCallback(() => {
    // Clear any existing timeout
    if (fetchDebounceTimeoutRef.current) {
      clearTimeout(fetchDebounceTimeoutRef.current);
    }
    
    // Set a new timeout to execute the fetch after a short delay
    fetchDebounceTimeoutRef.current = setTimeout(() => {
      fetchChatRooms();
    }, 300);
  }, []);

  const setupItemAnimations = useCallback((id: string, index: number) => {
    if (!fadeAnims[id]) {
      fadeAnims[id] = new Animated.Value(0);
      scaleAnims[id] = new Animated.Value(1);
      
      Animated.timing(fadeAnims[id], {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }
    return {
      opacity: fadeAnims[id],
      transform: [{ scale: scaleAnims[id] }]
    };
  }, []);

  const setupBadgeAnimation = useCallback((id: string, unreadCount: number = 0) => {
    if (!badgeScaleAnims[id]) {
      badgeScaleAnims[id] = new Animated.Value(1);
    }
    
    if (unreadCount > 0) {
      Animated.sequence([
        Animated.timing(badgeScaleAnims[id], {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(badgeScaleAnims[id], {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    return {
      transform: [{ scale: badgeScaleAnims[id] }]
    };
  }, []);

  const handlePressIn = useCallback((id: string) => {
    Animated.spring(scaleAnims[id], {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback((id: string) => {
    Animated.spring(scaleAnims[id], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, []);

  const markMessagesAsRead = useCallback(async (chatId: string) => {
    try {
      console.log(`[ProviderChatList] Marking messages as read for chat ${chatId}`);
      
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatId)
        .eq('sender_type', 'user')
        .or('is_read.is.null,is_read.eq.false'); 
        
      if (fetchError) {
        console.error('[ProviderChatList] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[ProviderChatList] Found ${unreadMessages.length} unread messages to update`);
        
        const { error: batchUpdateError } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
          
        if (batchUpdateError) {
          console.error('[ProviderChatList] Error batch updating messages:', batchUpdateError);
          throw batchUpdateError;
        }
        
        console.log(`[ProviderChatList] Successfully batch updated ${unreadMessages.length} messages`);

        setChatRooms(prevRooms => 
          prevRooms.map(room => {
            if (room.id === chatId) {
              return {
                ...room,
                unreadCount: 0
              };
            }
            return room;
          })
        );
        
        const newTotalUnread = Math.max(0, totalUnread - (chatRooms.find(r => r.id === chatId)?.unreadCount || 0));
        setTotalUnread(newTotalUnread);
        setProviderUnreadCount(newTotalUnread);
      } else {
        console.log('[ProviderChatList] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[ProviderChatList] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'top'
      });
    }
  }, [chatRooms, totalUnread]);

  const handleChatPress = useCallback((item: ChatRoomWithParticipant) => {
    setChatRooms(prevRooms => 
      prevRooms.map(room => {
        if (room.id === item.id) {
          return {
            ...room,
            unreadCount: 0
          };
        }
        return room;
      })
    );
    
    const newTotalUnread = Math.max(0, totalUnread - (item.unreadCount || 0));
    setTotalUnread(newTotalUnread);
    setProviderUnreadCount(newTotalUnread);
    
    router.push(`/provider/chat/${item.id}?userId=${item.user_id}&role=provider`);
    
    setTimeout(() => {
      markMessagesAsRead(item.id).catch(error => {
        console.error('[ProviderChatList] Background update error:', error);
      });
    }, 200);
  }, [markMessagesAsRead, totalUnread, setProviderUnreadCount]);

  const fetchChatRooms = useCallback(async () => {
    try {
      if (!profile?.id) return;
      
      if (isFetchingRef.current) {
        console.log('[ProviderChatList] Fetch already in progress, skipping');
        return;
      }
      
      isFetchingRef.current = true;
      setLoading(true);
      
      console.log('[ProviderChatList] Fetching chat rooms for provider:', profile.id);
      
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          user:user_id (
            id,
            name,
            profile_pic
          ),
          chat_messages!chat_messages_chat_id_fkey (
            content,
            created_at,
            sender_id,
            sender_type,
            is_read,
            type,
            file_name,
            duration
          )
        `)
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      lastFetchTimeRef.current = Date.now();
      
      if (!data || data.length === 0) {
        console.log('[ProviderChatList] No chat rooms found');
        setChatRooms([]);
        setTotalUnread(0);
        setProviderUnreadCount(0);
        return;
      }
      
      console.log(`[ProviderChatList] Fetched ${data.length} chat rooms`);

      const formattedRooms = data.map(room => {
        const participant = room.user || { id: '', name: 'Unknown User', profile_pic: null, role: 'Unknown' };

        const sortedMessages = [...(room.chat_messages || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        const lastMessage = sortedMessages[0];
        const isUserMessage = lastMessage?.sender_type === 'user';
        const unreadCount = room.chat_messages?.filter(
          (msg: ChatMessage) => msg.sender_type === 'user' && !msg.is_read
        ).length || 0;
        
        let messageContent = lastMessage?.content || "Start a conversation";
        if (lastMessage?.type === 'image') {
          messageContent = "📷 Image";
          if (lastMessage.file_name) {
            messageContent += `: ${lastMessage.file_name}`;
          }
        } else if (lastMessage?.type === 'file') {
          messageContent = "📎 File";
          if (lastMessage.file_name) {
            messageContent += `: ${lastMessage.file_name}`;
          }
        } else if (lastMessage?.type === 'voice') {
          const duration = lastMessage.duration ? 
            parseInt(lastMessage.duration) / 1000 : 
            0;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
          messageContent = `🎤 Voice note (${formattedDuration})`;
        }
        
        const messageDate = lastMessage?.created_at ? new Date(lastMessage.created_at) : null;
        
        let formattedDate = null;
        if (messageDate) {
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (messageDate.toDateString() === today.toDateString()) {
            formattedDate = 'Today';
          } else if (messageDate.toDateString() === yesterday.toDateString()) {
            formattedDate = 'Yesterday';
          } else {
            formattedDate = messageDate.toLocaleDateString();
          }
        }
        
        return {
          ...room,
          participant: participant, 
          isOnline: false,
          unreadCount,
          last_message: isUserMessage ? 
            `${room.user?.name || 'Unknown User'}: ${messageContent}` : 
            messageContent,
          lastMessageTime: messageDate ? 
            messageDate.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : null,
          lastMessageDate: messageDate,
          formattedDate
        };
      });
      formattedRooms.sort((a, b) => {
        if (!a.lastMessageDate) return 1;
        if (!b.lastMessageDate) return -1;
        return b.lastMessageDate.getTime() - a.lastMessageDate.getTime();
      });

      const totalUnreadMessages = formattedRooms.reduce(
        (sum, room) => sum + (room.unreadCount || 0), 
        0
      );
      
      console.log(`[ProviderChatList] Total unread messages: ${totalUnreadMessages}`);
      setTotalUnread(totalUnreadMessages);
      setProviderUnreadCount(totalUnreadMessages);
      setChatRooms(formattedRooms);
    } catch (error) {
      console.error('[ProviderChatList] Error in fetchChatRooms:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chat rooms',
        position: 'top'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    
    fetchChatRooms();
    refreshUnreadCounts('provider', profile.id);
    
    const chatRoomsChannel = supabase
      .channel('provider_chat_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
          filter: `provider_id=eq.${profile?.id}`,
        },
        () => {
          if (!refreshing && !isFetchingRef.current) {
            fetchChatRoomsDebounced();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=in.(${chatRooms.map(room => room.id).join(',')})`,
        },
        () => {
          if (!refreshing && !isFetchingRef.current) {
            fetchChatRoomsDebounced();
          }
        }
      )
      .subscribe();

    return () => {
      if (fetchDebounceTimeoutRef.current) {
        clearTimeout(fetchDebounceTimeoutRef.current);
      }
      supabase.removeChannel(chatRoomsChannel);
    };
  }, [profile?.id, chatRooms.map(room => room.id).join(',')]);

  useEffect(() => {
    chatRooms.forEach(room => {
      if (room.unreadCount && room.unreadCount > 0) {
        setupBadgeAnimation(room.id, room.unreadCount);
      }
    });
  }, [chatRooms.map(room => room.unreadCount).join(',')]);

  const filteredChats = useMemo(() => {
    switch (selectedTab) {
      case 'Unread':
        return chatRooms.filter(chat => chat.unreadCount && chat.unreadCount > 0);
      case 'Read':
        return chatRooms.filter(chat => !chat.unreadCount || chat.unreadCount === 0);
      default:
        return chatRooms;
    }
  }, [chatRooms, selectedTab]);

  const renderHeader = useCallback(() => (
    <View style={[styles.header, isDark && { borderBottomColor: '#333' }]}>
      <View style={styles.userInfo}>
        <Image 
          source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.userAvatar}
        />
        <Text style={[styles.username, isDark && { color: colors.text }]}>Hi, {profile?.name || 'Provider'}</Text>
      </View>
      <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
        <Ionicons name="menu" size={24} color={isDark ? colors.text : "#000"} />
      </TouchableOpacity>
    </View>
  ), [profile?.profile_pic, profile?.name, isDark, colors.text]);

  const renderTab = useCallback((tab: 'All' | 'Unread' | 'Read') => (
    <TouchableOpacity 
      style={[
        styles.tabButton, 
        selectedTab === tab && styles.selectedTabButton,
        isDark && selectedTab !== tab && { backgroundColor: 'transparent' },
        isDark && selectedTab === tab && { backgroundColor: '#444' }
      ]}
      onPress={() => setSelectedTab(tab)}
    >
      <View style={styles.tabContent}>
        <Text style={[
          styles.tabText, 
          selectedTab === tab && styles.selectedTabText,
          isDark && { color: selectedTab === tab ? '#fff' : '#aaa' }
        ]}>
          {tab}
        </Text>
        {tab === 'All' && totalUnread > 0 && (
          <Animated.View 
            style={[
              styles.notificationDot,
              { transform: [{ scale: pulseAnim }] }
            ]} 
          />
        )}
      </View>
    </TouchableOpacity>
  ), [selectedTab, totalUnread, pulseAnim, isDark]);

  const renderChatItem = useCallback(({ item, index }: { item: ChatRoomWithParticipant; index: number }) => {
    const animatedStyle = setupItemAnimations(item.id, index);
    const badgeAnimStyle = setupBadgeAnimation(item.id, item.unreadCount);
    
    return (
      <TouchableOpacity
        onPress={() => handleChatPress(item)}
        onPressIn={() => handlePressIn(item.id)}
        onPressOut={() => handlePressOut(item.id)}
        activeOpacity={1}
      >
        <Animated.View style={[
          styles.chatItem, 
          animatedStyle,
          isDark && { 
            borderBottomColor: '#333',
            backgroundColor: colors.cardBackground
          }
        ]}>
          <Image 
            source={{ 
              uri: item.participant?.profile_pic || 'https://via.placeholder.com/150'
            }} 
            style={styles.avatar} 
          />
          <View style={styles.chatDetails}>
            <View style={styles.chatHeader}>
              <Text style={[styles.chatName, isDark && { color: colors.text }]}>
                {item.participant?.name || 'Unknown User'}
              </Text>
              <View style={styles.timeContainer}>
                {item.formattedDate && (
                  <Text style={[styles.dateText, isDark && { color: '#aaa' }]}>
                    {item.formattedDate}
                  </Text>
                )}
                <Text style={[styles.timeText, isDark && { color: '#aaa' }]}>
                  {item.lastMessageTime || ""}
                </Text>
              </View>
            </View>
            <View style={styles.messageContainer}>
              <Text numberOfLines={1} style={[styles.chatMessage, isDark && { color: '#aaa' }]}>
                {item.last_message || "Start a conversation"}
              </Text>
              {item.unreadCount ? (
                <Animated.View style={[
                  styles.unreadBadge,
                  badgeAnimStyle
                ]}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </Animated.View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }, [setupItemAnimations, setupBadgeAnimation, handlePressIn, handlePressOut, handleChatPress, isDark, colors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChatRooms();
    setRefreshing(false);
  }, [fetchChatRooms]);

  // Add fade in/out animation function for the loading logo
  const fadeLogoInOut = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeLogoAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      }),
      Animated.timing(fadeLogoAnim, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      })
    ]).start(() => {
      if (loading) {
        fadeLogoInOut();
      }
    });
  }, [loading, fadeLogoAnim]);

  // Start animation when loading
  useEffect(() => {
    if (loading) {
      fadeLogoInOut();
    }
    return () => {
      fadeLogoAnim.stopAnimation();
    };
  }, [loading, fadeLogoInOut]);

  // Add renderLoading function
  const renderLoading = useCallback(() => {
    if (!loading || chatRooms.length > 0) return null;
    
    return (
      <View style={[
        styles.loadingContainer,
        isDark && { backgroundColor: colors.secondaryBackground }
      ]}>
        <Animated.View style={{ 
          opacity: fadeLogoAnim,
          transform: [{
            scale: fadeLogoAnim.interpolate({
              inputRange: [0.4, 1],
              outputRange: [0.95, 1.05]
            })
          }]
        }}>
          <Logo width={80} height={80} />
        </Animated.View>
        <Text style={[
          styles.loadingText,
          isDark && { color: colors.text }
        ]}>
          Loading conversations...
        </Text>
      </View>
    );
  }, [loading, chatRooms.length, isDark, colors, fadeLogoAnim]);

  const listConfig = useMemo(() => ({
    initialNumToRender: 10,
    maxToRenderPerBatch: 10,
    windowSize: 5,
    removeClippedSubviews: true,
    onEndReachedThreshold: 0.5,
    getItemLayout: (data: any, index: number) => (
      {length: 76, offset: 76 * index, index}
    ),
  }), []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.secondaryBackground : '#fff' }]}>
      {renderHeader()}
      <View style={[styles.tabsContainer, isDark && { borderBottomColor: '#333' }]}>
        {renderTab('All')}
        {renderTab('Unread')}
        {renderTab('Read')}
      </View>
      {renderLoading()}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        ListEmptyComponent={loading ? null : <EmptyChat isDark={isDark} colors={colors} />}
        contentContainerStyle={[
          styles.listContent,
          chatRooms.length === 0 && !loading && { flex: 1, justifyContent: 'center' }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : Colors.primary}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReachedThreshold={0.5}
        getItemLayout={(data: any, index: number) => (
          {length: 76, offset: 76 * index, index}
        )}
      />
      <DrawerModal 
        isVisible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        profileImageUri={profile?.profile_pic}
        role="provider"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 20,
    marginRight: 8,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  chatItem: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatDetails: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontFamily: "Urbanist-SemiBold",
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    fontFamily: 'Urbanist-Regular',
  },
  unreadBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedTabButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
  selectedTabText: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    position: 'absolute',
    top: -2,
    right: -12,
    borderWidth: 1,
    borderColor: 'white',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontFamily: 'Urbanist-Medium',
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
}); 