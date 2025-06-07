import React, { memo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated } from 'react-native';
import { Avatar } from 'react-native-paper';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { VoiceNote } from '../common/VoiceNote';
import { Colors } from '../../constants/Colors';
import { Swipeable } from 'react-native-gesture-handler';

// Define ChatMessage interface if it's not imported from types
interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file';
  created_at: string;
  file_name?: string;
  duration?: string; // Duration in milliseconds for voice messages
  replied_to_id?: string;
  replied_to_content?: string;
  replied_to_sender_id?: string;
  is_read?: boolean;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

interface MessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  displayName?: string;
  senderImage?: string;
  senderName?: string;
  onImagePress?: (imageUrl: string) => void;
  onReply?: (message: ChatMessage) => void;
  onMessageDelete?: (messageId: string) => void;
  isDark?: boolean;
  colors?: any; // Theme colors
}

function formatMessageTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

const ChatMessageComponent: React.FC<MessageProps> = ({
  message,
  isOwnMessage,
  showAvatar = true,
  displayName = '',
  senderImage,
  senderName,
  onImagePress,
  onReply,
  onMessageDelete,
  isDark = false,
  colors,
}) => {
  // Create animation values with React.useMemo to avoid recreating them on re-render
  const animations = React.useMemo(() => ({
    fadeAnim: new Animated.Value(0),
    scaleAnim: new Animated.Value(0.95)
  }), []);
  
  const swipeableRef = useRef<Swipeable | null>(null);
  
  // Run animation only once when component mounts
  useEffect(() => {
    const { fadeAnim, scaleAnim } = animations;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
    
    // Cleanup animations to prevent memory leaks
    return () => {
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
    };
  }, []);

  // Memoize computed values to avoid recalculations
  const messageTime = React.useMemo(() => formatMessageTime(message.created_at), [message.created_at]);
  const isVoiceMessage = message.type === 'voice';
  const isTempMessage = message.id.toString().startsWith('temp-');
  
  // Use theme colors if provided, otherwise use defaults
  const themeBackground = React.useMemo(() => 
    isDark 
      ? colors?.cardBackground || '#2A2A2A'
      : colors?.cardBackground || '#FFFFFF'
  , [isDark, colors]);
  
  // If it's not a voice message, use these backgrounds
  const backgroundColor = React.useMemo(() => 
    isOwnMessage
      ? isDark ? '#0078FF' : 'rgb(71, 84, 145)' // Primary blue for dark mode
      : themeBackground
  , [isOwnMessage, isDark, themeBackground]);
  
  // Text color depends on message type and sender
  const textColor = React.useMemo(() => 
    isOwnMessage 
      ? '#FFFFFF' 
      : isDark ? colors?.text || '#E0E0E0' : '#000000'
  , [isOwnMessage, isDark, colors]);

  // Memoize functions that are passed to child components
  const handleImagePress = React.useCallback(() => {
    if (onImagePress && message.content) {
      onImagePress(message.content);
    }
  }, [onImagePress, message.content]);
  
  const handleReply = React.useCallback(() => {
    if (onReply) {
      onReply(message);
      if (swipeableRef.current) {
        swipeableRef.current.close();
      }
    }
  }, [onReply, message, swipeableRef]);
  
  const handleDelete = React.useCallback(() => {
    if (onMessageDelete) {
      onMessageDelete(message.id);
      if (swipeableRef.current) {
        swipeableRef.current.close();
      }
    }
  }, [onMessageDelete, message.id, swipeableRef]);

  // Generate avatar color based on sender ID
  const getAvatarColor = (id: string) => {
    const colors = [
      '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
      '#f1c40f', '#e67e22', '#e74c3c', '#f39c12', '#d35400',
    ];
    // Simple hash function to generate a consistent color for a given ID
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get initials from display name
  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Render message status indicator
  const renderMessageStatus = () => {
    if (!isOwnMessage || isVoiceMessage) return null;
    
    // For temporary messages, show a sending indicator
    if (isTempMessage) {
      return (
        <View style={styles.statusContainer}>
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
        </View>
      );
    }
    
    // For regular messages, show appropriate status
    switch (message.status || (message.is_read ? 'read' : 'delivered')) {
      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="alert-circle" size={14} color="red" />
          </View>
        );
      case 'sent':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        );
      case 'delivered':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        );
      case 'read':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={14} color="#67E8F9" />
          </View>
        );
      default:
        return null;
    }
  };

  // Function to render avatar
  const renderAvatar = () => {
    if (!showAvatar) return null;
    
    // If sender image is provided, use it
    if (senderImage) {
      return (
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: senderImage }} 
            style={styles.avatarImage}
            progressiveRenderingEnabled={true}
            fadeDuration={300}
          />
        </View>
      );
    }
    
    return (
      <View style={styles.avatarContainer}>
        <Avatar.Text
          size={32}
          label={getInitials(displayName || senderName || '')}
          color="#FFFFFF"
          style={{ backgroundColor: getAvatarColor(message.sender_id) }}
          labelStyle={styles.avatarLabel}
        />
      </View>
    );
  };

  // Function to render reply content if this message is a reply
  const renderReplyContent = () => {
    if (!message.replied_to_content) return null;
    
    const isRepliedToSelf = message.replied_to_sender_id === message.sender_id;
    
    return (
      <View style={[
        styles.replyContainer,
        isOwnMessage 
          ? isDark 
            ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' } 
            : styles.ownReplyContainer 
          : isDark 
            ? { backgroundColor: 'rgba(0, 0, 0, 0.2)' } 
            : styles.otherReplyContainer
      ]}>
        <View style={[
          styles.replyBar,
          isDark && { backgroundColor: isOwnMessage ? '#67E8F9' : Colors.primary }
        ]} />
        <View style={styles.replyContent}>
          <Text style={[
            styles.replyName,
            isOwnMessage && { color: isDark ? '#67E8F9' : 'rgba(255, 255, 255, 0.9)' },
            !isOwnMessage && isDark && { color: Colors.primary }
          ]}>
            {isRepliedToSelf ? 'You' : displayName || senderName || 'User'}
          </Text>
          <Text 
            style={[
              styles.replyText,
              isOwnMessage && { color: 'rgba(255, 255, 255, 0.8)' },
              !isOwnMessage && isDark && { color: 'rgba(255, 255, 255, 0.7)' }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {message.replied_to_content}
          </Text>
        </View>
      </View>
    );
  };

  // Function to render the appropriate content based on message type
  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <TouchableOpacity
            onPress={handleImagePress}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: message.content }}
              style={styles.imageContent}
              resizeMode="cover"
              progressiveRenderingEnabled={true}
              fadeDuration={300}
            />
            {message.file_name && (
              <Text style={[
                styles.imageCaption,
                isDark && { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#AAA' }
              ]}>
                {message.file_name}
              </Text>
            )}
          </TouchableOpacity>
        );
      
      case 'voice':
        // Parse duration if it exists
        const messageDuration = message.duration ? parseInt(message.duration) : 0;
        
        return (
          <VoiceNote
            isOwnMessage={isOwnMessage}
            audioUri={message.content}
            duration={messageDuration}
            isDark={isDark}
          />
        );
      
      case 'file':
        return (
          <TouchableOpacity
            style={[
              styles.fileContainer,
              isDark && { 
                backgroundColor: isOwnMessage 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.2)' 
              }
            ]}
            onPress={() => {
              // Open file URL in browser
              // This is a placeholder for file handling
              // You might want to download or preview the file
            }}
          >
            <Ionicons 
              name="document-outline" 
              size={24} 
              color={isDark ? '#67E8F9' : Colors.primary} 
            />
            <Text style={[
              styles.fileName,
              isDark && { color: isOwnMessage ? '#FFF' : '#DDD' }
            ]}>
              {message.file_name || 'Attachment'}
            </Text>
          </TouchableOpacity>
        );
      
      case 'text':
      default:
        return (
          <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>
        );
    }
  };

  // Render the right actions for the swipeable (reply button)
  const renderRightActions = () => {
    return (
      <TouchableOpacity 
        style={[
          styles.replyAction,
          isDark && { backgroundColor: Colors.primary }
        ]}
        onPress={handleReply}
      >
        <Ionicons name="arrow-undo-outline" size={20} color="#FFFFFF" />
        <Text style={styles.replyActionText}>Reply</Text>
      </TouchableOpacity>
    );
  };

  // Render the left actions for the swipeable (delete button)
  const renderLeftActions = () => {
    if (!isOwnMessage || !onMessageDelete) return null;
    
    return (
      <TouchableOpacity 
        style={[
          styles.deleteAction,
          isDark && { backgroundColor: '#E53935' }
        ]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableRightOpen={handleReply}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
    >
      <Animated.View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          { opacity: animations.fadeAnim, transform: [{ scale: animations.scaleAnim }] }
        ]}
      >
        {!isOwnMessage && renderAvatar()}
        
        <View style={[
          styles.messageBubble, 
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          isVoiceMessage 
            ? { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, padding: 0 } 
            : { backgroundColor },
          isDark && !isOwnMessage && { 
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: StyleSheet.hairlineWidth
          }
        ]}>
          {!isOwnMessage && displayName && !isVoiceMessage && (
            <Text style={[
              styles.senderName,
              isDark && { color: Colors.primary }
            ]}>
              {displayName || senderName}
            </Text>
          )}
          
          {renderReplyContent()}
          {renderMessageContent()}
          
          {!isVoiceMessage && (
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                isOwnMessage && styles.ownMessageTime,
                isDark && !isOwnMessage && { color: 'rgba(255,255,255,0.5)' }
              ]}>
                {messageTime}
              </Text>
              
              {renderMessageStatus()}
            </View>
          )}
        </View>
      </Animated.View>
    </Swipeable>
  );
};

