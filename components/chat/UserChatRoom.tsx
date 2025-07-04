import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
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
import { AppState, AppStateStatus } from 'react-native';
import { ChatInput } from '../common/ChatInput';
import { sendChatMessageNotification } from '../../services/pushNotifications';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Message cache constants
const MESSAGE_CACHE_VERSION = 1;
const INITIAL_MESSAGES_COUNT = 25;
const LOAD_MORE_COUNT = 25;
const TYPING_TIMEOUT = 2000;
const PRESENCE_CHANNEL = 'presence';

// Add this interface near the top of the file where other interfaces are defined
interface PresenceState {
  user_id: string;
  online_at: string;
  typing: boolean;
  [key: string]: any; // For any additional properties
}

// Improved item height calculation - adjust based on your average message size
const ESTIMATED_ITEM_HEIGHT = 100; // Average height of a message item

export default function UserChatRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const { profile } = useUserStore();
  const { id: chatRoomId } = useLocalSearchParams();
  const [provider, setProvider] = useState<any>(null);
  const { setUserUnreadCount } = useChatStore();
  const initialMarkReadDone = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const { isDark, colors } = useTheme();
  const markMessagesAsReadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  
  // Refs for optimized fetching
  const appStateRef = useRef(AppState.currentState);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number | null>(null);
  const cursorRef = useRef<string | null>(null);
  const cachedMessagesRef = useRef<{[key: string]: Message[]}>({});
  const messageMapRef = useRef<Map<string, Message>>(new Map());
  
  // Create a memoized version of messages to prevent unnecessary rerenders
  const messagesData = useMemo(() => messages, [messages]);
  
  // Add these new state variables
  const [isProviderTyping, setIsProviderTyping] = useState(false);
  const [isProviderOnline, setIsProviderOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);
  
  // Create a ref for tracking if data is stale
  const isDataStaleRef = useRef(false);

  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Check if we have cached data for this chat
  const getCachedMessages = useCallback(async () => {
    try {
      const cacheKey = `chat_${chatRoomId}_messages_v${MESSAGE_CACHE_VERSION}`;
      const cacheExists = await FileSystem.getInfoAsync(
        `${FileSystem.documentDirectory}${cacheKey}.json`
      );
      
      if (cacheExists.exists) {
        const content = await FileSystem.readAsStringAsync(
          `${FileSystem.documentDirectory}${cacheKey}.json`
        );
        
        if (content) {
          console.log('[UserChatRoom] Loading messages from cache');
          const cachedData = JSON.parse(content);
          
          // Update the message map
          cachedData.messages.forEach((msg: Message) => {
            messageMapRef.current.set(msg.id, msg);
          });
          
          // Update the cursor
          if (cachedData.cursor) {
            cursorRef.current = cachedData.cursor;
          }
          
          return {
            messages: cachedData.messages || [],
            hasMore: cachedData.hasMore !== false
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('[UserChatRoom] Error loading cached messages:', error);
      return null;
    }
  }, [chatRoomId]);
  
  // Save messages to cache
  const cacheMessages = useCallback(async (messagesToCache: Message[], cursor: string | null, hasMorePages: boolean) => {
    try {
      const cacheKey = `chat_${chatRoomId}_messages_v${MESSAGE_CACHE_VERSION}`;
      const cacheData = {
        messages: messagesToCache,
        cursor: cursor,
        hasMore: hasMorePages,
        timestamp: Date.now()
      };
      
      await FileSystem.writeAsStringAsync(
        `${FileSystem.documentDirectory}${cacheKey}.json`,
        JSON.stringify(cacheData)
      );
      
      console.log('[UserChatRoom] Cached', messagesToCache.length, 'messages');
    } catch (error) {
      console.error('[UserChatRoom] Error caching messages:', error);
    }
  }, [chatRoomId]);

  // Initial setup
  useEffect(() => {
    const initializeChat = async () => {
      // Use cached messages if available (for immediate display)
      const cachedData = await getCachedMessages();
      if (cachedData && cachedData.messages.length > 0) {
        setMessages(cachedData.messages);
        setHasMore(cachedData.hasMore);
        
        // Still fetch fresh data in the background
        setTimeout(() => {
          fetchMessages(false, true);
        }, 300);
      } else {
        // No cache, fetch fresh
        fetchMessages();
      }
      
      // Fetch provider details
      fetchProviderDetails();
      
      // Mark messages as read after a short delay
      if (!initialMarkReadDone.current) {
        setTimeout(() => {
          console.log('[UserChatRoom] Initial marking of messages as read');
          if (markMessagesAsReadRef.current) {
            markMessagesAsReadRef.current();
            initialMarkReadDone.current = true;
          }
        }, 1000);
      }
      
      // Set up app state tracking
      const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
      
      // Dismiss warning after delay
      const warningTimeout = setTimeout(() => {
        setShowWarning(false);
      }, 20000);
      
      // Set up realtime subscription
      setupRealtimeSubscription();
      
      // Restore cached reply info
      restoreReplies();
      
      return () => {
        appStateSubscription.remove();
        clearTimeout(warningTimeout);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        
        // Save current messages as cache when component unmounts
        if (messages.length > 0) {
          cacheMessages(messages, cursorRef.current, hasMore);
        }
        
        // Cache reply information before unmounting
        saveReplies();
      };
    };
    
    initializeChat();
  }, [chatRoomId]);
  
  // Handle app state changes (background/foreground)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('[UserChatRoom] App state changed from', appStateRef.current, 'to', nextAppState);
    
    // Check if app is coming from background to active state
    if (
      appStateRef.current.match(/inactive|background/) && 
      nextAppState === 'active'
    ) {
      console.log('[UserChatRoom] App has come to the foreground!');
      
      // Check if we should refresh data (if last fetch was more than 30 seconds ago)
      const shouldRefresh = 
        !lastFetchTimeRef.current || 
        Date.now() - lastFetchTimeRef.current > 30000;
      
      if (shouldRefresh && !isFetchingRef.current) {
        console.log('[UserChatRoom] Refreshing data after app foregrounded');
        fetchMessages(false, true);
      }
    }
    
    // Update the app state reference
    appStateRef.current = nextAppState;
  }, []);
  
  // Handle saving and restoring replies
  const restoreReplies = async () => {
    try {
      // Get cached messages from AsyncStorage or browser localStorage
      const cachedReplies = await FileSystem.getInfoAsync(
        `${FileSystem.documentDirectory}chat_${chatRoomId}_replies.json`
      );
      
      if (cachedReplies.exists) {
        const content = await FileSystem.readAsStringAsync(
          `${FileSystem.documentDirectory}chat_${chatRoomId}_replies.json`
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
          console.log('[UserChatRoom] Restored reply information from cache');
        }
      }
    } catch (error) {
      console.error('[UserChatRoom] Error restoring cached replies:', error);
    }
  };
  
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
          `${FileSystem.documentDirectory}chat_${chatRoomId}_replies.json`,
          JSON.stringify(replyInfo)
        );
        console.log('[UserChatRoom] Cached reply information for', Object.keys(replyInfo).length, 'messages');
      }
    } catch (error) {
      console.error('[UserChatRoom] Error caching replies:', error);
    }
  };

  // Setup realtime subscription for new/updated messages
  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
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
            // Process the new message
            setMessages(prev => {
              // Check if we already have this message (by ID)
              // const exists = messageMapRef.current.has(payload.new.id);
              // if (exists) return prev;
              
              const newRealMessage = payload.new;
              const tempIdPrefix = 'temp-';

              const tempIndex = prev.findIndex(msg =>
                  msg.id.toString().startsWith(tempIdPrefix) &&
                  msg.content === newRealMessage.content &&
                  msg.sender_id === newRealMessage.sender_id &&
                  msg.type === newRealMessage.type &&
                  Math.abs(new Date(msg.created_at).getTime() - new Date(newRealMessage.created_at).getTime()) < 5000 
              );

              if (tempIndex !== -1) {
                  const tempMessage = prev[tempIndex];
                  
                  const finalMessage = {
                      ...newRealMessage,
                      replied_to_id: tempMessage.replied_to_id || newRealMessage.replied_to_id,
                      replied_to_content: tempMessage.replied_to_content || newRealMessage.replied_to_content,
                      replied_to_sender_id: tempMessage.replied_to_sender_id || newRealMessage.replied_to_sender_id
                  };

                  // Remove the temporary message 
                  const updatedMessages = [...prev];
                  updatedMessages.splice(tempIndex, 1); 
                  updatedMessages.unshift(finalMessage); 
                  messageMapRef.current.delete(tempMessage.id); 
                  messageMapRef.current.set(finalMessage.id, finalMessage); 

                  return updatedMessages;

              } else {
                  messageMapRef.current.set(newRealMessage.id, newRealMessage);
                  return [newRealMessage, ...prev];
              }

              // Old logic below 
              /*
              if (payload.new.type === 'text') {
                const tempMessages = prev.filter(msg => 
                  msg.id.toString().startsWith('temp-') && 
                  msg.content === payload.new.content &&
                  msg.sender_id === payload.new.sender_id &&
                  msg.type === payload.new.type
                );
                
                if (tempMessages.length > 0) {
                  // Replace the temp message with the real one, preserving reply info
                  const updatedMessages = prev.map(msg => {
                    if (msg.id === tempMessages[0].id) {
                      const newMsg = {
                        ...payload.new,
                        replied_to_id: msg.replied_to_id,
                        replied_to_content: msg.replied_to_content,
                        replied_to_sender_id: msg.replied_to_sender_id
                      };
                      messageMapRef.current.set(newMsg.id, newMsg);
                      return newMsg;
                    }
                    return msg;
                  });
                  return updatedMessages;
                }
              } else if (['file', 'image', 'voice'].includes(payload.new.type)) {
                // Similar handling for media messages
                const tempMessages = prev.filter(msg => {
                  const isTemp = msg.id.toString().startsWith('temp-');
                  const isSameType = msg.type === payload.new.type;
                  const isSameSender = msg.sender_id === payload.new.sender_id;
                  const isRecentTimestamp = Math.abs(
                    new Date(msg.created_at).getTime() - new Date(payload.new.created_at).getTime()
                  ) < 10000; 
                  
                  const hasSameFileName = 
                    msg.file_name && 
                    payload.new.file_name && 
                    payload.new.file_name.includes(msg.file_name.split('_')[0]);
                  
                  return isTemp && isSameType && isSameSender && 
                    (isRecentTimestamp || (hasSameFileName && msg.type === payload.new.type));
                });
                
                if (tempMessages.length > 0) {
                  tempMessages.sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );
                  
                  // Replace the temp message with the real one
                  const updatedMessages = prev.map(msg => {
                    if (msg.id === tempMessages[0].id) {
                      const newMsg = {
                        ...payload.new,
                        replied_to_id: msg.replied_to_id,
                        replied_to_content: msg.replied_to_content,
                        replied_to_sender_id: msg.replied_to_sender_id
                      };
                      messageMapRef.current.set(newMsg.id, newMsg);
                      return newMsg;
                    }
                    return msg;
                  });
                  return updatedMessages;
                }
              }
              
              // It's a completely new message
              const newMsg = payload.new;
              messageMapRef.current.set(newMsg.id, newMsg);
              
              return [newMsg, ...prev];
              */
            });
            
            if (payload.new.sender_type === 'provider') {
              console.log('[UserChatRoom] Message from provider received, marking messages as read');
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
            setMessages(prev => 
              prev.map(msg => {
                if (msg.id === payload.new.id) {
                  const updatedMsg = {
                    ...payload.new,
                    replied_to_id: msg.replied_to_id || payload.new.replied_to_id,
                    replied_to_content: msg.replied_to_content || payload.new.replied_to_content,
                    replied_to_sender_id: msg.replied_to_sender_id || payload.new.replied_to_sender_id
                  };
                  messageMapRef.current.set(updatedMsg.id, updatedMsg);
                  return updatedMsg;
                }
                return msg;
              })
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
            messageMapRef.current.delete(payload.old.id);
            setMessages(prev => 
              prev.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    if (provider?.id) {
      setupPresenceChannel(provider.id);
    }
  }, [chatRoomId]);

  const fetchProviderDetails = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        provider:provider_id (
          id,
          name,
          profile_pic,
          providers (services)
        )
      `)
      .eq('id', chatRoomId)
      .single();

    if (!error && data) {
      setProvider(data.provider);
    }
  }, [chatRoomId]);

  const fetchMessages = useCallback(async (loadMore = false, silentRefresh = false) => {
    if (isFetchingRef.current || (!loadMore && !silentRefresh && !hasMore)) return;
    
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
      
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatRoomId)
        .order('created_at', { ascending: false });
      
      // Apply pagination
      if (loadMore && cursorRef.current) {
        query = query.lt('created_at', cursorRef.current);
        query = query.limit(LOAD_MORE_COUNT);
      } else {
        query = query.limit(INITIAL_MESSAGES_COUNT);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('[UserChatRoom] Error fetching messages:', error);
        return;
      }

      if (data && data.length > 0) {
        const oldestMessage = data[data.length - 1];
        if (oldestMessage) {
          cursorRef.current = oldestMessage.created_at;
        }
        
        const fetchLimit = loadMore ? LOAD_MORE_COUNT : INITIAL_MESSAGES_COUNT;
        setHasMore(data.length === fetchLimit);

        // Process and merge messages
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          
          const replyInfoMap = new Map();
          prev.forEach(msg => {
            if (msg.replied_to_id || msg.replied_to_content || msg.replied_to_sender_id) {
              replyInfoMap.set(msg.id, {
                replied_to_id: msg.replied_to_id,
                replied_to_content: msg.replied_to_content,
                replied_to_sender_id: msg.replied_to_sender_id
              });
            }
          });
          
          const newMessages = data
            .filter(msg => !existingIds.has(msg.id) || silentRefresh)
            .map(msg => {
              const replyInfo = replyInfoMap.get(msg.id);
              const processedMsg = replyInfo ? { ...msg, ...replyInfo } : msg;
              messageMapRef.current.set(msg.id, processedMsg);
              return processedMsg;
            });
          
          if (loadMore && !silentRefresh) {
            return [...prev, ...newMessages];
          } else if (silentRefresh) {
            const allMessages = [...prev];
            
            newMessages.forEach(newMsg => {
              if (!existingIds.has(newMsg.id)) {
                const insertIndex = allMessages.findIndex(
                  msg => new Date(msg.created_at) < new Date(newMsg.created_at)
                );
                
                if (insertIndex === -1) {
                  allMessages.push(newMsg);
                } else {
                  allMessages.splice(insertIndex, 0, newMsg);
                }
              }
            });
            
            return allMessages;
          } else {
            return newMessages;
          }
        });
        
        if (!silentRefresh && !loadMore) {
          cacheMessages(data, cursorRef.current, data.length === INITIAL_MESSAGES_COUNT);
        }
        
        const hasUnreadProviderMessages = data.some(
          msg => msg.sender_type === 'provider' && !msg.is_read
        );
        
        if (hasUnreadProviderMessages && !loadMore && !silentRefresh) {
          console.log('[UserChatRoom] Detected unread messages in newly loaded data');
          setTimeout(() => {
            if (markMessagesAsReadRef.current) {
              markMessagesAsReadRef.current();
            }
          }, 500);
        }
      } else if (data && data.length === 0) {
        setHasMore(false);
        
        if (!loadMore && !silentRefresh) {
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('[UserChatRoom] Error in fetchMessages:', error);
    } finally {
      isFetchingRef.current = false;
      if (!silentRefresh) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [chatRoomId, hasMore, cacheMessages]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore && !isFetchingRef.current) {
      fetchMessages(true);
    }
  }, [isLoading, isLoadingMore, hasMore, fetchMessages]);

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim() || !profile?.id) return;

    const tempContent = text.trim();
    const tempId = `temp-${Date.now()}`;
    const tempCreatedAt = new Date().toISOString();
    
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string, 
      sender_id: profile.id,
      content: tempContent,
      sender_type: 'user',
      type: 'text',
      created_at: tempCreatedAt,
      is_read: false,
      ...(replyTo && {
        replied_to_id: replyTo.id,
        replied_to_content: replyTo.content,
        replied_to_sender_id: replyTo.sender_id
      })
    };
    
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    setReplyTo(null); 

    setTimeout(() => {
      setNewMessage('');
    }, 50);
    
    try {
      supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile.id,
          content: tempContent,
          sender_type: 'user',
          type: 'text',
          created_at: tempCreatedAt
        })
        .then(({ error }) => {
          if (error) {
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to send message. Please try again.',
              position: 'bottom'
            });
          }
        });
    } catch (error) {
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message. Please try again.',
        position: 'bottom'
      });
    }
  }, [profile?.id, chatRoomId, replyTo]);

  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (isMarkingRead) return; 
      setIsMarkingRead(true);
      
      console.log(`[UserChatRoom] Attempting to mark messages as read for chat ${chatRoomId}`);
      
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatRoomId)
        .eq('sender_type', 'provider')
        .or('is_read.is.null,is_read.eq.false'); 
        
      if (fetchError) {
        console.error('[UserChatRoom] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[UserChatRoom] Found ${unreadMessages.length} unread messages to update`);
        
        const { error: batchUpdateError } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
          
        if (batchUpdateError) {
          console.error('[UserChatRoom] Batch update failed, falling back to individual updates');
          for (const msg of unreadMessages) {
            const { error: singleUpdateError } = await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', msg.id);
              
            if (singleUpdateError) {
              console.error(`[UserChatRoom] Error updating message ${msg.id}:`, singleUpdateError);
            } else {
              console.log(`[UserChatRoom] Successfully marked message ${msg.id} as read`);
            }
          }
        } else {
          console.log(`[UserChatRoom] Successfully batch updated ${unreadMessages.length} messages`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setMessages(prev => 
          prev.map(msg => {
            if (msg.sender_type === 'provider' && !msg.is_read) {
              return { ...msg, is_read: true };
            }
            return msg;
          })
        );
        
        const { count: totalUnread } = await supabase
          .from('chat_messages')
          .select('count', { count: 'exact', head: true })
          .eq('sender_type', 'provider')
          .eq('is_read', false);
          
        if (totalUnread !== null) {
          console.log(`[UserChatRoom] Updating user unread count to ${totalUnread}`);
          setUserUnreadCount(totalUnread || 0);
        }
      } else {
        console.log('[UserChatRoom] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[UserChatRoom] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'bottom'
      });
    } finally {
      setIsMarkingRead(false);
    }
  }, [isMarkingRead, chatRoomId]);

  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  }, [markMessagesAsRead]);

  const handleMessageDelete = useCallback((messageId: string) => {
    messageMapRef.current.delete(messageId);
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
  }, []);

  const handleReplyToMessage = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  const renderItem = useCallback(({ item }: { item: Message }) => {
    const isOwn = item.sender_id === profile?.id;
    return (
      <ChatMessage 
        message={item}
        isOwnMessage={isOwn}
        onMessageDelete={handleMessageDelete}
        isDark={isDark}
        colors={colors}
        senderName={item.sender_type === 'provider' ? provider?.name : 'You'}
        senderImage={item.sender_type === 'provider' ? provider?.profile_pic : undefined}
      />
    );
  }, [profile?.id, handleMessageDelete, isDark, colors, provider]);

  const keyExtractor = useCallback((item: Message) => `message-${item.id}`, []);

  const getItemLayout = useCallback((data: any, index: number) => {
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    };
  }, []);

  
  const listConfig = useMemo(() => ({
    initialNumToRender: 10, 
    maxToRenderPerBatch: 5, 
    windowSize: 8, 
    updateCellsBatchingPeriod: 100, 
    removeClippedSubviews: Platform.OS !== 'web', 
    onEndReachedThreshold: 0.2, 
    scrollEventThrottle: 32, 
    ListEmptyComponent: React.memo(() => null), 
    keyboardShouldPersistTaps: 'handled' as const, 
    keyboardDismissMode: 'on-drag' as const,
  }), []);

  const refreshData = useCallback(() => {
    if (isDataStaleRef.current && !isFetchingRef.current) {
      fetchMessages(false, true);
      isDataStaleRef.current = false;
    }
  }, [fetchMessages]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        isDataStaleRef.current = true;
        refreshData();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [refreshData]);

  useEffect(() => {
    const clearStaleMessages = () => {
      if (messages.length > 200) {
        setMessages(prevMessages => {
          const latestMessages = prevMessages.slice(0, 150);
          console.log('[UserChatRoom] Trimmed message cache to reduce memory usage');
          return latestMessages;
        });
      }
    };

    return () => {
      clearStaleMessages();
    };
  }, [messages.length]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false
      });

      if (!result.canceled && result.assets[0]) {
        const file: FileUpload = {
          name: result.assets[0].name,
          size: result.assets[0].size,
          mimeType: result.assets[0].mimeType,
          uri: result.assets[0].uri,
          lastModified: result.assets[0].lastModified
        };
        
        if (file.mimeType && file.mimeType.startsWith('image/')) {
          const compressedFile = await compressImage(file);
          await uploadFile(compressedFile);
        } else {
          await uploadFile(file);
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick document',
        position: 'bottom'
      });
    }
  }, [profile?.id]);

  const compressImage = async (file: FileUpload): Promise<FileUpload> => {
    try {
      if (file.size && file.size < 300 * 1024) return file;
      
      const result = await ImageManipulator.manipulateAsync(
        file.uri,
        [{ resize: { width: 1024 } }], 
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return {
        ...file,
        uri: result.uri,
        size: file.size,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      return file;
    }
  };

  const uploadFile = useCallback(async (file: FileUpload) => {
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
      sender_type: 'user',
      type: isImage ? 'image' : 'file',
      file_name: file.name,
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    messageMapRef.current.set(tempId, tempMessage);
    
    try {
      const localIsLoading = true;

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name
        } as any);

      if (error) {
        messageMapRef.current.delete(tempId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
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
          sender_type: 'user',
          type: isImage ? 'image' : 'file',
          file_name: file.name,
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        messageMapRef.current.delete(tempId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw messageError;
      }

    } catch (error) {
      messageMapRef.current.delete(tempId);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload file. Please try again.',
        position: 'bottom'
      });
    }
  }, [chatRoomId, profile?.id]);

  const uploadVoiceRecording = useCallback(async (audioUri: string, duration: number) => {
    const fileName = `${chatRoomId}_voice_${Date.now()}.m4a`;
    const tempId = `temp-${Date.now()}`;
    
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string, 
      sender_id: profile?.id || '',
      content: audioUri, 
      sender_type: 'user',
      type: 'voice',
      file_name: fileName,
      duration: duration.toString(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    messageMapRef.current.set(tempId, tempMessage);
    
    try {
      let fileInfo;
      try {
        fileInfo = await FileSystem.getInfoAsync(audioUri);
        
        if (!fileInfo.exists) {
          messageMapRef.current.delete(tempId);
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
          throw new Error('Recorded audio file not found');
        }
      } catch (error) {
        console.error('File info error:', error);
        messageMapRef.current.delete(tempId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw new Error('Unable to access the recorded audio file');
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: audioUri,
          type: 'audio/m4a',
          name: fileName
        } as any);

      if (error) {
        console.error('Supabase storage error:', error);
        messageMapRef.current.delete(tempId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
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
          sender_type: 'user',
          type: 'voice',
          file_name: fileName,
          duration: duration.toString(),
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        console.error('Message insert error:', messageError);
        messageMapRef.current.delete(tempId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw messageError;
      }

    } catch (error) {
      console.error('Voice note upload error:', error);
      messageMapRef.current.delete(tempId);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send voice note. Please try again.',
        position: 'bottom'
      });
    } finally {
      setShowVoiceRecorder(false);
    }
  }, [chatRoomId, profile?.id]);

  const handleRecordingComplete = useCallback((audioUri: string, duration: number) => {
    uploadVoiceRecording(audioUri, duration);
  }, [uploadVoiceRecording]);

  const handleCancelRecording = useCallback(() => {
    setShowVoiceRecorder(false);
  }, []);

  const toggleVoiceRecorder = useCallback(() => {
    setShowVoiceRecorder(prev => !prev);
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setNewMessage(text);
  }, []);

  const setupPresenceChannel = useCallback((providerId: string) => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    presenceChannelRef.current = supabase.channel(`${PRESENCE_CHANNEL}:${chatRoomId}`, {
      config: {
        presence: {
          key: profile?.id, 
        },
      },
    });

    presenceChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current.presenceState();
        
        const providerState = Object.values(state).flat().find(
          (user: any) => user.user_id === providerId
        ) as PresenceState | undefined;
        
        if (providerState) {
          setIsProviderOnline(true);
          setLastSeen(new Date().toISOString());
          
          if (providerState.typing) {
            setIsProviderTyping(true);
            
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            
            typingTimeoutRef.current = setTimeout(() => {
              setIsProviderTyping(false);
            }, TYPING_TIMEOUT);
          }
        } else {
          setIsProviderOnline(false);
          
          setIsProviderTyping(false);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        if (newPresences.some((presence: any) => presence.user_id === providerId)) {
          setIsProviderOnline(true);
          setLastSeen(new Date().toISOString());
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        if (leftPresences.some((presence: any) => presence.user_id === providerId)) {
          setIsProviderOnline(false);
          setLastSeen(new Date().toISOString());
          
          setIsProviderTyping(false);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
        }
      })
      .subscribe();

    presenceChannelRef.current.track({
      user_id: profile?.id,
      online_at: new Date().toISOString(),
      typing: false,
    });
  }, [chatRoomId, profile?.id]);

  const handleTypingStart = useCallback(() => {
    if (!presenceChannelRef.current || !profile?.id) return;
    
    presenceChannelRef.current.track({
      user_id: profile.id,
      online_at: new Date().toISOString(),
      typing: true,
    });
  }, [profile?.id]);

  const handleTypingEnd = useCallback(() => {
    if (!presenceChannelRef.current || !profile?.id) return;
    
    presenceChannelRef.current.track({
      user_id: profile.id,
      online_at: new Date().toISOString(),
      typing: false,
    });
  }, [profile?.id]);

  const formatLastSeen = useCallback((lastSeenDate: string | null) => {
    if (!lastSeenDate) return 'Never online';
    
    const now = new Date();
    const lastSeen = new Date(lastSeenDate);
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return lastSeen.toLocaleDateString();
  }, []);

  const renderHeader = useCallback(() => (
    <View style={[styles.header, isDark && { backgroundColor: '#0066CC' }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.providerInfo}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: provider?.profile_pic || 'https://via.placeholder.com/150' }}
            style={styles.providerAvatar}
            progressiveRenderingEnabled={true}
            fadeDuration={300}
          />
          {isProviderOnline && (
            <View style={styles.onlineIndicator} />
          )}
        </View>
        
        <View style={styles.providerDetails}>
          <Text style={styles.providerName}>{provider?.name}</Text>
          
          <Text style={styles.providerStatus}>
            {isProviderTyping 
              ? 'typing...' 
              : isProviderOnline 
                ? 'Online' 
                : lastSeen 
                  ? `Last seen ${formatLastSeen(lastSeen)}` 
                  : provider?.providers?.[0]?.services?.[0] || 'Service Provider'
            }
          </Text>
        </View>
      </View>
      
      {isMarkingRead && (
        <View style={styles.loaderContainer}>
          <Logo width={24} height={24} />
        </View>
      )}
    </View>
  ), [provider, isMarkingRead, isDark, isProviderOnline, isProviderTyping, lastSeen, formatLastSeen]);

  const renderSecurityWarning = useCallback(() => {
    if (!showWarning) return null;
    
    return (
      <View style={[
        styles.securityWarningContainer,
        isDark && {
          backgroundColor: 'rgba(255, 248, 225, 0.1)',
          borderColor: 'rgba(255, 224, 130, 0.3)'
        }
      ]}>
        <Ionicons name="shield" size={20} color={isDark ? "#FFB74D" : "#FF9500"} style={styles.warningIcon} />
        <Text style={[
          styles.securityWarningText,
          isDark && { color: colors.text }
        ]}>
          ⚠️ For your security, please ensure all transactions are completed within the app. 
          Never share payment details or arrange payments outside the platform.
        </Text>
      </View>
    );
  }, [showWarning, isDark, colors]);

  const renderLoading = useCallback(() => {
    if (!isLoading || messages.length > 0) return null;
    
    return (
      <View style={[
        styles.loadingContainer,
        isDark && { backgroundColor: colors.secondaryBackground }
      ]}>
        <Logo width={80} height={80} />
        <Text style={[
          styles.loadingText,
          isDark && { color: colors.text }
        ]}>
          Loading messages...
        </Text>
      </View>
    );
  }, [isLoading, messages.length, isDark, colors]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[
        styles.container,
        isDark && { backgroundColor: colors.background }
      ]}>
        {renderHeader()}
        {renderSecurityWarning()}
        <View style={[
          styles.chatBackground,
          isDark && { backgroundColor: colors.secondaryBackground }
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
            showsVerticalScrollIndicator={false} // Hide scrollbar for cleaner UI
            ListFooterComponent={isLoadingMore ? (
              <ActivityIndicator 
                size="small" 
                color={isDark ? colors.tint : Colors.primary} 
                style={styles.loadingMore} 
              />
            ) : null}
            {...listConfig}
          />
          
          {/* Typing indicator */}
          {isProviderTyping && (
            <View style={[
              styles.typingIndicator, 
              isDark && { backgroundColor: 'rgba(0,0,0,0.5)' }
            ]}>
              <View style={styles.typingBubble}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotMiddle]} />
                <View style={styles.typingDot} />
              </View>
              <Text style={[
                styles.typingText,
                isDark && { color: '#DDD' }
              ]}>
                {provider?.name} is typing...
              </Text>
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + insets.bottom : 0}
          style={{ width: '100%' }}
        >
          {showVoiceRecorder ? (
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
              onCancel={handleCancelRecording}
            />
          ) : (
            <ChatInput 
              onSend={handleSendMessage}
              onAttachment={pickDocument}
              onVoiceRecord={toggleVoiceRecorder}
              onTypingStart={handleTypingStart}
              onTypingEnd={handleTypingEnd}
              isDark={isDark}
              replyingTo={replyTo ? {
                id: replyTo.id,
                content: replyTo.content,
                sender: replyTo.sender_id === profile?.id ? 'You' : (provider?.name || 'Provider')
              } : null}
              onCancelReply={cancelReply}
            />
          )}
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
    padding: 10,
    paddingTop: 10,
    backgroundColor: Colors.primary, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  backButton: {
    marginRight: 12,
  },
  providerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    bottom: 0,
    right: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  providerDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
    marginBottom: 1,
  },
  providerStatus: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    color: 'rgba(255,255,255,0.8)',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'column',
    backgroundColor: '#f0f0f0',
  },
  inputActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    marginHorizontal: 8,
    paddingLeft: 12,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 5,
    maxHeight: 100,
    fontFamily: 'Urbanist-Medium',
  },
  sendButton: {
    backgroundColor: Colors.primary, 
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loaderContainer: {
    marginLeft: 8,
    width: 24,
    height: 24,
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
    fontSize: 16,
    color: '#333',
  },
  loadingMore: {
    paddingVertical: 20,
  },
  securityWarningContainer: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 0,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 10,
  },
  securityWarningText: {
    color: '#5D4037',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    lineHeight: 18,
  },
  micButton: {
    backgroundColor: Colors.primary, 
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    width: '100%',
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewBar: {
    width: 2,
    height: '100%',
    backgroundColor: Colors.primary,
    marginRight: 8,
  },
  replyPreviewTextContainer: {
    flex: 1,
  },
  replyPreviewText: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    fontWeight: '500',
    color: '#333',
    paddingVertical: 4,
  },
  replyPreviewClose: {
    padding: 5,
  },
  typingIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '60%',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 3,
    opacity: 0.6,
  },
  typingDotMiddle: {
    opacity: 0.8,
    transform: [{ translateY: -2 }],
  },
  typingText: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
}); 