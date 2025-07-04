import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator, Animated, Easing, Dimensions, Platform, AppState, AppStateStatus, KeyboardAvoidingView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useLocalSearchParams, router } from 'expo-router';
import { Message, FileUpload } from '../../types/index';
import { ChatMessage } from '../common/ChatMessage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useChatStore } from '../../store/useChatStore';
import Toast from 'react-native-toast-message';
import * as ImageManipulator from 'expo-image-manipulator';
import { VoiceRecorder } from '../common/VoiceRecorder';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo1.svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { sendChatMessageNotification } from '../../services/pushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define screen size constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 360;

// Add after the screen width constants
const ESTIMATED_ITEM_HEIGHT = 100; // Average height of a message item in pixels

// Modify the debounce utility function to make it more responsive for the send button
const debounce = (func: Function, wait: number, immediate = false) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const callNow = immediate && !timeout;
    const later = () => {
      timeout = null as unknown as NodeJS.Timeout;
      if (!immediate) func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
};

export default function ProviderChatRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const MESSAGES_PER_PAGE = 20;
  const { profile } = useUserStore();
  const { id: chatRoomId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const { setProviderUnreadCount } = useChatStore();
  const initialMarkReadDone = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const { isDark, colors } = useTheme();
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  const [isSending, setIsSending] = useState(false);
  const sendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // App state tracking
  const appStateRef = useRef(AppState.currentState);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number | null>(null);
  const fetchDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesCache = useRef<{[key: string]: Message[]}>({});
  const isDataStaleRef = useRef(false);

  const messagesData = useMemo(() => messages, [messages]);
  
  const markMessagesAsReadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // App state change handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[ProviderChatRoom] App state changed from', appStateRef.current, 'to', nextAppState);
      
      // Check if app is coming from background to active state
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('[ProviderChatRoom] App has come to the foreground!');
        isDataStaleRef.current = true;
        refreshData();
      }
      
      // Update the app state reference
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Add an explicit declaration at the top for the fetchMessages function
  const fetchMessages = useCallback(async (loadMore = false, silentRefresh = false) => {
    // Skip if already fetching
    if (isFetchingRef.current) return;
    
    try {
      // Set loading states
      isFetchingRef.current = true;
      if (!silentRefresh) {
        if (loadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
      }
      
      // Update last fetch time
      lastFetchTimeRef.current = Date.now();
      
      if ((!loadMore && !hasMore) || !chatRoomId) return;
      
      const currentPage = loadMore ? page + 1 : 0;
      
      // Check cache first for initial page
      const cacheKey = `${chatRoomId}_page_${currentPage}`;
      if (!loadMore && messagesCache.current[cacheKey] && messagesCache.current[cacheKey].length > 0) {
        console.log('[ProviderChatRoom] Using cached messages for initial page');
        setMessages(messagesCache.current[cacheKey]);
        setHasMore(messagesCache.current[cacheKey].length >= MESSAGES_PER_PAGE);
        
        // Still update lastFetchTime to track when we last checked
        lastFetchTimeRef.current = Date.now();
        
        // We'll still make a background fetch to ensure cache is fresh
        setTimeout(() => {
          refreshCacheInBackground(currentPage);
        }, 300);
        
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      console.log(`[ProviderChatRoom] Fetching messages page ${currentPage} for chat ${chatRoomId}`);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatRoomId)
        .order('created_at', { ascending: false })
        .range(currentPage * MESSAGES_PER_PAGE, (currentPage + 1) * MESSAGES_PER_PAGE - 1);

      if (error) {
        console.error('[ProviderChatRoom] Error fetching messages:', error);
        return;
      }

      // Update lastFetchTime
      lastFetchTimeRef.current = Date.now();

      if (data) {
        // Transform messages once before setting state to reduce work
        const transformedData = data.map(msg => ({
          ...msg,
          // Add any transformations needed here in one pass
        }));
        
        // Update cache
        messagesCache.current[cacheKey] = transformedData;
        
        setMessages(prev => {
          if (loadMore) {
            // Filter out duplicates when loading more
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = transformedData.filter(m => !existingIds.has(m.id));
            return [...prev, ...newMessages];
          }
          return transformedData;
        });
        
        setHasMore(data.length === MESSAGES_PER_PAGE);
        setPage(currentPage);
        
        // Check if there are unread messages from the user in the newly loaded messages
        const hasUnreadUserMessages = data.some(
          msg => msg.sender_type === 'user' && !msg.is_read
        );
        
        if (hasUnreadUserMessages && !loadMore) {
          // Only auto-mark messages as read on initial load, not when loading more
          console.log('[ProviderChatRoom] Detected unread messages in newly loaded data');
          setTimeout(() => {
            if (markMessagesAsReadRef.current) {
              markMessagesAsReadRef.current();
            }
          }, 300); // Reduced from 500ms to 300ms for faster response
        }
      }
    } catch (error) {
      console.error('[ProviderChatRoom] Error in fetchMessages:', error);
    } finally {
      // Reset loading states
      isFetchingRef.current = false;
      if (!silentRefresh) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [chatRoomId, hasMore, page, MESSAGES_PER_PAGE]);

  // Also define this function here to avoid reference issues
  const fetchUserDetails = useCallback(async () => {
    try {
      if (!profile || !profile.id) {
        return;
      }
      
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          user:user_id (
            id,
            name,
            profile_pic,
            role
          )
        `)
        .eq('id', chatRoomId)
        .eq('provider_id', profile?.id)
        .single();

      if (error) {
        return;
      }
      
      if (data?.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('[ProviderChatRoom] Error fetching user details:', error);
    }
  }, [profile, chatRoomId]);

  // Define refreshData after fetchMessages is defined
  const refreshData = useCallback(() => {
    if (isDataStaleRef.current && !isFetchingRef.current) {
      console.log('[ProviderChatRoom] Refreshing data after app foregrounded');
      fetchMessages(false, true);
      isDataStaleRef.current = false;
    }
  }, [fetchMessages]);

  // Debounced fetch function to prevent multiple rapid fetches
  const fetchMessagesDebounced = useCallback(() => {
    // Clear any existing timeout
    if (fetchDebounceTimeoutRef.current) {
      clearTimeout(fetchDebounceTimeoutRef.current);
    }
    
    // Set a new timeout to execute the fetch after a short delay
    fetchDebounceTimeoutRef.current = setTimeout(() => {
      fetchMessages();
    }, 300);
  }, [fetchMessages]);

  // Add the refreshCacheInBackground function right after fetchMessagesDebounced
  // Function to refresh cache in background without UI updates
  const refreshCacheInBackground = async (pageNumber: number) => {
    try {
      const cacheKey = `${chatRoomId}_page_${pageNumber}`;
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatRoomId)
        .order('created_at', { ascending: false })
        .range(pageNumber * MESSAGES_PER_PAGE, (pageNumber + 1) * MESSAGES_PER_PAGE - 1);
        
      if (error) throw error;
      
      if (data) {
        // Update cache with fresh data
        messagesCache.current[cacheKey] = data;
        
        // Check if we need to update the displayed messages (if this is the current page)
        if (pageNumber === page) {
          // Compare with current messages to see if an update is needed
          const currentMessagesIds = new Set(messages.map(m => m.id));
          const freshMessagesIds = new Set(data.map(m => m.id));
          
          // Check for differences
          const needsUpdate = data.length !== messages.length || 
            data.some(m => !currentMessagesIds.has(m.id)) ||
            messages.some(m => !freshMessagesIds.has(m.id));
            
          if (needsUpdate) {
            console.log('[ProviderChatRoom] Background refresh detected changes, updating UI');
            setMessages(data);
          }
        }
      }
    } catch (error) {
      console.error('[ProviderChatRoom] Error in background cache refresh:', error);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && !isFetchingRef.current) {
      fetchMessages(true);
    }
  }, [isLoading, hasMore, fetchMessages, isFetchingRef]);

  // Mark messages as read function - defined separately
  const markMessagesAsRead = useCallback(async () => {
    try {
      if (isMarkingRead) return;
      setIsMarkingRead(true);
      
      console.log(`[ProviderChatRoom] Attempting to mark messages as read for chat ${chatRoomId}`);
      
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatRoomId)
        .eq('sender_type', 'user')
        .or('is_read.is.null,is_read.eq.false');
        
      if (fetchError) {
        console.error('[ProviderChatRoom] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[ProviderChatRoom] Found ${unreadMessages.length} unread messages to update`);
        
        // Batch update all messages
        const { error: batchUpdateError } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
          
        if (batchUpdateError) {
          console.error('[ProviderChatRoom] Batch update failed, falling back to individual updates');
          // Fall back to individual updates
          for (const msg of unreadMessages) {
            const { error: singleUpdateError } = await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', msg.id);
              
            if (singleUpdateError) {
              console.error(`[ProviderChatRoom] Error updating message ${msg.id}:`, singleUpdateError);
            } else {
              console.log(`[ProviderChatRoom] Successfully marked message ${msg.id} as read`);
            }
          }
        } else {
          console.log(`[ProviderChatRoom] Successfully batch updated ${unreadMessages.length} messages`);
        }
        
  
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update messages locally to reflect read status
        setMessages(prev => 
          prev.map(msg => 
            msg.sender_type === 'user' && !msg.is_read 
              ? { ...msg, is_read: true } 
              : msg
          )
        );
        
        // Invalidate cache for current page
        if (messagesCache.current[`${chatRoomId}_page_${page}`]) {
          messagesCache.current[`${chatRoomId}_page_${page}`] = 
            messagesCache.current[`${chatRoomId}_page_${page}`].map(msg => 
              msg.sender_type === 'user' && !msg.is_read 
                ? { ...msg, is_read: true } 
                : msg
            );
        }
        
        // Update global unread count
        const { count: totalUnread } = await supabase
          .from('chat_messages')
          .select('count', { count: 'exact', head: true })
          .eq('sender_type', 'user')
          .eq('is_read', false);
          
        if (totalUnread !== null) {
          console.log(`[ProviderChatRoom] Updating provider unread count to ${totalUnread}`);
          setProviderUnreadCount(totalUnread || 0);
        }
      } else {
        console.log('[ProviderChatRoom] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[ProviderChatRoom] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'bottom'
      });
    } finally {
      setIsMarkingRead(false);
    }
  }, [chatRoomId, isMarkingRead, setProviderUnreadCount, page]);

  // Store the markMessagesAsRead function in a ref to avoid dependency cycles
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  }, [markMessagesAsRead]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !profile?.id || !chatRoomId) return;
    
    const tempContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const tempCreatedAt = new Date().toISOString();
    
    // Create temporary message for immediate display
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string,
      sender_id: profile.id,
      content: tempContent,
      sender_type: 'provider',
      type: 'text',
      created_at: tempCreatedAt,
      is_read: false,
      ...(replyTo && {
        replied_to_id: replyTo.id,
        replied_to_content: replyTo.content,
        replied_to_sender_id: replyTo.sender_id
      })
    };
    
    // Clear input field immediately for better UX
    setNewMessage('');
    
    // Add to messages immediately for instant feedback
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    
    // Add to message queue for better state management
    messageQueueRef.current.push(tempMessage);
    
    // Set sending state
    setIsSending(true);
    
    // Clear reply state
    setReplyTo(null);
    
    // Clear any existing timeout
    if (sendingTimeoutRef.current) {
      clearTimeout(sendingTimeoutRef.current);
      sendingTimeoutRef.current = null;
    }
    
    // Create a failsafe timeout to clear the sending state if anything goes wrong
    const failsafeTimeout = setTimeout(() => {
      setIsSending(false);
    }, 5000);
    
    try {
      // Insert into database with proper error handling
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile.id,
          content: tempContent,
          sender_type: 'provider',
          type: 'text',
          created_at: tempCreatedAt
          // Reply data is not stored in the database in this version
        });
      
      if (error) {
        throw error;
      }
      
      // Clear the sending state after a short delay
      sendingTimeoutRef.current = setTimeout(() => {
        setIsSending(false);
        // Remove from message queue
        messageQueueRef.current = messageQueueRef.current.filter(msg => msg.id !== tempId);
      }, 800);
      
    } catch (error) {
      console.error('Exception sending message:', error);
      // Remove temp message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message. Please try again.',
        position: 'bottom'
      });

      setIsSending(false);
    } finally {
      clearTimeout(failsafeTimeout);
    }
  }, [newMessage, profile?.id, chatRoomId, replyTo]);

  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      console.log('[ProviderChatRoom] Removing existing channel before setting up new one');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    try {
      // Create a new subscription with more specific event handling
      const channel = supabase
        .channel(`chat_room_${chatRoomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatRoomId}`,
          },
          (payload: any) => {
            if (payload.new) {
              console.log('[ProviderChatRoom] Received new message:', payload.new.id);
              
              // Invalidate cache for current page to ensure it's refreshed next time
              delete messagesCache.current[`${chatRoomId}_page_${page}`];
              
              // Use a function to update messages to ensure we're working with the latest state
              setMessages(prev => {
                // Check if the message already exists by ID
                const exists = prev.some(msg => msg.id === payload.new.id);
                if (exists) return prev;
                
                // For text messages
                if (payload.new.type === 'text') {
                  // Match on content, sender, and approximate time
                  const matchingTempIds = prev
                    .filter(msg => 
                      msg.id.toString().startsWith('temp-') && 
                      msg.content === payload.new.content &&
                      msg.sender_id === payload.new.sender_id &&
                      msg.type === payload.new.type &&
                      Math.abs(new Date(msg.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 10000
                    )
                    .map(msg => msg.id);
                  
                  if (matchingTempIds.length > 0) {
                    // Replace the first matching temp message, preserving reply info
                    return prev.map(msg => 
                      msg.id === matchingTempIds[0] ? {
                        ...payload.new,
                        replied_to_id: msg.replied_to_id || payload.new.replied_to_id,
                        replied_to_content: msg.replied_to_content || payload.new.replied_to_content,
                        replied_to_sender_id: msg.replied_to_sender_id || payload.new.replied_to_sender_id
                      } : msg
                    );
                  }
                } 
                // For media messages (file, image, voice)
                else if (['file', 'image', 'voice'].includes(payload.new.type)) {
                  // Find matching temp messages
                  const tempMessages = prev.filter(msg => {
                    if (!msg.id.toString().startsWith('temp-')) return false;
                    if (msg.type !== payload.new.type) return false;
                    if (msg.sender_id !== payload.new.sender_id) return false;
                    
                    // Check timestamp proximity
                    const timeDiff = Math.abs(
                      new Date(msg.created_at).getTime() - new Date(payload.new.created_at).getTime()
                    );
                    
                    // Check file name similarity if exists
                    const fileNameMatch = msg.file_name && payload.new.file_name && 
                      payload.new.file_name.includes(msg.file_name.split('_')[0]);
                    
                    return timeDiff < 30000 || fileNameMatch; // Expanded time window
                  });
                  
                  if (tempMessages.length > 0) {
                    // Replace the most recent matching temp message, preserving reply info
                    return prev.map(msg => 
                      msg.id === tempMessages[0].id ? {
                        ...payload.new,
                        replied_to_id: msg.replied_to_id || payload.new.replied_to_id,
                        replied_to_content: msg.replied_to_content || payload.new.replied_to_content,
                        replied_to_sender_id: msg.replied_to_sender_id || payload.new.replied_to_sender_id
                      } : msg
                    );
                  }
                }
                
                // If no matching temp message, add as new
                return [payload.new, ...prev];
              });
              
              // Clear sending state when we receive our own message back
              if (payload.new.sender_type === 'provider' && payload.new.sender_id === profile?.id) {
                console.log('[ProviderChatRoom] Received confirmation of our sent message');
                // Immediately clear the sending state since we got confirmation
                setIsSending(false);
                
                // Clear any pending timeout
                if (sendingTimeoutRef.current) {
                  clearTimeout(sendingTimeoutRef.current);
                  sendingTimeoutRef.current = null;
                }
              }
              
              // If the new message is from a user, send a push notification
              if (payload.new.sender_type === 'user' && payload.new.sender_id !== profile?.id) {
                // Send notification with user's name and message content
                try {
                  // Only send notification if app is in background or not focused
                  const appState = AppState.currentState;
                  const isActive = appState === 'active'; 
                  
                  // Check if we're currently on the same chat screen
                  // This avoids sending notifications for messages we're actively viewing
                  let isSameChatRoom = false;
                  if (AppState.currentState === 'active') {
                    if (Platform.OS === 'web' && window.location?.pathname) {
                      // For web, check the URL path
                      isSameChatRoom = window.location.pathname.includes(`chat/${chatRoomId}`);
                    } else {
                      // For mobile, we can only check if the app is active
                      // router.getCurrentRoute() is not available in Expo Router yet
                      isSameChatRoom = true;
                    }
                  }
                  
                  if (!isActive || !isSameChatRoom) {
                    // Get user display name
                    const userName = user?.name || 'Customer';
                    
                    // Determine content based on message type
                    let content = '';
                    switch (payload.new.type) {
                      case 'text':
                        content = payload.new.content;
                        break;
                      case 'image':
                        content = '📷 Image';
                        break;
                      case 'file':
                        content = '📎 File: ' + (payload.new.file_name || 'Attachment');
                        break;
                      case 'voice':
                        content = '🎤 Voice message';
                        break;
                      default:
                        content = 'New message';
                    }
                    
                    // Use safe pattern with try-catch and timeout
                    try {
                      // We use setTimeout to ensure the notification is sent
                      // even if the component unmounts
                      setTimeout(async () => {
                        try {
                          await sendChatMessageNotification(
                            userName,
                            content,
                            chatRoomId as string,
                            true // isProvider=true
                          );
                        } catch (error) {
                          console.error('[ProviderChatRoom] Error in delayed notification sending:', error);
                        }
                      }, 300);
                    } catch (error) {
                      console.error('[ProviderChatRoom] Error scheduling notification timeout:', error);
                    }
                  }
                } catch (error) {
                  console.error('[ProviderChatRoom] Error handling notification:', error);
                }
                
                // Mark all messages as read
                setTimeout(() => {
                  if (markMessagesAsReadRef.current) {
                    markMessagesAsReadRef.current();
                  }
                }, 300);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatRoomId}`,
          },
          (payload: any) => {
            if (payload.new) {
              console.log('[ProviderChatRoom] Message updated:', payload.new.id);
              
              // Invalidate cache for current page
              delete messagesCache.current[`${chatRoomId}_page_${page}`];
              
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === payload.new.id ? {
                    ...payload.new,
                    // Preserve reply information when messages are updated
                    replied_to_id: msg.replied_to_id || payload.new.replied_to_id,
                    replied_to_content: msg.replied_to_content || payload.new.replied_to_content,
                    replied_to_sender_id: msg.replied_to_sender_id || payload.new.replied_to_sender_id
                  } : msg
                )
              );
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatRoomId}`,
          },
          (payload: any) => {
            if (payload.old && payload.old.id) {
              console.log('[ProviderChatRoom] Message deleted:', payload.old.id);
              
              // Invalidate cache for current page
              delete messagesCache.current[`${chatRoomId}_page_${page}`];
              
              setMessages(prev => 
                prev.filter(msg => msg.id !== payload.old.id)
              );
            }
          }
        );
      
      // Subscribe with error handling  
      channel.subscribe((status) => {
        
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
         
          channelRef.current = null;
        }
      });
    } catch (error) {
     
    }
  }, [chatRoomId, profile?.id, page]);

  // Main initialization effect - optimize with proper cleanup and dependency tracking
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    const initialize = async () => {
      await fetchMessages();
      await fetchUserDetails();
      
      if (isMounted && !initialMarkReadDone.current) {
        // Mark messages as read with a slight delay
        setTimeout(() => {
          if (isMounted && markMessagesAsReadRef.current) {
            markMessagesAsReadRef.current();
            initialMarkReadDone.current = true;
          }
        }, 1000);
      }

      // Try to restore any previously cached reply info for this chat room
      try {
        const cachedReplies = await FileSystem.getInfoAsync(
          `${FileSystem.documentDirectory}chat_${chatRoomId}_provider_replies.json`
        );
        
        if (cachedReplies.exists) {
          const content = await FileSystem.readAsStringAsync(
            `${FileSystem.documentDirectory}chat_${chatRoomId}_provider_replies.json`
          );
          
          if (content) {
            const replyData = JSON.parse(content) as Record<string, {
              replied_to_id?: string;
              replied_to_content?: string;
              replied_to_sender_id?: string;
            }>;
            
            // Apply cached reply info to messages if they exist
            setMessages(prev => 
              prev.map(msg => {
                const replyInfo = replyData[msg.id];
                if (replyInfo) {
                  return { ...msg, ...replyInfo };
                }
                return msg;
              })
            );
            console.log('[ProviderChatRoom] Restored reply information from cache');
          }
        }
      } catch (error) {
        console.error('[ProviderChatRoom] Error restoring cached replies:', error);
      }
    };
    
    initialize();
    
    // Set timeout for warning message
    const warningTimeout = setTimeout(() => {
      if (isMounted) {
        setShowWarning(false);
      }
    }, 60000);

    // Setup the realtime subscription
    if (isMounted) {
      setupRealtimeSubscription();
    }

    return () => {
      isMounted = false;
      
      // Remove channel on unmount
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Clear all timeouts
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }
      
      if (fetchDebounceTimeoutRef.current) {
        clearTimeout(fetchDebounceTimeoutRef.current);
        fetchDebounceTimeoutRef.current = null;
      }
      
      clearTimeout(warningTimeout);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Cache reply information before unmounting
      const saveReplies = async () => {
        try {
          const replyInfo: Record<string, {
            replied_to_id?: string;
            replied_to_content?: string;
            replied_to_sender_id?: string;
          }> = {};
          
          messages.forEach(msg => {
            if (msg.replied_to_id || msg.replied_to_content || msg.replied_to_sender_id) {
              replyInfo[msg.id] = {
                replied_to_id: msg.replied_to_id,
                replied_to_content: msg.replied_to_content,
                replied_to_sender_id: msg.replied_to_sender_id
              };
            }
          });
          
          if (Object.keys(replyInfo).length > 0) {
            await FileSystem.writeAsStringAsync(
              `${FileSystem.documentDirectory}chat_${chatRoomId}_provider_replies.json`,
              JSON.stringify(replyInfo)
            );
            console.log('[ProviderChatRoom] Cached reply information for', Object.keys(replyInfo).length, 'messages');
          }
        } catch (error) {
          console.error('[ProviderChatRoom] Error caching replies:', error);
        }
      };
      
      saveReplies();
    };
  }, [chatRoomId, fetchMessages, fetchUserDetails, setupRealtimeSubscription]);

  // Additional effect to ensure sending state gets cleared if stuck
  useEffect(() => {
    let clearStuckSendingTimeout: NodeJS.Timeout;
    
    if (isSending) {
      // Safety mechanism: if isSending stays true for more than 10 seconds, forcibly clear it
      clearStuckSendingTimeout = setTimeout(() => {
        console.log('[ProviderChatRoom] Detected stuck sending state, forcibly clearing');
        setIsSending(false);
      }, 10000);
    }
    
    return () => {
      if (clearStuckSendingTimeout) {
        clearTimeout(clearStuckSendingTimeout);
      }
    };
  }, [isSending]);

  const pickDocument = useCallback(async () => {
    if (isSending) return; 
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false,
        copyToCacheDirectory: true 
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file: FileUpload = {
          name: result.assets[0].name,
          size: result.assets[0].size,
          mimeType: result.assets[0].mimeType,
          uri: result.assets[0].uri,
          lastModified: result.assets[0].lastModified
        };
        
   
        if (file.mimeType && file.mimeType.startsWith('image/')) {
          Toast.show({
            type: 'info',
            text1: 'Processing',
            text2: 'Optimizing image for upload...',
            position: 'bottom',
            visibilityTime: 2000
          });
          
          const compressedFile = await compressImage(file);
          await uploadFile(compressedFile);
        } else {
          await uploadFile(file);
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick document',
        position: 'bottom'
      });
    }
  }, [isSending]);

  const compressImage = async (file: FileUpload): Promise<FileUpload> => {
    try {
      if (file.size && file.size < 300 * 1024) return file;
      
      const compressionQuality = file.size && file.size > 2 * 1024 * 1024 ? 0.5 : 0.7;
      
      const result = await ImageManipulator.manipulateAsync(
        file.uri,
        [{ resize: { width: 1200 } }], 
        { 
          compress: compressionQuality, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false
        }
      );
      
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      
      return {
        ...file,
        uri: result.uri,
        size: fileInfo && 'size' in fileInfo ? fileInfo.size : file.size,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      console.warn('Image compression failed:', error);
      return file;
    }
  };

  const uploadFile = useCallback(async (file: FileUpload) => {
    if (!file || !file.uri || isSending) return;
    
    const fileExt = file.name.split('.').pop() || 'file';
    const fileName = `${chatRoomId}_${Date.now()}.${fileExt}`;
    const isImage = fileExt.toLowerCase().match(/(jpg|jpeg|png|gif)/) ? true : false;
    const tempId = `temp-${Date.now()}`;
    
    const tempUrl = file.uri;
    
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string,
      sender_id: profile?.id || '',
      content: tempUrl,
      sender_type: 'provider',
      type: isImage ? 'image' : 'file',
      file_name: file.name,
      created_at: new Date().toISOString(),
      is_read: false
    };
      
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    
    setIsSending(true);
    
    if (sendingTimeoutRef.current) {
      clearTimeout(sendingTimeoutRef.current);
      sendingTimeoutRef.current = null;
    }
    
    const failsafeTimeout = setTimeout(() => {
      setIsSending(false);
    }, 15000);  
    
    try {
      Toast.show({
        type: 'info',
        text1: 'Uploading',
        text2: isImage ? 'Sending image...' : 'Sending file...',
        position: 'bottom',
        visibilityTime: 2000
      });
      
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name
        } as any);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile?.id,
          content: publicUrl,
          sender_type: 'provider',
          type: isImage ? 'image' : 'file',
          file_name: file.name,
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        throw messageError;
      }

      sendingTimeoutRef.current = setTimeout(() => {
        setIsSending(false);
      }, 800);
      
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload file. Please try again.',
        position: 'bottom'
      });
      
      setIsSending(false);
    } finally {
      clearTimeout(failsafeTimeout);
    }
  }, [chatRoomId, profile?.id, isSending]);

  const uploadVoiceRecording = useCallback(async (audioUri: string, duration: number) => {
    if (!audioUri || isSending) return;
    
    const fileName = `${chatRoomId}_voice_${Date.now()}.m4a`;
    const tempId = `temp-${Date.now()}`;
    
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string,
      sender_id: profile?.id || '',
      content: audioUri,
      sender_type: 'provider',
      type: 'voice',
      duration: duration.toString(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    
    setIsSending(true);
    
    if (sendingTimeoutRef.current) {
      clearTimeout(sendingTimeoutRef.current);
      sendingTimeoutRef.current = null;
    }
    
    const failsafeTimeout = setTimeout(() => {
      setIsSending(false);
      setShowVoiceRecorder(false);
    }, 15000);  
    
    try {
      Toast.show({
        type: 'info',
        text1: 'Uploading',
        text2: 'Sending voice message...',
        position: 'bottom',
        visibilityTime: 2000
      });
      
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: audioUri,
          type: 'audio/m4a',
          name: fileName
        } as any);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile?.id,
          content: publicUrl,
          sender_type: 'provider',
          type: 'voice',
          duration: duration.toString(),
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        throw messageError;
      }

      sendingTimeoutRef.current = setTimeout(() => {
        setIsSending(false);
        setShowVoiceRecorder(false);
      }, 800);
      
    } catch (error) {
      console.error('Voice upload error:', error);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload voice message. Please try again.',
        position: 'bottom'
      });
      
      setIsSending(false);
      setShowVoiceRecorder(false);
    } finally {
      clearTimeout(failsafeTimeout);
    }
  }, [chatRoomId, profile?.id, isSending]);

  const handleRecordingComplete = useCallback((audioUri: string, duration: number) => {
    uploadVoiceRecording(audioUri, duration);
  }, [uploadVoiceRecording]);

  const handleCancelRecording = useCallback(() => {
    setShowVoiceRecorder(false);
  }, []);

  const toggleVoiceRecorder = useCallback(() => {
    setShowVoiceRecorder(prev => !prev);
  }, []);

  const handleMessageDelete = useCallback((messageId: string) => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
  }, []);

  const renderHeader = useCallback(() => (
    <View style={[styles.header, isDark && { backgroundColor: '#0066CC' }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.userInfo}>
        <Image 
          source={{ uri: user?.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.userAvatar}
          progressiveRenderingEnabled={true}
          fadeDuration={300}
        />
        <View>
          <Text style={styles.userName}>{user?.name || 'Loading...'}</Text>
          <Text style={styles.userRole}>{user?.role || 'Loading...'}</Text>
        </View>
      </View>
      {isMarkingRead && (
        <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
      )}
    </View>
  ), [user, isMarkingRead, isDark]);

  const renderSecurityWarning = useCallback(() => {
    if (!showWarning) return null;
    
    return (
      <View style={[
        styles.securityWarningContainer, 
        isDark && { backgroundColor: '#3A2E00', borderColor: '#5A4B00' }
      ]}>
        <Ionicons name="alert-circle" size={20} color="#FF9500" style={styles.warningIcon} />
        <Text style={[
          styles.securityWarningText, 
          isDark && { color: '#FFD68A' }
        ]}>
          ⚠️ Important: Please verify all booking details with the client before starting any service. 
          Ensure dates, times, amount and service requirements are correctly understood and confirmed within the app.
        </Text>
      </View>
    );
  }, [showWarning, isDark]);

  const renderItem = useCallback(({ item }: { item: Message }) => {
    // Determine if the message is from the current provider
    const isOwn = item.sender_id === profile?.id;
    
    return (
      <ChatMessage 
        message={item}
        isOwnMessage={isOwn}
        onMessageDelete={handleMessageDelete}
        isDark={isDark}
        colors={colors}
        // Use user info for display name when the message is from the user (not the provider)
        senderName={!isOwn ? user?.name || 'User' : 'You'}
        senderImage={!isOwn ? user?.profile_pic : undefined}
      />
    );
  }, [profile?.id, handleMessageDelete, isDark, colors, user?.name, user?.profile_pic]);

  const keyExtractor = useCallback((item: Message) => `message-${item.id}`, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ESTIMATED_ITEM_HEIGHT,
    offset: ESTIMATED_ITEM_HEIGHT * index,
    index,
  }), []);

  const listConfig = useMemo(() => ({
    initialNumToRender: 10, // Render fewer initial items
    maxToRenderPerBatch: 5, // Render fewer items per batch
    windowSize: 8, // Smaller window size for better performance
    updateCellsBatchingPeriod: 100, // Longer batching period means fewer updates
    removeClippedSubviews: Platform.OS !== 'web', // Helps performance on mobile but can cause issues on web
    onEndReachedThreshold: 0.2, // Load more when closer to the end
    scrollEventThrottle: 32, // Optimize scroll performance
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: 'on-drag' as const,
    showsVerticalScrollIndicator: false, // Hide scrollbar for cleaner UI
  }), [getItemLayout]);

  const handleInputChange = useCallback((text: string) => {
    setNewMessage(text);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (isSending || !newMessage.trim()) return;
    sendMessage();
  }, [sendMessage, isSending, newMessage]);

  const fadeInOut = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      })
    ]).start(() => {
      if (isLoading) {
        fadeInOut();
      }
    });
  }, [isLoading, fadeAnim]);

  useEffect(() => {
    let animationSubscription: any = null;
    
    if (isLoading) {
      const startAnimation = () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.4,
            duration: 700,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true
          })
        ]).start(({ finished }) => {
          if (finished && isLoading) {
            startAnimation();
          }
        });
      };
      
      startAnimation();
    }
    
    return () => {
      // Properly clean up animation
      fadeAnim.stopAnimation();
      if (animationSubscription) {
        animationSubscription.remove();
      }
    };
  }, [isLoading, fadeAnim]);

  const renderLoading = useCallback(() => {
    if (!isLoading || messages.length > 0) return null;
    
    return (
      <View style={[
        styles.loadingContainer,
        isDark && { backgroundColor: colors.secondaryBackground }
      ]}>
        <Animated.View style={{ 
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
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
          Loading messages...
        </Text>
      </View>
    );
  }, [isLoading, messages.length, isDark, colors, fadeAnim]);

  const renderInputBar = useCallback(() => {
    if (showVoiceRecorder) {
      return (
        <VoiceRecorder 
          onRecordingComplete={handleRecordingComplete}
          onCancel={handleCancelRecording}
          isDark={isDark}
        />
      );
    }
    
    return (
      <View style={[
        styles.inputContainer,
        isDark && { backgroundColor: '#222' },
        isSending && styles.inputContainerDisabled
      ]}>
        <View style={styles.inputActionsContainer}>
          <TouchableOpacity 
            style={[styles.attachButton, isSending && styles.buttonDisabled]} 
            onPress={pickDocument}
            disabled={isSending}
          >
            <Ionicons 
              name="attach" 
              size={24} 
              color={isDark ? (isSending ? "#555" : "#aaa") : (isSending ? "#ccc" : "#7c7c7c")} 
            />
          </TouchableOpacity>
          <View style={[
            styles.inputWrapper,
            isDark && { backgroundColor: '#333' },
            isSending && { backgroundColor: isDark ? '#2A2A2A' : '#f0f0f0' }
          ]}>
            <TextInput
              value={newMessage}
              onChangeText={handleInputChange}
              placeholder="Type a message"
              placeholderTextColor={isDark ? "#888" : undefined}
              style={[
                styles.input,
                isDark && { color: colors.text },
                isSending && { color: isDark ? '#777' : '#999' }
              ]}
              multiline
              editable={!isSending}
            />
            {isSending && (
              <ActivityIndicator 
                size="small" 
                color={isDark ? "#aaa" : "#666"} 
                style={styles.sendingIndicator} 
              />
            )}
          </View>
          {newMessage.trim() ? (
            <TouchableOpacity 
              style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={isSending}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={isSending ? "#aaa" : "#fff"} 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.micButton, isSending && styles.micButtonDisabled]}
              onPress={toggleVoiceRecorder}
              disabled={isSending}
            >
              <Ionicons 
                name="mic" 
                size={20} 
                color={isSending ? "#aaa" : "#fff"} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [newMessage, handleInputChange, handleSendMessage, toggleVoiceRecorder, showVoiceRecorder, isDark, colors.text, isSending, pickDocument, handleRecordingComplete, handleCancelRecording]);

  // Optimize animations with useRef and proper cleanup
  const setupAnimations = useCallback(() => {
    // Prevent memory leaks by properly stopping animations
    return () => {
      if (fadeAnim) {
        fadeAnim.stopAnimation();
      }
    };
  }, [fadeAnim]);

  // Add memory optimization for large message lists
  useEffect(() => {
    const clearStaleMessages = () => {
      // If message count exceeds a threshold, trim older messages
      if (messages.length > 200) {
        setMessages(prevMessages => {
          // Keep latest 150 messages to reduce memory usage
          const latestMessages = prevMessages.slice(0, 150);
          console.log('[ProviderChatRoom] Trimmed message cache to reduce memory usage');
          return latestMessages;
        });
        
        // Also trim the message cache - modify this part to fix type issues
        const trimmedCache = {...messagesCache.current};
        Object.keys(trimmedCache).forEach(key => {
          const messages = trimmedCache[key];
          if (Array.isArray(messages) && messages.length > 150) {
            trimmedCache[key] = messages.slice(0, 150);
          }
        });
        messagesCache.current = trimmedCache;
      }
    };
    
    // Run cleanup when messages length changes significantly
    clearStaleMessages();
    
    // Also add cleanup on unmount
    return () => {
      clearStaleMessages();
    };
  }, [messages.length]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[
        styles.container, 
        isDark && { backgroundColor: colors.secondaryBackground }
      ]}>
        {renderHeader()}
        {renderSecurityWarning()}
        <View style={[
          styles.chatBackground, 
          isDark && { backgroundColor: colors.cardBackground }
        ]}>
          {renderLoading()}
          <FlatList
            ref={flatListRef}
            data={messagesData}
            inverted
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messagesList}
            onEndReached={handleLoadMore}
            ListFooterComponent={isLoading && hasMore ? (
              <ActivityIndicator 
                size="small" 
                color={isDark ? colors.tint : Colors.primary} 
                style={styles.loadingMore} 
              />
            ) : null}
            {...listConfig}
          />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + insets.bottom : 0}
          style={{ width: '100%' }}
        >
          {renderInputBar()}
        </KeyboardAvoidingView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 40 : 15, 
    backgroundColor: Colors.primary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    minHeight: Platform.OS === 'ios' ? 85 : 60, 
  },
  backButton: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    marginRight: 12,
  },
  userName: {
    fontSize: isSmallScreen ? 14 : 16,
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
  },
  userRole: {
    fontSize: isSmallScreen ? 10 : 12,
    fontFamily: 'Urbanist-Medium',
    color: 'rgba(255,255,255,0.8)',
  },
  messagesList: {
    padding: isSmallScreen ? 12 : 16,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: isSmallScreen ? 6 : 8,
    backgroundColor: '#f0f0f0',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    marginHorizontal: isSmallScreen ? 4 : 8,
    paddingLeft: isSmallScreen ? 8 : 12,
  },
  attachButton: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: isSmallScreen ? 8 : 10,
    paddingHorizontal: 5,
    maxHeight: 100,
    fontFamily: 'Urbanist-Regular',
    fontSize: isSmallScreen ? 14 : 16,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: isSmallScreen ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loadingMore: {
    paddingVertical: 20,
  },
  securityWarningContainer: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 0,
    padding: isSmallScreen ? 8 : 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 10,
  },
  securityWarningText: {
    color: '#5D4037',
    fontSize: isSmallScreen ? 12 : 13,
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    lineHeight: isSmallScreen ? 16 : 18,
  },
  micButton: {
    backgroundColor: Colors.primary, 
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: isSmallScreen ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontFamily: 'Urbanist-Medium',
    fontSize: isSmallScreen ? 14 : 16,
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  inputContainerDisabled: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
  micButtonDisabled: {
    backgroundColor: '#999',
  },
  sendingIndicator: {
    position: 'absolute',
    right: 10,
  },
  inputActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallScreen ? 6 : 8,
  },
}); 