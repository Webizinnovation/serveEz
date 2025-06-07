import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Configure how notifications appear when in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// Note: For Android, Firebase is initialized through google-services.json and the expo-build-properties plugin
// If you see "Default FirebaseApp is not initialized" errors, ensure:
// 1. google-services.json is valid and in the project root
// 2. expo-build-properties plugin is configured in app.json with firebaseAndroidSdkVersion
// 3. You've rebuilt the app after making these changes

interface TokenRegistrationResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Schedules a local notification
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data to include with the notification
 * @returns Promise with notification ID
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<string> {
  try {
    // Check permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('No notification permission granted');
      return '';
    }

    // Schedule immediate notification
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Null trigger means show immediately
    });
    
    console.log('Local notification scheduled with ID:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling local notification:', error);
    return '';
  }
}

/**
 * Sends a login notification
 * @param username The username or email of the logged in user
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendLoginNotification(name: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Welcome back!',
      `You are now logged in as ${name}`,
      { type: 'login' }
    );
  } catch (error) {
    console.error('Error sending login notification:', error);
    return '';
  }
}

/**
 * Sends a booking success notification
 * @param service The service that was booked
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendBookingSuccessNotification(service: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Booking Successful!',
      `Your booking for ${service} has been submitted successfully`,
      { type: 'booking_success' }
    );
  } catch (error) {
    console.error('Error sending booking success notification:', error);
    return '';
  }
}

/**
 * Sends a notification when a provider accepts a booking
 * @param serviceName The service that was booked
 * @param providerName The name of the provider who accepted the booking
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendBookingAcceptedNotification(serviceName: string, providerName: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Booking Accepted!',
      `${providerName} has accepted your booking for ${serviceName}`,
      { type: 'booking_accepted' }
    );
  } catch (error) {
    console.error('Error sending booking accepted notification:', error);
    return '';
  }
}

/**
 * Enhanced function to send a booking status update notification that works both in foreground and background
 * @param status The new status of the booking ('accepted', 'cancelled', etc.)
 * @param serviceName The service that was booked
 * @param providerName The name of the provider
 * @param additionalInfo Any additional information to include
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendBookingStatusUpdatePushNotification(
  status: 'accepted' | 'cancelled' | 'in_progress' | 'completed',
  serviceName: string,
  providerName: string,
  additionalInfo?: string
): Promise<string> {
  try {
    // Check permissions first (this is critical)
    const { status: permissionStatus } = await Notifications.getPermissionsAsync();
    if (permissionStatus !== 'granted') {
      // If permissions not granted, try requesting them
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('Notification permissions not granted');
        return '';
      }
    }

    // Define title and message based on status
    let title = '';
    let body = '';
    
    switch (status) {
      case 'accepted':
        title = 'Booking Accepted! ✅';
        body = `${providerName} has accepted your booking for ${serviceName}`;
        if (additionalInfo) body += `. ${additionalInfo}`;
        break;
      case 'cancelled':
        title = 'Booking Cancelled';
        body = `Your booking for ${serviceName} has been cancelled`;
        if (additionalInfo) body += `. ${additionalInfo}`;
        break;
      case 'in_progress':
        title = 'Service Started';
        body = `Your service for ${serviceName} has started`;
        if (additionalInfo) body += `. ${additionalInfo}`;
        break;
      case 'completed':
        title = 'Service Completed';
        body = `Your service for ${serviceName} has been completed`;
        if (additionalInfo) body += `. ${additionalInfo}`;
        break;
    }

    // Schedule immediate notification with high priority and sound
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: `booking_${status}`,
          serviceName,
          providerName,
          additionalInfo
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // Make sure we have these for more visibility
        autoDismiss: false,
        sticky: true,
      },
      trigger: null, // Null trigger means show immediately
    });
    
    console.log(`Booking ${status} notification scheduled with ID:`, id);
    return id;
  } catch (error) {
    console.error(`Error sending booking ${status} notification:`, error);
    return '';
  }
}

/**
 * Sends a notification to a provider when they receive a new booking
 * @param serviceName The service that was booked
 * @param userName The name of the user who made the booking
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendNewBookingNotification(serviceName: string, userName: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'New Booking Request!',
      `${userName} has requested your services for ${serviceName}`,
      { type: 'new_booking' }
    );
  } catch (error) {
    console.error('Error sending new booking notification:', error);
    return '';
  }
}

/**
 * Sends a notification to a user when they make a payment
 * @param serviceName The service that was paid for
 * @param amount The payment amount
 * @param isFullPayment Whether this is a full payment or partial payment (for half payment plan)
 * @param isFinalPayment Whether this is the final payment (for half payment plan)
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendPaymentNotification(
  serviceName: string, 
  amount: number,
  isFullPayment: boolean,
  isFinalPayment: boolean = false
): Promise<string> {
  try {
    let title: string;
    let body: string;
    
    if (isFullPayment) {
      title = 'Payment Successful!';
      body = `Your payment of ₦${amount.toLocaleString()} for ${serviceName} has been completed successfully.`;
    } else if (isFinalPayment) {
      title = 'Final Payment Successful!';
      body = `Your final payment of ₦${amount.toLocaleString()} for ${serviceName} has been completed. Your service is now fully paid.`;
    } else {
      title = 'Initial Payment Successful!';
      body = `Your initial payment of ₦${amount.toLocaleString()} for ${serviceName} has been completed. Remember to make the final payment after service begins.`;
    }
    
    return await scheduleLocalNotification(
      title,
      body,
      { 
        type: isFinalPayment ? 'final_payment' : (isFullPayment ? 'full_payment' : 'initial_payment'),
        amount: amount,
        service: serviceName
      }
    );
  } catch (error) {
    console.error('Error sending payment notification:', error);
    return '';
  }
}

// Logout notification has been disabled as per requirement
// /**
//  * Sends a logout notification
//  * @returns Notification ID if successful, empty string if failed
//  */
// export async function sendLogoutNotification(): Promise<string> {
//   try {
//     return await scheduleLocalNotification(
//       'Logged out',
//       'You have been successfully logged out',
//       { type: 'logout' }
//     );
//   } catch (error) {
//     console.error('Error sending logout notification:', error);
//     return '';
//   }
// }