// Update the React.memo comparison function to be more thorough
export const ChatMessage = memo(ChatMessageComponent, (prevProps, nextProps) => {
  // Deep compare relevant properties of the message to avoid unnecessary re-renders
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.senderName === nextProps.senderName &&
    prevProps.message.replied_to_id === nextProps.message.replied_to_id &&
    prevProps.message.is_read === nextProps.message.is_read &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isDark === nextProps.isDark &&
    // For types that require special comparison:
    (prevProps.message.type === 'voice' ? 
      prevProps.message.duration === nextProps.message.duration : true) &&
    (prevProps.message.type === 'file' || prevProps.message.type === 'image' ? 
      prevProps.message.file_name === nextProps.message.file_name : true)
  );
});

const styles = ScaledSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: '4@ms',
    paddingHorizontal: '12@ms',
    width: '100%',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: '8@ms',
    alignSelf: 'flex-end',
    marginBottom: '4@ms',
  },
  avatarImage: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
  },
  avatarLabel: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  messageBubble: {
    padding: '10@ms',
    maxWidth: '80%',
    minWidth: '100@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  ownMessageBubble: {
    borderRadius: '18@ms',
    borderTopRightRadius: '4@ms',
    marginRight: '4@ms', // Space for the tail effect
  },
  otherMessageBubble: {
    borderRadius: '18@ms',
    borderTopLeftRadius: '4@ms',
    marginLeft: '4@ms', // Space for the tail effect
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  senderName: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@ms',
    color: Colors.primary,
    marginBottom: '4@ms',
  },
  messageText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '15@ms',
    lineHeight: '21@ms',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: '4@ms',
  },
  messageTime: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '10@ms',
    color: '#888',
    marginRight: '4@ms',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statusContainer: {
    marginLeft: '2@ms',
  },
  imageContent: {
    width: '200@ms',
    height: '200@ms',
    borderRadius: '12@ms',
    backgroundColor: '#f0f0f0',
  },
  imageCaption: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '12@ms',
    color: '#666',
    marginTop: '4@ms',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '12@ms',
    padding: '8@ms',
  },
  fileName: {
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@ms',
    color: Colors.primary,
    marginLeft: '8@ms',
    flex: 1,
  },
  replyAction: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: '70@ms',
    height: '100%',
    flexDirection: 'column',
    borderRadius: '12@ms',
    marginRight: '4@ms',
  },
  replyActionText: {
    color: '#FFFFFF',
    fontSize: '12@ms',
    marginTop: '4@ms',
    fontFamily: 'Urbanist-Medium',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: '70@ms',
    height: '100%',
    flexDirection: 'column',
    borderRadius: '12@ms',
    marginLeft: '4@ms',
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: '12@ms',
    marginTop: '4@ms',
    fontFamily: 'Urbanist-Medium',
  },
  replyContainer: {
    flexDirection: 'row',
    paddingVertical: '6@ms',
    marginBottom: '8@ms',
    borderRadius: '8@ms',
    maxWidth: '95%',
  },
  ownReplyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  otherReplyContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyBar: {
    width: '2@ms',
    marginRight: '6@ms',
    borderRadius: '1@ms',
    backgroundColor: Colors.primary,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontFamily: 'Urbanist-Bold',
    fontSize: '11@ms',
    color: Colors.primary,
    marginBottom: '2@ms',
  },
  replyText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '12@ms',
    color: '#666',
  },
}); 