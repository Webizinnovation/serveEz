import React, { useState, useCallback, memo, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Modal, Alert } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { Message } from '../../types/index';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../services/supabase';
import { VoiceNote } from './VoiceNote';
import { Swipeable } from 'react-native-gesture-handler';
import { useUserStore } from '../../store/useUserStore';

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  senderImage?: string;
  senderName?: string;
  onMessageDelete?: (messageId: string) => void;
  isDark?: boolean;
  colors?: any;
  onReply?: (message: Message) => void;
}

const formatDate = (date: string) => {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Format the time part
  const time = messageDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Format the date part
  const dateStr = messageDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });

  // Always include the date and time
  if (messageDate.toDateString() === today.toDateString()) {
    return `Today ${dateStr}, ${time}`;
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${dateStr}, ${time}`;
  } else {
    return `${dateStr}, ${time}`;
  }
};


const getFileIcon = (fileName: string) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  
  if (!ext) return 'document-outline';
  
  switch (ext) {
    case 'pdf':
      return 'document-text-outline';
    case 'doc':
    case 'docx':
      return 'document-text-outline';
    case 'xls':
    case 'xlsx':
      return 'grid-outline';
    case 'ppt':
    case 'pptx':
      return 'easel-outline';
    case 'zip':
    case 'rar':
      return 'archive-outline';
    default:
      return 'document-outline';
  }
};

// Memoize the ChatMessage component to prevent unnecessary re-renders
export const ChatMessage = memo(({ 
  message, 
  isOwnMessage, 
  senderImage, 
  senderName, 
  onMessageDelete,
  isDark,
  colors,
  onReply
}: ChatMessageProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const isVoice = message.type === 'voice';
  const swipeableRef = useRef<Swipeable>(null);
  const { profile } = useUserStore();
  
  // Use useCallback for event handlers to prevent recreation on each render
  const handleLongPress = useCallback(() => {
    if (!isOwnMessage || deleting) return;

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete
        }
      ]
    );
  }, [isOwnMessage, deleting, message.id]);

  const handleDelete = useCallback(async () => {
    if (!message.id || deleting) return;

    try {
      setDeleting(true);
      
      // Verify that the user has permission to delete this message
      if (message.sender_id !== profile?.id) {
        console.error('Cannot delete message: User ID does not match sender ID');
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'You can only delete your own messages',
          position: 'bottom'
        });
        setDeleting(false);
        return;
      }

      // Delete file from storage if applicable
      if ((isFile || isImage || isVoice) && message.content) {
        try {
          const fileUrl = new URL(message.content);
          const pathParts = fileUrl.pathname.split('/');
          const fileName = pathParts[pathParts.length - 1];
 
          const { error: storageError } = await supabase.storage
            .from('chat-attachments')
            .remove([fileName]);

          if (storageError) {
            console.warn('Storage deletion failed but continuing with message deletion', storageError);
          } else {
            console.log('Successfully deleted file from storage:', fileName);
          }
        } catch (error) {
          console.warn('File URL parsing failed but continuing with message deletion', error);
        }
      }
      
      // Attempt database deletion
      const { error: dbError, data } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', message.id)
        .eq('sender_id', profile?.id) // Ensure sender_id matches profile ID for RLS
        .select('id'); // Return deleted record to confirm deletion

      if (dbError) {
        console.error('Error deleting message from database:', dbError);
        throw dbError;
      } 
      
      // Verify deletion was successful
      if (!data || data.length === 0) {
        console.warn('Message may not have been deleted from database - no records returned');
        // Continue anyway since we want to remove it from UI
      } else {
        console.log('Successfully deleted message from database:', message.id);
      }

      // Update local UI state
      if (onMessageDelete) {
        onMessageDelete(message.id);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Message deleted successfully',
        position: 'bottom'
      });
    } catch (error) {
      console.error('Delete message error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete message. Please try again.',
        position: 'bottom'
      });
    } finally {
      setDeleting(false);
    }
  }, [message.id, message.sender_id, isFile, isImage, isVoice, message.content, onMessageDelete, deleting, profile?.id]);

  const handleFilePress = useCallback(async () => {
    if (!message.content) return;

    if (isImage) {
      setShowImageModal(true);
      return;
    }

    try {
      setDownloading(true);
      const fileExt = (message.file_name || message.content).split('.').pop()?.toLowerCase();
      
      const canHandleNatively = ['pdf', 'doc', 'docx', 'txt'].includes(fileExt || '');
      
      if (canHandleNatively) {
        await Linking.openURL(message.content);
      } else {
        const fileName = message.file_name || `downloaded_file.${fileExt}`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const downloadResumable = FileSystem.createDownloadResumable(
          message.content,
          fileUri,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          }
        );

        const result = await downloadResumable.downloadAsync();
        
        if (result?.uri) {
          await Linking.openURL(result.uri);
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open file. Please try again.',
        position: 'bottom'
      });
    } finally {
      setDownloading(false);
    }
  }, [message.content, message.file_name, isImage]);

  // Render reply content if this message is a reply
  const renderReplyContent = () => {
    if (!message.replied_to_content) return null;
    
    return (
      <View style={[
        styles.replyContainer,
        isOwnMessage ? styles.ownReplyContainer : styles.otherReplyContainer
      ]}>
        <View style={styles.replyBar} />
        <View style={styles.replyContent}>
          <Text 
            style={[
              styles.replyText,
              { color: isOwnMessage ? 'black' : '#333' },
              isDark && { color: isOwnMessage ? '#fff' : colors?.text || '#eee' }
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

  // Render the right actions for received messages
  const renderRightActions = useCallback(() => {
    // Return a completely transparent view with no icon
    return (
      <View style={{
        width: 50,
        backgroundColor: 'transparent'
      }} />
    );
  }, []);

  // Render the left actions for own messages
  const renderLeftActions = useCallback(() => {
    // Return a completely transparent view with no icon
    return (
      <View style={{
        width: 50,
        backgroundColor: 'transparent'
      }} />
    );
  }, []);

  // Empty function for when we don't want to render actions
  const renderEmptyActions = useCallback(() => null, []);

  const messageContent = (
    <View
      style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.receivedMessage
      ]}
    >
      <TouchableOpacity 
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.receivedBubble,
          isImage && styles.imageBubble,
          isVoice && styles.voiceBubble,
          isDark && !isOwnMessage && !isImage && !isVoice && { 
            backgroundColor: colors?.cardBackground || '#262626',
            borderColor: colors?.border || '#333',
            borderWidth: 1
          }
        ]}
        onLongPress={!isImage && !isVoice ? handleLongPress : undefined}
        delayLongPress={500}
        disabled={!isOwnMessage || deleting || isImage || isVoice}
      >
        {deleting && !isImage && !isVoice && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        
        {renderReplyContent()}

        {isImage ? (
          <View>
            <View style={styles.imageContainer}>
              <TouchableOpacity
                onPress={handleFilePress}
                activeOpacity={0.9}
                disabled={downloading}
              >
                <Image
                  source={{ uri: message.content }}
                  style={styles.imageContent}
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                />
                {imageLoading && (
                  <ActivityIndicator 
                    size="small" 
                    color={Colors.primary}
                    style={styles.imageLoader}
                  />
                )}
              </TouchableOpacity>
              {message.file_name && (
                <Text style={styles.imageCaption}>{message.file_name}</Text>
              )}
            </View>
            <View style={styles.whatsappTimeContainer}>
              <Text style={[
                styles.inlineTime,
                isOwnMessage ? styles.ownMessageTime : styles.receivedMessageTime,
                isDark && !isOwnMessage && { color: colors?.subtext || '#999' }
              ]}>
                {formatDate(message.created_at)}
              </Text>
              {isOwnMessage && message.is_read && (
                <Ionicons 
                  name="checkmark-done" 
                  size={13} 
                  color={isDark ? 'rgba(255, 255, 255, 0.7)' : '#4CAF50'} 
                  style={styles.readStatus} 
                />
              )}
            </View>
          </View>
        ) : isFile ? (
          <View>
            <View style={styles.fileRowContainer}>
              <TouchableOpacity
                style={styles.fileContainer}
                onPress={handleFilePress}
                disabled={downloading}
              >
                <Ionicons 
                  name={getFileIcon(message.file_name || '')} 
                  size={24} 
                  color={isDark ? colors?.tint || '#33a9d4' : Colors.primary} 
                />
                <View style={styles.fileInfo}>
                  <Text 
                    style={[
                      styles.fileName,
                      isDark && { color: colors?.text || '#fff' }
                    ]}
                    numberOfLines={1}
                  >
                    {message.file_name || 'Attachment'}
                  </Text>
                  {downloading && (
                    <ActivityIndicator 
                      size="small" 
                      color={isDark ? colors?.tint || '#33a9d4' : Colors.primary}
                      style={styles.fileLoader}
                    />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.whatsappTimeContainer}>
                <Text style={[
                  styles.inlineTime,
                  isOwnMessage ? styles.ownMessageTime : styles.receivedMessageTime,
                  isDark && !isOwnMessage && { color: colors?.subtext || '#999' }
                ]}>
                  {formatDate(message.created_at)}
                </Text>
                {isOwnMessage && message.is_read && (
                  <Ionicons 
                    name="checkmark-done" 
                    size={13} 
                    color={isDark ? 'rgba(255, 255, 255, 0.7)' : '#4CAF50'} 
                    style={styles.readStatus} 
                  />
                )}
              </View>
            </View>
          </View>
        ) : isVoice ? (
          <View>
            <View style={styles.voiceRowContainer}>
              <VoiceNote 
                audioUri={message.content} 
                duration={message.duration ? parseInt(message.duration) : 0}
                isOwnMessage={isOwnMessage}
                isDark={isDark}
                colors={colors}
              />
              <View style={styles.whatsappTimeContainer}>
                <Text style={[
                  styles.inlineTime,
                  isOwnMessage ? styles.ownMessageTime : styles.receivedMessageTime,
                  isDark && !isOwnMessage && { color: colors?.subtext || '#999' }
                ]}>
                  {formatDate(message.created_at)}
                </Text>
                {isOwnMessage && message.is_read && (
                  <Ionicons 
                    name="checkmark-done" 
                    size={13} 
                    color={isDark ? 'rgba(255, 255, 255, 0.7)' : '#4CAF50'} 
                    style={styles.readStatus} 
                  />
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.textContentContainer}>
            <Text style={[
              styles.messageText,
              isDark && { color: isOwnMessage ? '#fff' : colors?.text || '#fff' }
            ]}>
              {message.content}
            </Text>
            <View style={styles.whatsappTimeContainer}>
              <Text style={[
                styles.inlineTime,
                isOwnMessage ? styles.ownMessageTime : styles.receivedMessageTime,
                isDark && !isOwnMessage && { color: colors?.subtext || '#999' }
              ]}>
                {formatDate(message.created_at)}
              </Text>
              {isOwnMessage && message.is_read && (
                <Ionicons 
                  name="checkmark-done" 
                  size={13} 
                  color={isDark ? 'rgba(255, 255, 255, 0.7)' : '#4CAF50'} 
                  style={styles.readStatus} 
                />
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {showImageModal && (
        <Modal
          visible={showImageModal}
          transparent={true}
          onRequestClose={() => setShowImageModal(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: message.content }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );

  // If we have an onReply handler, wrap the message in a Swipeable component
  if (onReply) {
    if (isOwnMessage) {
      // For own messages, enable left swipe only
      return (
        <Swipeable
          ref={swipeableRef}
          renderLeftActions={renderLeftActions}
          onSwipeableLeftOpen={() => {
            onReply(message);
            // Close the swipeable immediately
            setTimeout(() => {
              swipeableRef.current?.close();
            }, 100);
          }}
          friction={1}
          leftThreshold={30}
          overshootLeft={true}
          overshootRight={false}
          enabled={true}
          enableTrackpadTwoFingerGesture
        >
          {messageContent}
        </Swipeable>
      );
    } else {
      // For received messages, enable right swipe only
      return (
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          onSwipeableRightOpen={() => {
            onReply(message);
            // Close the swipeable immediately
            setTimeout(() => {
              swipeableRef.current?.close();
            }, 100);
          }}
          friction={1}
          rightThreshold={30}
          overshootLeft={false}
          overshootRight={true}
          enabled={true}
          enableTrackpadTwoFingerGesture
        >
          {messageContent}
        </Swipeable>
      );
    }
  }

  // Otherwise just return the message content
  return messageContent;
}, (prevProps, nextProps) => {
  // Memoization comparison function - only re-render if these props changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.is_read === nextProps.message.is_read &&
    prevProps.isOwnMessage === nextProps.isOwnMessage
  );
});

const styles = ScaledSheet.create({
  messageContainer: {
    marginVertical: '2@ms',
    maxWidth: '90%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    marginLeft: '25@ms',
    marginRight: '4@ms',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    marginRight: '25@ms',
    marginLeft: '4@ms',
    marginVertical: '2@ms',
  },
  avatar: {
    width: '28@ms',
    height: '28@ms',
    borderRadius: '14@ms',
    marginRight: '6@ms',
  },
  messageBubble: {
    padding: '6@ms',
    borderRadius: '8@ms',
    minWidth: '60@ms',
  },
  ownBubble: {
    backgroundColor: 'rgba(80, 150, 230, 0.1)',
    borderTopRightRadius: '0@ms',
    borderBottomRightRadius: '8@ms',
    borderBottomLeftRadius: '8@ms',
    borderTopLeftRadius: '8@ms',
  },
  receivedBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: '0@ms',
    borderBottomRightRadius: '8@ms',
    borderBottomLeftRadius: '8@ms',
    borderTopRightRadius: '8@ms',
  },
  imageBubble: {
    padding: '2@ms',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  senderName: {
    fontSize: '11@ms',
    color: Colors.primary,
    marginBottom: '2@ms',
    fontFamily: 'Urbanist-Medium',
  },
  messageText: {
    fontSize: '15@ms',
    fontFamily: 'Urbanist-Regular',
    lineHeight: '19@ms',
    width: '100%',
    marginBottom: '4@ms',
  },
  ownMessageText: {
    color: '#303030',
  },
  receivedMessageText: {
    color: '#303030',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: '2@ms',
  },
  timeText: {
    fontSize: '10@ms',
    fontFamily: 'Urbanist-Regular',
  },
  ownTimeText: {
    color: 'rgba(0,0,0,0.45)',
  },
  receivedTimeText: {
    color: 'rgba(0,0,0,0.45)',
  },
  readStatus: {
    marginLeft: '3@ms',
  },
  imageContainer: {
    width: '260@ms',
    position: 'relative',
  },
  imageContent: {
    width: '260@ms',
    height: '180@ms',
    borderRadius: '6@ms',
  },
  imageCaptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '4@ms',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  imageCaption: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#fff',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '20@ms',
    zIndex: 1,
  },
  voiceBubble: {
    padding: '3@ms',
    minWidth: '200@ms',
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginVertical: '-1@ms',
  },
  image: {
    width: '200@ms',
    height: '200@ms',
    borderRadius: '6@ms',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileRowContainer: {
    flexDirection: 'column',
    width: '100%',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '8@ms',
    width: '100%',
  },
  fileIconContainer: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  ownFileIcon: {
    backgroundColor: 'rgba(7,94,84,0.1)', // WhatsApp green with low opacity
  },
  receivedFileIcon: {
    backgroundColor: 'rgba(7,94,84,0.1)',
  },
  fileDetails: {
    flex: 1,
    marginRight: '8@ms',
  },
  fileName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  fileAction: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  fileType: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
  },
  replyAction: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: '70@ms',
    height: '100%',
    flexDirection: 'column',
    borderRadius: '8@ms',
    marginRight: '4@ms',
  },
  replyActionText: {
    color: '#FFFFFF',
    fontSize: '12@ms',
    marginTop: '4@ms',
    fontFamily: 'Urbanist-Medium',
  },
  replyContainer: {
    flexDirection: 'row',
    paddingVertical: '4@ms',
    marginBottom: '4@ms',
    borderRadius: '6@ms',
    maxWidth: '98%',
  },
  ownReplyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  otherReplyContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyBar: {
    width: '2@ms',
    marginRight: '4@ms',
    borderRadius: '1@ms',
    backgroundColor: Colors.primary,
  },
  replyContent: {
    flex: 1,
  },
  replyText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '11@ms',
    fontWeight: '500',
    color: '#333',
  },
  textContentContainer: {
    flexDirection: 'column',
    width: '100%',
    padding: '2@ms',
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'nowrap',
  },
  inlineTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: '4@ms',
    alignSelf: 'flex-end',
    flexShrink: 0,
  },
  inlineTime: {
    fontSize: '10@ms',
    fontFamily: 'Urbanist-Regular',
    marginRight: '2@ms',
    color: 'rgba(0,0,0,0.5)',
  },
  whatsappTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: '1@ms',
    paddingRight: '4@ms',
  },
  voiceRowContainer: {
    flexDirection: 'column',
    width: '100%',
    marginBottom: '4@ms',
  },
  modalCloseButton: {
    position: 'absolute',
    top: '40@ms',
    right: '20@ms',
    padding: '10@ms',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '20@ms',
  },
  fileInfo: {
    flex: 1,
    marginLeft: '8@ms',
  },
  ownMessageTime: {
    color: 'rgba(0,0,0,0.45)',
  },
  receivedMessageTime: {
    color: 'rgba(0,0,0,0.45)',
  },
  fileLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 