/**
 * Sends a notification when a deposit to wallet is successful
 * @param amount The amount deposited
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendDepositSuccessNotification(amount: number): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Deposit Successful!',
      `Your wallet has been credited with ₦${amount.toLocaleString()}`,
      { 
        type: 'deposit_success',
        amount
      }
    );
  } catch (error) {
    console.error('Error sending deposit success notification:', error);
    return '';
  }
}

/**
 * Sends a notification when a withdrawal from wallet is successful
 * @param amount The amount withdrawn
 * @param bankName The bank withdrawn to (optional)
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendWithdrawalSuccessNotification(amount: number, bankName?: string): Promise<string> {
  try {
    const message = bankName 
      ? `₦${amount.toLocaleString()} has been withdrawn to your ${bankName} account.`
      : `₦${amount.toLocaleString()} has been withdrawn from your wallet.`;
      
    return await scheduleLocalNotification(
      'Withdrawal Successful!',
      message,
      { 
        type: 'withdrawal_success',
        amount,
        bankName
      }
    );
  } catch (error) {
    console.error('Error sending withdrawal success notification:', error);
    return '';
  }
}

/**
 * Sends a notification when a transaction (deposit/withdrawal) fails
 * @param transactionType The type of transaction ('deposit' or 'withdrawal')
 * @param amount The amount involved
 * @param errorMessage Optional error message to include
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendTransactionFailedNotification(
  transactionType: 'deposit' | 'withdrawal',
  amount: number,
  errorMessage?: string
): Promise<string> {
  try {
    const title = `${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} Failed`;
    let message = `Your ${transactionType} of ₦${amount.toLocaleString()} could not be processed.`;
    
    if (errorMessage) {
      message += ` Reason: ${errorMessage}`;
    }
    
    return await scheduleLocalNotification(
      title,
      message,
      { 
        type: `${transactionType}_failed`,
        amount,
        errorMessage
      }
    );
  } catch (error) {
    console.error(`Error sending ${transactionType} failed notification:`, error);
    return '';
  }
}

/**
 * Sends a notification when a transaction (deposit/withdrawal) is pending
 * @param transactionType The type of transaction ('deposit' or 'withdrawal')
 * @param amount The amount involved
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendTransactionPendingNotification(
  transactionType: 'deposit' | 'withdrawal',
  amount: number
): Promise<string> {
  try {
    const title = `${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} Processing`;
    const message = `Your ${transactionType} of ₦${amount.toLocaleString()} is being processed. We'll notify you when it's complete.`;
    
    return await scheduleLocalNotification(
      title,
      message,
      { 
        type: `${transactionType}_pending`,
        amount
      }
    );
  } catch (error) {
    console.error(`Error sending ${transactionType} pending notification:`, error);
    return '';
  }
}

/**
 * Registers the device for push notifications and saves the token to the database
 * @param userId The user ID to associate with the push token
 * @returns Object containing success status and token or error
 */
