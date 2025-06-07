import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { useUserStore } from '../../store/useUserStore';
import Animated, { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';
import { 
  getSupportTicket, 
  getSupportMessages, 
  sendSupportMessage, 
  markMessagesAsRead,
  getAutomatedResponse,
  getChatbotResponse,
  SupportMessage,
  SupportTicket
} from '../../services/supportChat';

export default function CustomerSupportChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  const params = useLocalSearchParams<{ ticketId?: string, newTicket?: string, firstMessage?: string }>();
  
  // Define additional theme colors specific to this screen
  const extendedColors = {
    ...colors,
    secondaryBackground: isDark ? '#2C2C2C' : '#f0f0f0',
    border: isDark ? 'rgba(255,255,255,0.2)' : '#e0e0e0',
    gradientStart: isDark ? '#1E3A8A' : '#00456B',
    gradientEnd: isDark ? '#F58220' : Colors.primary,
    inputBackground: isDark ? '#2A2A2A' : '#f5f5f5',
    userMessageBg: isDark ? '#F58220' : Colors.primary,
    botMessageBg: isDark ? '#2a2a2a' : '#e6e6e6',
    systemMessageBg: isDark ? '#1E3A8A' : '#E3F2FD',
  };

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [botMode, setBotMode] = useState(true); // Default to bot mode

  // Load ticket and messages
  useEffect(() => {
    const loadTicketAndMessages = async () => {
      if (!params.ticketId || !profile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Get ticket details
        const ticketData = await getSupportTicket(params.ticketId);
        if (!ticketData) {
          Alert.alert('Error', 'Could not load ticket information');
          router.back();
          return;
        }
        setTicket(ticketData);

        // Get messages
        const messagesData = await getSupportMessages(params.ticketId);
        setMessages(messagesData);

        // Mark messages as read
        await markMessagesAsRead(params.ticketId, profile.id);

        // If it's a new ticket, send the first message from URL params
        if (params.newTicket === 'true' && params.firstMessage) {
          await sendUserMessage(params.firstMessage);
        }
      } catch (error) {
        console.error('Error loading ticket data:', error);
        Alert.alert('Error', 'Failed to load support ticket data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicketAndMessages();
  }, [params.ticketId, profile?.id]);

  const sendUserMessage = async (messageText: string) => {
    if (!ticket || !profile?.id) return;
    
    try {
      // Add user message
      const userMessage = await sendSupportMessage(
        ticket.id,
        profile.id,
        'user',
        messageText
      );
      
      if (!userMessage) {
        throw new Error('Failed to send user message');
      }
      
      setMessages(prev => [...prev, userMessage]);
      
      // Only send automated response in bot mode
      if (botMode) {
        // Generate and send an automated response
        setIsTyping(true);
        
        setTimeout(async () => {
          try {
            // Use the enhanced context-aware chatbot
            const automaticResponse = await getChatbotResponse(
              messageText, 
              messages, 
              profile.role as 'user' | 'provider'
            );
            
            if (automaticResponse) {
              const botMessage = await sendSupportMessage(
                ticket.id,
                null,
                'system',
                automaticResponse
              );
              
              if (botMessage) {
                setMessages(prev => [...prev, botMessage]);
              } else {
                console.error('Failed to save bot response');
              }
            } else {
              // Fallback to generic response if no specific response is matched
              const defaultResponse = await sendSupportMessage(
                ticket.id,
                null,
                'system',
                'Thank you for your message. Our support team will review your inquiry and get back to you soon.'
              );
              
              if (defaultResponse) {
                setMessages(prev => [...prev, defaultResponse]);
              } else {
                console.error('Failed to save default bot response');
              }
            }
          } catch (error) {
            console.error('Error generating bot response:', error);
            Alert.alert('Bot Response Error', 'Failed to generate an automated response. Our support team will review your message.');
          } finally {
            setIsTyping(false);
          }
        }, 1500); // Simulate thinking time for the bot
      } else {
        // In human support mode, add a note that team will respond
        if (messages.length === 0 || messages[messages.length - 1].sender_type !== 'system') {
          setIsTyping(true);
          setTimeout(async () => {
            try {
              const noticeMessage = await sendSupportMessage(
                ticket.id,
                null,
                'system',
                'Thank you for your message. Our support team has been notified and will respond as soon as possible. Typical response time is within 24 hours during business days.'
              );
              
              if (noticeMessage) {
                setMessages(prev => [...prev, noticeMessage]);
              } else {
                console.error('Failed to save system notice message');
              }
            } catch (error) {
              console.error('Error sending system notice:', error);
            } finally {
              setIsTyping(false);
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again or contact support directly.');
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (message.trim() === '' || sendingMessage) return;
    
    const messageToSend = message;
    setMessage('');
    setSendingMessage(true);
    
    try {
      await sendUserMessage(messageToSend);
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Toggle between bot and human support
  const toggleSupportMode = () => {
    const newMode = !botMode;
    setBotMode(newMode);
    
    // Send a notification message about the mode change
    if (ticket && profile?.id) {
      const modeChangeMessage = newMode
        ? "You've switched to AI Assistant mode. The assistant can answer common questions immediately."
        : "You've switched to Human Support mode. A support agent will review and respond to your messages.";
        
      setTimeout(async () => {
        const statusMessage = await sendSupportMessage(
          ticket.id,
          null,
          'system',
          modeChangeMessage
        );
        
        if (statusMessage) {
          setMessages(prev => [...prev, statusMessage]);
        }
      }, 500);
    }
  };

  // Format time for messages
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for message groups
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  // Format the chat header title based on ticket information
  const formatHeaderTitle = () => {
    if (!ticket) return 'Support Chat';
    
    if (ticket.status === 'closed') {
      return 'Ticket Closed';
    }
    
    return `${ticket.issue_type} Support`;
  };

  // Get the appropriate status color for the header
  const getStatusColor = () => {
    if (!ticket) return '#2ECC71'; // Default to green/online
    
    switch (ticket.status) {
      case 'open':
        return '#2ECC71'; // Green
      case 'in_progress':
        return '#3498DB'; // Blue
      case 'resolved':
        return '#9B59B6'; // Purple
      case 'closed':
        return '#E74C3C'; // Red
      default:
        return '#2ECC71';
    }
  };

  // Get the appropriate status text for the header
  const getStatusText = () => {
    if (!ticket) return 'Online';
    
    switch (ticket.status) {
      case 'open':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return 'Open';
    }
  };

  // Determine if we should show a date separator
  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true;
    
    const currentDate = new Date(messages[index].created_at).toDateString();
    const previousDate = new Date(messages[index - 1].created_at).toDateString();
    
    return currentDate !== previousDate;
  };

  // Render a message bubble
  const renderMessage = (msg: SupportMessage, index: number) => {
    const isUser = msg.sender_type === 'user';
    const isSystem = msg.sender_type === 'system';
    const backgroundColor = isUser ? extendedColors.userMessageBg : (isSystem ? extendedColors.botMessageBg : extendedColors.systemMessageBg);
    
    const showDateSeparator = shouldShowDateSeparator(index);
    
    return (
      <React.Fragment key={msg.id}>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: extendedColors.border }]} />
            <Text style={[styles.dateText, { color: extendedColors.subtext, backgroundColor: extendedColors.background }]}>
              {formatDate(msg.created_at)}
            </Text>
            <View style={[styles.dateLine, { backgroundColor: extendedColors.border }]} />
          </View>
        )}
        
        <Animated.View 
          entering={isUser ? SlideInRight.delay(100).duration(300) : FadeInDown.delay(100).duration(300)}
        >
          <View 
            style={[
              styles.messageBubble,
              isUser ? styles.userMessage : styles.agentMessage,
              { backgroundColor }
            ]}
          >
            {!isUser && (
              <View style={styles.messageHeader}>
                <FontAwesome5 
                  name={msg.sender_type === 'system' && botMode ? "robot" : "headset"} 
                  size={12} 
                  color={isDark ? '#aaa' : '#777'} 
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.senderType, { color: isDark ? '#aaa' : '#777' }]}>
                  {msg.sender_type === 'system' && botMode ? 'AI Assistant' : 'Support Team'}
                </Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              { color: isUser ? 'white' : extendedColors.text }
            ]}>
              {msg.message}
            </Text>
            <Text style={[
              styles.timestamp,
              { color: isUser ? 'rgba(255,255,255,0.7)' : extendedColors.subtext }
            ]}>
              {formatTime(msg.created_at)}
            </Text>
          </View>
        </Animated.View>
      </React.Fragment>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: extendedColors.background }]}>
        <View style={[styles.header, { backgroundColor: extendedColors.cardBackground }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={extendedColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: extendedColors.text }]}>Support Chat</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={extendedColors.tint} />
          <Text style={[styles.loadingText, { color: extendedColors.text }]}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: extendedColors.background }]}>
      <View style={[styles.header, { backgroundColor: extendedColors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={extendedColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: extendedColors.text }]}>{formatHeaderTitle()}</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: extendedColors.subtext }]}>{getStatusText()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/support/tickets')}>
          <MaterialIcons name="list" size={24} color={extendedColors.text} />
        </TouchableOpacity>
      </View>

      {/* Bot/Human mode toggle */}
      <View style={[styles.modeToggleContainer, { backgroundColor: extendedColors.cardBackground }]}>
        <View style={styles.modeToggleContent}>
          <View style={[styles.modeIconContainer, { backgroundColor: botMode ? 'rgba(245,130,32,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            {botMode ? (
              <FontAwesome5 name="robot" size={18} color={extendedColors.tint} />
            ) : (
              <FontAwesome5 name="user-alt" size={18} color={extendedColors.tint} />
            )}
          </View>
          <Text style={[styles.modeText, { color: extendedColors.text }]}>
            {botMode ? 'AI Assistant' : 'Human Support'}
          </Text>
          <Switch
            value={botMode}
            onValueChange={toggleSupportMode}
            trackColor={{ false: isDark ? '#555' : '#ccc', true: isDark ? '#F5822055' : '#00456B44' }}
            thumbColor={botMode ? extendedColors.tint : isDark ? '#888' : '#999'}
          />
        </View>
        <Text style={[styles.modeDescription, { color: extendedColors.subtext }]}>
          {botMode 
            ? 'AI Assistant can answer common questions instantly.' 
            : 'Human support agents typically respond within 24 hours.'}
        </Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 ? (
            <Animated.View entering={FadeIn.duration(800)} style={styles.emptyContainer}>
              <LinearGradient
                colors={[extendedColors.gradientStart, extendedColors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconBackground}
              >
                <MaterialIcons name="forum" size={40} color="white" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: extendedColors.text }]}>
                Start a Conversation
              </Text>
              <Text style={[styles.emptyText, { color: extendedColors.subtext }]}>
                No messages yet. Start the conversation by sending a message below.
              </Text>
            </Animated.View>
          ) : (
            messages.map((msg, index) => renderMessage(msg, index))
          )}
          
          {isTyping && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={[
                styles.messageBubble, 
                styles.agentMessage,
                { backgroundColor: extendedColors.botMessageBg }
              ]}>
                <View style={styles.messageHeader}>
                  <FontAwesome5 
                    name={botMode ? "robot" : "headset"} 
                    size={12} 
                    color={isDark ? '#aaa' : '#777'} 
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.senderType, { color: isDark ? '#aaa' : '#777' }]}>
                    {botMode ? 'AI Assistant' : 'Support Team'}
                  </Text>
                </View>
                <View style={styles.typingIndicator}>
                  <View style={[styles.typingDot, { backgroundColor: isDark ? '#888' : '#999' }]} />
                  <View style={[styles.typingDot, { backgroundColor: isDark ? '#888' : '#999' }]} />
                  <View style={[styles.typingDot, { backgroundColor: isDark ? '#888' : '#999' }]} />
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {ticket && ticket.status !== 'closed' ? (
          <View style={[styles.inputContainer, { backgroundColor: extendedColors.cardBackground }]}>
            <View style={[styles.textInputContainer, { backgroundColor: extendedColors.inputBackground, borderColor: extendedColors.border }]}>
              <TextInput
                style={[styles.textInput, { color: extendedColors.text }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                placeholderTextColor={extendedColors.subtext}
                multiline
                maxLength={500}
              />
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: extendedColors.tint },
                (!message.trim() || sendingMessage) && styles.disabledButton
              ]}
              onPress={handleSendMessage}
              disabled={!message.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedTicketFooter, { backgroundColor: extendedColors.cardBackground }]}>
            <MaterialIcons name="info" size={24} color={extendedColors.tint} style={styles.closedIcon} />
            <Text style={[styles.closedText, { color: extendedColors.text }]}>
              This ticket is closed. Create a new ticket for further assistance.
            </Text>
            <TouchableOpacity 
              style={[styles.newTicketButton, { backgroundColor: extendedColors.tint }]}
              onPress={() => router.push('/support/new-ticket')}
            >
              <Text style={styles.newTicketButtonText}>New Ticket</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  headerButton: {
    padding: '8@s',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: '6@s',
    height: '6@s',
    borderRadius: '3@s',
    marginRight: '4@s',
  },
  statusText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
  },
  modeToggleContainer: {
    paddingVertical: '10@s',
    paddingHorizontal: '16@s',
    borderBottomWidth: '1@s',
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeIconContainer: {
    width: '32@s',
    height: '32@s',
    borderRadius: '16@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    marginLeft: '10@s',
    fontSize: '15@s',
    fontFamily: 'Urbanist-SemiBold',
  },
  modeDescription: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Regular',
    marginTop: '4@s',
    marginLeft: '42@s',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: '12@s',
  },
  messagesContent: {
    paddingTop: '16@s',
    paddingBottom: '8@s',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: '12@s',
  },
  dateLine: {
    flex: 1,
    height: '1@s',
  },
  dateText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    paddingHorizontal: '10@s',
    borderRadius: '10@s',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12@s',
    borderRadius: '18@s',
    marginBottom: '8@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: '4@s',
  },
  agentMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: '4@s',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '4@s',
  },
  senderType: {
    fontSize: '11@s',
    fontFamily: 'Urbanist-Medium',
  },
  messageText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '15@s',
    lineHeight: '21@s',
  },
  timestamp: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '11@s',
    alignSelf: 'flex-end',
    marginTop: '4@s',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '24@s',
  },
  typingDot: {
    width: '8@s',
    height: '8@s',
    borderRadius: '4@s',
    marginRight: '4@s',
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '12@s',
    paddingVertical: '10@s',
    borderTopWidth: '1@s',
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: '24@s',
    paddingHorizontal: '16@s',
    borderWidth: '1@s',
  },
  textInput: {
    flex: 1,
    paddingVertical: '10@s',
    fontSize: '15@s',
    fontFamily: 'Urbanist-Regular',
    maxHeight: '100@s',
  },
  sendButton: {
    width: '40@s',
    height: '40@s',
    borderRadius: '20@s',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: '8@s',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: '16@s',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
  },
  closedTicketFooter: {
    padding: '16@s',
    alignItems: 'center',
    borderTopWidth: '1@s',
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  closedIcon: {
    marginBottom: '8@s',
  },
  closedText: {
    fontSize: '15@s',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    marginBottom: '16@s',
  },
  newTicketButton: {
    paddingVertical: '10@s',
    paddingHorizontal: '20@s',
    borderRadius: '30@s',
  },
  newTicketButtonText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Bold',
    color: 'white',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '24@s',
    paddingVertical: '40@s',
  },
  emptyIconBackground: {
    width: '80@s',
    height: '80@s',
    borderRadius: '40@s',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '16@s',
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
    lineHeight: '22@s',
  },
}); 