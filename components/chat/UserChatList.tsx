import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity, Image, Text, RefreshControl, ActivityIndicator, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { router } from 'expo-router';
import { ChatRoom, ChatParticipant } from '../../types';
import { EmptyChat } from '../common/EmptyChat';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import DrawerModal from '../common/DrawerModal';
import Toast from 'react-native-toast-message';
import { ScaledSheet } from 'react-native-size-matters';
import { useChatStore } from '../../store/useChatStore';
import { useTheme } from '../../components/ThemeProvider';

interface Provider {
  id: string;
  name: string;
  profile_pic: string | null;
  providers: Array<{ availability: boolean }>;
}

interface ChatRoomWithParticipant extends ChatRoom {
  participant: Provider;
  isOnline: boolean;
  unreadCount?: number;
  lastMessageTime: string | null;
  lastMessageDate: Date | null;
  formattedDate: string | null;
  last_message: string;
}

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

interface ChatRoomData {
  id: string;
  created_at: string;
  user_id: string;
  provider_id: string;
  provider: Provider;
  chat_messages: ChatMessage[];
}

export default function UserChatList() {
  const [selectedTab, setSelectedTab] = useState<'All' | 'Unread' | 'Read'>('All');
  const [chatRooms, setChatRooms] = useState<ChatRoomWithParticipant[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const { profile } = useUserStore();
  const { setUserUnreadCount, refreshUnreadCounts } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // Memoize animation setup functions to prevent recreating on each render
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

  // Setup badge animations
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
      console.log(`[UserChatList] Marking messages as read for chat ${chatId}`);
      
      // First, get all unread messages for this chat (including those with is_read = null)
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatId)
        .eq('sender_type', 'provider')
        .or('is_read.is.null,is_read.eq.false'); // This handles both null and false values
        
      if (fetchError) {
        console.error('[UserChatList] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[UserChatList] Found ${unreadMessages.length} unread messages to update`);
        
        // Use batch update instead of individual updates
        const { error: batchUpdateError } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
          
        if (batchUpdateError) {
          console.error('[UserChatList] Error batch updating messages:', batchUpdateError);
          throw batchUpdateError;
        }
        
        console.log(`[UserChatList] Successfully batch updated ${unreadMessages.length} messages`);

        // Update local state immediately
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
        
        // Update both local and global unread counts
        const newTotalUnread = Math.max(0, totalUnread - (chatRooms.find(r => r.id === chatId)?.unreadCount || 0));
        setTotalUnread(newTotalUnread);
        setUserUnreadCount(newTotalUnread);
      } else {
        console.log('[UserChatList] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[UserChatList] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'top'
      });
    }
  }, [chatRooms, totalUnread]);

  const handleChatPress = useCallback((chatId: string) => {
    // Find the chat room
    const chatRoom = chatRooms.find(room => room.id === chatId);
    if (!chatRoom) {
      router.push(`/chat/${chatId}`);
      return;
    }
    
    // Update local UI immediately
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
    
    // Update total unread count for UI
    const newTotalUnread = Math.max(0, totalUnread - (chatRoom.unreadCount || 0));
    setTotalUnread(newTotalUnread);
    setUserUnreadCount(newTotalUnread);
    
    // Navigate immediately without waiting
    router.push(`/chat/${chatId}`);
    
    // Mark messages as read in the background after navigation
    setTimeout(() => {
      markMessagesAsRead(chatId).catch(error => {
        console.error('[UserChatList] Background update error:', error);
      });
    }, 200);
  }, [chatRooms, markMessagesAsRead, totalUnread, setUserUnreadCount]);

  // App state change handler
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('[UserChatList] App state changed from', appStateRef.current, 'to', nextAppState);
    
    // Check if app is coming from background to active state
    if (
      appStateRef.current.match(/inactive|background/) && 
      nextAppState === 'active'
    ) {
      console.log('[UserChatList] App has come to the foreground!');
      
      // Check if we should refresh data (if last fetch was more than 30 seconds ago)
      const shouldRefresh = 
        !lastFetchTimeRef.current || 
        Date.now() - lastFetchTimeRef.current > 30000;
      
      if (shouldRefresh && !isFetchingRef.current) {
        console.log('[UserChatList] Refreshing data after app foregrounded');
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

  const fetchChatRooms = useCallback(async () => {
    if (!profile?.id) return;

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('[UserChatList] Fetch already in progress, skipping');
      return;
    }

    try {
      isFetchingRef.current = true;
      console.log('[UserChatList] Fetching chat rooms for user:', profile.id);
      
      const { data: rawData, error } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          created_at,
          user_id,
          provider_id,
          provider:provider_id (
            id,
            name,
            profile_pic,
            providers (availability)
          ),
          chat_messages!chat_messages_chat_id_fkey (
            id,
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
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update last fetch timestamp
      lastFetchTimeRef.current = Date.now();
      
      if (!rawData || rawData.length === 0) {
        console.log('[UserChatList] No chat rooms found');
        setChatRooms([]);
        setTotalUnread(0);
        setUserUnreadCount(0);
        return;
      }

      console.log(`[UserChatList] Fetched ${rawData.length} chat rooms`);

      const data = rawData.map(room => ({
        ...room,
        provider: Array.isArray(room.provider) ? room.provider[0] : room.provider
      }));

      // Process and format chat rooms more efficiently
      const formattedRooms: ChatRoomWithParticipant[] = data.map(room => {
        // Sort messages to ensure we have the latest one
        const sortedMessages = [...(room.chat_messages || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        const lastMessage = sortedMessages[0];
        const isProviderMessage = lastMessage?.sender_type === 'provider';
        const unreadCount = room.chat_messages?.filter(
          msg => msg.sender_type === 'provider' && !msg.is_read
        ).length || 0;
        
        // Format the last message content based on message type
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
            parseInt(lastMessage.duration) / 1000 : // Convert to seconds
            0;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
          messageContent = `🎤 Voice note (${formattedDuration})`;
        }
        
        // Create date object for the last message
        const messageDate = lastMessage?.created_at ? new Date(lastMessage.created_at) : null;
        
        // Format the date string
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
            // Format date as MM/DD/YYYY for older messages
            formattedDate = messageDate.toLocaleDateString();
          }
        }
        
        return {
          id: room.id,
          user_id: room.user_id,
          provider_id: room.provider_id,
          participant: room.provider,
          isOnline: room.provider.providers?.[0]?.availability || false,
          unreadCount,
          last_message: isProviderMessage && lastMessage ? 
            `${room.provider.name}: ${messageContent}` : 
            messageContent,
          lastMessageTime: messageDate ? 
            messageDate.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : null,
          lastMessageDate: messageDate,
          formattedDate: formattedDate
        };
      });

      // Sort messages by last message date (most recent first)
      formattedRooms.sort((a, b) => {
        if (!a.lastMessageDate) return 1;
        if (!b.lastMessageDate) return -1;
        return b.lastMessageDate.getTime() - a.lastMessageDate.getTime();
      });

      const totalUnreadMessages = formattedRooms.reduce(
        (sum, room) => sum + (room.unreadCount || 0), 
        0
      );
      
      console.log(`[UserChatList] Total unread messages: ${totalUnreadMessages}`);
      setTotalUnread(totalUnreadMessages);
      setUserUnreadCount(totalUnreadMessages);
      setChatRooms(formattedRooms);
    } catch (error) {
      console.error('[UserChatList] Error fetching chat rooms:', error);
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
    // Call refreshUnreadCounts to ensure the notification dot is accurate
    refreshUnreadCounts('user', profile.id);
    
    // Subscribe to both chat_rooms and chat_messages changes
    const chatRoomsChannel = supabase
      .channel('chat_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
          filter: `user_id=eq.${profile?.id}`,
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

  // Update badge animations when unread counts change
  useEffect(() => {
    chatRooms.forEach(room => {
      if (room.unreadCount && room.unreadCount > 0) {
        setupBadgeAnimation(room.id, room.unreadCount);
      }
    });
  }, [chatRooms.map(room => room.unreadCount).join(',')]);

  // Memoize filtered chats to prevent unnecessary recalculations
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
    <View style={[
      styles.header,
      isDark && {
        backgroundColor: colors.cardBackground,
        borderBottomColor: colors.border
      }
    ]}>
      <View style={styles.userInfo}>
        <Image 
          source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.userAvatar}
        />
        <Text style={[
          styles.username,
          isDark && { color: colors.text }
        ]}>Hi, {profile?.name || 'User'}</Text>
      </View>
      <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
        <Ionicons name="menu" size={24} color={isDark ? colors.text : "#000"} />
      </TouchableOpacity>
    </View>
  ), [profile?.profile_pic, profile?.name, isDark, colors]);

  const renderTab = useCallback((tab: 'All' | 'Unread' | 'Read') => (
    <TouchableOpacity 
      style={[
        styles.tabButton, 
        selectedTab === tab && styles.selectedTabButton,
        isDark && {
          borderColor: colors.border
        },
        selectedTab === tab && isDark && {
          backgroundColor: colors.tint
        }
      ]}
      onPress={() => setSelectedTab(tab)}
    >
      <View style={styles.tabContent}>
        <Text style={[
          styles.tabText, 
          selectedTab === tab && styles.selectedTabText,
          isDark && { color: colors.subtext },
          selectedTab === tab && isDark && { color: '#fff' }
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
  ), [selectedTab, totalUnread, pulseAnim, isDark, colors]);

  // Memoize the renderChatItem function to prevent recreating for each render
  const renderChatItem = useCallback(({ item, index }: { item: ChatRoomWithParticipant; index: number }) => {
    const animatedStyle = setupItemAnimations(item.id, index);
    const badgeAnimStyle = setupBadgeAnimation(item.id, item.unreadCount);
    
    return (
      <TouchableOpacity
        onPress={() => handleChatPress(item.id)}
        onPressIn={() => handlePressIn(item.id)}
        onPressOut={() => handlePressOut(item.id)}
        activeOpacity={1}
      >
        <Animated.View style={[
          styles.chatItem, 
          animatedStyle,
          isDark && {
            backgroundColor: colors.cardBackground,
            borderBottomColor: colors.border,
            borderBottomWidth: 1
          }
        ]}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ 
                uri: item.participant?.profile_pic || 'https://via.placeholder.com/150'
              }} 
              style={styles.avatar} 
            />
            <View style={[
              styles.onlineIndicator,
              !item.isOnline && styles.offlineIndicator
            ]} />
          </View>
          <View style={styles.chatDetails}>
            <View style={styles.chatHeader}>
              <Text style={[
                styles.chatName,
                isDark && { color: colors.text }
              ]}>{item.participant?.name}</Text>
              <View style={styles.timeContainer}>
                {item.formattedDate && (
                  <Text style={[
                    styles.dateText,
                    isDark && { color: colors.subtext }
                  ]}>
                    {item.formattedDate}
                  </Text>
                )}
                <Text style={[
                  styles.timeText,
                  isDark && { color: colors.subtext }
                ]}>
                  {item.lastMessageTime || ""}
                </Text>
              </View>
            </View>
            <View style={styles.messageContainer}>
              <Text numberOfLines={1} style={[
                styles.chatMessage,
                isDark && { color: colors.subtext }
              ]}>
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChatRooms();
  }, [fetchChatRooms]);

  const renderLoadingSkeleton = () => (
    <View style={[
      styles.loadingContainer,
      isDark && { backgroundColor: colors.background }
    ]}>
      {[1, 2, 3].map((key) => (
        <View key={key} style={[
          styles.skeletonItem,
          isDark && { backgroundColor: colors.cardBackground }
        ]}>
          <View style={[
            styles.skeletonAvatar,
            isDark && { backgroundColor: colors.border }
          ]} />
          <View style={styles.skeletonContent}>
            <View style={[
              styles.skeletonLine,
              isDark && { backgroundColor: colors.border }
            ]} />
            <View style={[
              styles.skeletonLine, 
              { width: '60%' },
              isDark && { backgroundColor: colors.border }
            ]} />
          </View>
        </View>
      ))}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[
        styles.container,
        isDark && { backgroundColor: colors.background }
      ]}>
        {renderHeader()}
        <View style={[
          styles.tabsContainer,
          isDark && { borderBottomColor: colors.border }
        ]}>
          {renderTab('All')}
          {renderTab('Unread')}
          {renderTab('Read')}
        </View>
        {renderLoadingSkeleton()}
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      {renderHeader()}
      <View style={[
        styles.tabsContainer,
        isDark && { borderBottomColor: colors.border }
      ]}>
        {renderTab('All')}
        {renderTab('Unread')}
        {renderTab('Read')}
      </View>
      {loading && !refreshing ? (
        renderLoadingSkeleton()
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListEmptyComponent={<EmptyChat isDark={isDark} colors={colors} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? colors.tint : Colors.primary}
              colors={[isDark ? colors.tint : Colors.primary]}
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          onEndReachedThreshold={0.5}
          getItemLayout={(data, index) => (
            {length: 82, offset: 82 * index, index}
          )}
        />
      )}
      <DrawerModal 
        isVisible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        profileImageUri={profile?.profile_pic}
        role="user"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 14,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  selectedTabText: {
    color: '#fff',
    fontFamily: 'Urbanist-Bold',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  offlineIndicator: {
    backgroundColor: '#999',
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
    fontFamily: 'Urbanist-Bold',
    color: '#000',
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
    backgroundColor: Colors.primary,
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
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
  },
  skeletonAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E9EE',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#E1E9EE',
    borderRadius: 6,
    marginBottom: 8,
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
  },
}); 