export async function registerForPushNotifications(userId: string): Promise<TokenRegistrationResult> {
  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    // Check if device is physical (simulators/emulators don't support push)
    if (!Device.isDevice) {
      return { 
        success: false, 
        error: 'Push notifications are not supported in simulators/emulators' 
      };
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If permissions not granted yet, request them
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permissions denied, return with error
    if (finalStatus !== 'granted') {
      return {
        success: false,
        error: 'Permission to receive push notifications denied'
      };
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    
    const token = tokenData.data;
    
    console.log('Push token obtained:', token);

    // Determine device type
    const deviceType = Platform.OS;

    // Save token to database
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: token,
          device_type: deviceType,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id, token',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('Error saving push token:', error);
      return { success: false, error: error.message };
    }

    return { success: true, token };
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Removes the push token for the logged out user
 * @param userId The user ID associated with the token to remove
 * @returns Object containing success status and error if applicable
 */
export async function unregisterPushNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    // Get current push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    
    const token = tokenData.data;

    // Remove token from database
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .match({ user_id: userId, token: token });

    if (error) {
      console.error('Error removing push token:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Configures notification settings based on device platform
 * Must be called at the app level (App.tsx or similar)
 */
export function configurePushNotifications(): void {
  // For Android, set notification channel
  if (Platform.OS === 'android') {
    try {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log('Android notification channel configured successfully');
    } catch (error) {
      console.error('Failed to configure Android notification channel:', error);
    }
  }
}

/**
 * Sends a notification when a new chat message is received
 * @param senderName The name of the message sender
 * @param messageContent A preview of the message content
 * @param chatId The ID of the chat room
 * @param isProvider Whether the recipient is a provider (affects notification wording)
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendChatMessageNotification(
  senderName: string,
  messageContent: string,
  chatId: string,
  isProvider: boolean = false
): Promise<string> {
  try {
    // Truncate message content if too long
    const contentPreview = messageContent.length > 50 
      ? `${messageContent.substring(0, 50)}...` 
      : messageContent;
    
    // Determine title based on recipient type
    const title = isProvider 
      ? `New message from ${senderName}` 
      : `${senderName} sent you a message`;
    
    return await scheduleLocalNotification(
      title,
      contentPreview,
      { 
        type: 'chat_message',
        chatId,
        senderName,
        isProvider
      }
    );
  } catch (error) {
    console.error('Error sending chat message notification:', error);
    return '';
  }
}

/**
 * Sends a notification when a user successfully signs up
 * @param username The username or name of the user who signed up
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendSignupSuccessNotification(name: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Welcome to Servez!',
      `Hi ${name}, your account has been created successfully. Welcome to the Servez community!`,
      { type: 'signup_success' }
    );
  } catch (error) {
    console.error('Error sending signup success notification:', error);
    return '';
  }
}

/**
 * Sends a notification when a user logs in for the first time
 * @param username The username or name of the user logging in
 * @returns Notification ID if successful, empty string if failed
 */
export async function sendFirstLoginNotification(name: string): Promise<string> {
  try {
    return await scheduleLocalNotification(
      'Welcome to Servez!',
      `Hi ${name}, welcome to Servez! We're excited to have you join us. Explore our services and find what you need.`,
      { type: 'first_login' }
    );
  } catch (error) {
    console.error('Error sending first login notification:', error);
    return '';
  }
} 