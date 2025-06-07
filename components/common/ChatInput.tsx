import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Animated, Platform } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface ChatInputProps {
  onSend: (message: string) => void;
  onAttachment?: () => void;
  onVoiceRecord?: () => void;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
  isDark?: boolean;
  replyingTo?: { id: string; content: string; sender: string } | null;
  onCancelReply?: () => void;
}

export function ChatInput({ 
  onSend, 
  onAttachment, 
  onVoiceRecord,
  onTypingStart,
  onTypingEnd,
  isDark = false,
  replyingTo,
  onCancelReply
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const buttonScale = React.useRef(new Animated.Value(1)).current;
  
  // Animation for the send button
  const animateSendButton = (toValue: number) => {
    Animated.spring(buttonScale, {
      toValue,
      friction: 5,
      tension: 140,
      useNativeDriver: true
    }).start();
  };

  useEffect(() => {
    // If there's content, scale the button up slightly
    if (message.trim().length > 0) {
      animateSendButton(1.1);
    } else {
      animateSendButton(1);
    }
  }, [message]);

  const handleChangeText = (text: string) => {
    setMessage(text);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }
    
    // Clear existing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Set new timeout
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      onTypingEnd?.();
    }, 1500);
  };

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
      
      // Clear typing indicator
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      setIsTyping(false);
      onTypingEnd?.();
    }
  };

  return (
    <View style={[
      styles.container,
      isDark && { backgroundColor: '#1E1E1E', borderTopColor: '#333' }
    ]}>
      {/* Reply indicator */}
      {replyingTo && (
        <View style={[
          styles.replyContainer,
          isDark && { backgroundColor: '#2A2A2A', borderColor: '#444' }
        ]}>
          <View style={styles.replyContent}>
            <View style={styles.replyBar} />
            <View style={styles.replyTextContainer}>
              <Text style={[
                styles.replyName,
                isDark && { color: '#E0E0E0' }
              ]}>
                {replyingTo.sender}
              </Text>
              <Text 
                style={[
                  styles.replyText,
                  isDark && { color: '#BBBBBB' }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {replyingTo.content}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.replyClose}>
            <Ionicons name="close" size={18} color={isDark ? "#BBB" : "#777"} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputRow}>
        {/* Attachment button */}
        <TouchableOpacity 
          style={[styles.circleButton, isDark && { backgroundColor: '#333' }]} 
          onPress={onAttachment}
        >
          <Ionicons 
            name="add" 
            size={24} 
            color={isDark ? "#CCC" : Colors.primary} 
          />
        </TouchableOpacity>
        
        {/* Input field */}
        <View style={[
          styles.inputContainer,
          isDark && { backgroundColor: '#333', borderColor: '#444' }
        ]}>
          <TextInput
            value={message}
            onChangeText={handleChangeText}
            placeholder="Type a message..."
            style={[
              styles.input,
              isDark && { color: '#E0E0E0' }
            ]}
            placeholderTextColor={isDark ? "#999" : "#999"}
            multiline
            maxLength={500}
          />
        </View>
        
        {/* Send/Voice button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity 
            style={[
              styles.circleButton, 
              styles.sendButton, 
              !message.trim() && styles.voiceButton,
              !message.trim() && isDark && { backgroundColor: '#0070E0' }
            ]}
            onPress={message.trim() ? handleSend : onVoiceRecord}
          >
            <Ionicons 
              name={message.trim() ? "send" : "mic"} 
              size={20} 
              color="white" 
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: '8@ms',
    paddingVertical: '10@ms',
    gap: '8@ms',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: '24@ms',
    paddingVertical: '8@ms',
    paddingHorizontal: '16@ms',
    maxHeight: '120@ms',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  input: {
    flex: 1,
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    paddingHorizontal: '4@ms',
    minHeight: '24@ms',
    maxHeight: '100@ms',
  },
  emojiButton: {
    padding: '6@ms',
    alignSelf: 'flex-end',
  },
  circleButton: {
    width: '42@ms',
    height: '42@ms',
    borderRadius: '21@ms',
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    // Shadow for Android
    elevation: 1,
  },
  sendButton: {
    backgroundColor: Colors.primary,
  },
  voiceButton: {
    backgroundColor: Colors.primary,
  },
  replyContainer: {
    flexDirection: 'row',
    padding: '8@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  replyContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBar: {
    width: '3@ms',
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: '1.5@ms',
    marginRight: '8@ms',
  },
  replyTextContainer: {
    flex: 1,
  },
  replyName: {
    fontFamily: 'Urbanist-Bold',
    fontSize: '12@ms',
    color: Colors.primary,
    marginBottom: '2@ms',
  },
  replyText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '12@ms',
    color: '#666',
  },
  replyClose: {
    padding: '6@ms',
  },
}); 