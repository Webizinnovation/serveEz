import { supabase } from './supabase';


export interface SupportTicket {
  id: string;
  user_id: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  issue_type: string;
  created_at: string;
  last_message_at: string;
  title: string;
  user_role: 'user' | 'provider' | 'admin';
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: 'user' | 'agent' | 'admin' | 'system';
  message: string;
  created_at: string;
  attachments?: string[] | null;
  is_read: boolean;
}


export const createSupportTicket = async (
  userId: string,
  userRole: 'user' | 'provider',
  issueType: string,
  title: string
): Promise<SupportTicket | null> => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([
        {
          user_id: userId,
          status: 'open',
          issue_type: issueType,
          title: title,
          user_role: userRole,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating support ticket:', error);
      return null;
    }

    return data as SupportTicket;
  } catch (error) {
    console.error('Failed to create support ticket:', error);
    return null;
  }
};


export const getUserSupportTickets = async (userId: string): Promise<SupportTicket[]> => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching support tickets:', error);
      return [];
    }

    return data as SupportTicket[];
  } catch (error) {
    console.error('Failed to fetch support tickets:', error);
    return [];
  }
};


export const getSupportTicket = async (ticketId: string): Promise<SupportTicket | null> => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) {
      console.error('Error fetching support ticket:', error);
      return null;
    }

    return data as SupportTicket;
  } catch (error) {
    console.error('Failed to fetch support ticket:', error);
    return null;
  }
};

/**
 * Sends a message in a support ticket
 */
export const sendSupportMessage = async (
  ticketId: string,
  senderId: string | null,
  senderType: 'user' | 'provider' | 'agent' | 'admin' | 'system' | 'bot',
  message: string,
  attachments?: string[]
): Promise<SupportMessage | null> => {
  try {
    let data;
    let error;

    // Different handling depending on if the sender is a user or the system
    if (senderType === 'user' || senderType === 'provider') {
      // For user messages, use normal insert
      const result = await supabase
        .from('support_messages')
        .insert([
          {
            ticket_id: ticketId,
            sender_id: senderId,
            sender_type: senderType,
            message: message,
            attachments: attachments,
            is_read: false,
          },
        ])
        .select('*')
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('support_messages')
        .insert([
          {
            ticket_id: ticketId,
            sender_id: null,
            sender_type: senderType,
            message: message,
            attachments: attachments,
            is_read: true,
          },
        ])
        .select('*')
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error sending support message:', error);
      return null;
    }


    await supabase
      .from('support_tickets')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', ticketId);


    if (senderType !== 'user' && senderType !== 'provider') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)
        .eq('status', 'open');
    }

    return data as SupportMessage;
  } catch (error) {
    console.error('Failed to send support message:', error);
    return null;
  }
};


export const getSupportMessages = async (ticketId: string): Promise<SupportMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching support messages:', error);
      return [];
    }

    return data as SupportMessage[];
  } catch (error) {
    console.error('Failed to fetch support messages:', error);
    return [];
  }
};


export const markMessagesAsRead = async (ticketId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('support_messages')
      .update({ is_read: true })
      .eq('ticket_id', ticketId)
      .neq('sender_id', userId);

    if (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to mark messages as read:', error);
    return false;
  }
};


export const closeSupportTicket = async (ticketId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId);

    if (error) {
      console.error('Error closing support ticket:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to close support ticket:', error);
    return false;
  }
};


export const getAutomatedResponse = (message: string, userRole: 'user' | 'provider'): string | null => {
  const lowerMessage = message.toLowerCase();
  

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return 'Hello! How can I help you today?';
  }
  
  if (lowerMessage.includes('thank you') || lowerMessage.includes('thanks')) {
    return "You're welcome! Is there anything else I can help you with?";
  }
  
  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return 'Thank you for contacting our support team. Have a great day!';
  }
  

  if (lowerMessage.includes('payment') || lowerMessage.includes('transaction') || lowerMessage.includes('wallet')) {
    return 'I understand you have a question about payments. Could you provide more details about the specific issue you\'re experiencing?';
  }
  
  // Check for account-related keywords
  if (lowerMessage.includes('account') || lowerMessage.includes('login') || lowerMessage.includes('password')) {
    return 'For account-related issues, could you let me know what specific problem you\'re having? Our support team will help you resolve it.';
  }
  
  // User-specific responses
  if (userRole === 'user') {
    if (lowerMessage.includes('book') || lowerMessage.includes('service') || lowerMessage.includes('appointment')) {
      return 'To book a service, you can browse available providers in the Services tab, select a provider, and follow the booking process. Is there a specific service you\'re looking for?';
    }
    
    if (lowerMessage.includes('provider') || lowerMessage.includes('professional')) {
      return 'You can find qualified providers by browsing the Services tab. You can filter by service type, location, and ratings. Would you like assistance with finding a specific type of provider?';
    }

    if (lowerMessage.includes('cancel') && (lowerMessage.includes('book') || lowerMessage.includes('appointment'))) {
      return 'To cancel a booking, go to your Orders section, find the booking you want to cancel, and tap on the Cancel button. Note that cancellation policies may apply depending on how close the cancellation is to the scheduled time.';
    }

    if (lowerMessage.includes('rating') || lowerMessage.includes('review')) {
      return 'You can rate and review a provider after your service is completed. Go to your Order History, find the completed service, and select "Leave a Review". Your feedback helps other users make informed decisions.';
    }
  }
  
  // Provider-specific responses
  if (userRole === 'provider') {
    if (lowerMessage.includes('customer') || lowerMessage.includes('client') || lowerMessage.includes('booking')) {
      return 'You can manage your bookings and client interactions from your Provider Dashboard. Is there a specific booking or client issue you need help with?';
    }
    
    if (lowerMessage.includes('service') || lowerMessage.includes('offering') || lowerMessage.includes('listing')) {
      return 'To update your service listings, go to the Services section in your Provider Dashboard. You can add, edit, or remove services there. Would you like specific guidance on updating your services?';
    }

    if (lowerMessage.includes('payment') && lowerMessage.includes('receive')) {
      return 'Payments are processed within 24-48 hours after a service is completed and the client confirms completion. You can view your payment history and pending payments in the Earnings section of your Provider Dashboard.';
    }

    if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
      return 'To cancel or reschedule a booking, go to your Upcoming Services, select the booking, and tap on "Cancel" or "Reschedule". Please note that frequent cancellations may affect your provider rating.';
    }
  }

  // Complex issue detection
  if ((lowerMessage.includes('cannot') || lowerMessage.includes('can\'t') || lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('error')) && 
      (lowerMessage.includes('app') || lowerMessage.includes('loading') || lowerMessage.includes('crash'))) {
    return 'It sounds like you\'re experiencing a technical issue with the app. Could you try these troubleshooting steps?\n\n1. Restart the app\n2. Check for app updates\n3. Ensure you have a stable internet connection\n4. Restart your device\n\nIf the problem persists, please provide more details about when the issue occurs.';
  }
  
  // Default response if no keywords match
  return null;
};

/**
 * More advanced chatbot response system with context awareness
 * @param message Current message
 * @param previousMessages Previous messages in the conversation for context
 * @param userRole User role
 * @returns Appropriate response based on context and message
 */
export const getChatbotResponse = async (
  message: string, 
  previousMessages: SupportMessage[], 
  userRole: 'user' | 'provider'
): Promise<string> => {
  const lowerMessage = message.toLowerCase();

  // First, try to get a response from the simple keyword system
  const keywordResponse = getAutomatedResponse(message, userRole);
  if (keywordResponse) return keywordResponse;

  // Check for conversation context if we have previous messages
  if (previousMessages.length > 0) {
    const conversationContext = getConversationContext(previousMessages);
    
    // If we're in a troubleshooting context
    if (conversationContext === 'troubleshooting') {
      if (lowerMessage.includes('yes') || lowerMessage.includes('tried') || lowerMessage.includes('done')) {
        return "Thanks for trying those steps. Let me escalate this to our technical team. They'll analyze the issue and get back to you within 24 hours. In the meantime, is there anything else you need help with?";
      } else if (lowerMessage.includes('no') || lowerMessage.includes('haven\'t')) {
        return "Please try the troubleshooting steps I suggested and let me know if they help resolve the issue.";
      }
    }

    // If we're in a booking context
    if (conversationContext === 'booking') {
      if (lowerMessage.includes('time') || lowerMessage.includes('when')) {
        return "You can select your preferred date and time during the booking process. Providers set their availability, so you'll see open time slots for your chosen provider.";
      } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('fee')) {
        return "Each provider sets their own rates which are displayed on their profile and during the booking process. You can see the total cost before confirming your booking.";
      }
    }

    // Payment-related follow-ups
    if (conversationContext === 'payment') {
      if (lowerMessage.includes('refund')) {
        return "Refund policies depend on when the cancellation is made. Generally, cancellations made 24 hours or more before the scheduled service are eligible for a full refund. For more details, please check our Refund Policy in the app settings.";
      } else if (lowerMessage.includes('method') || lowerMessage.includes('card') || lowerMessage.includes('wallet')) {
        return "We accept major credit/debit cards and in-app wallet payments. You can manage your payment methods in the Account Settings section.";
      }
    }
  }

  // Detect user is asking "how to" questions
  if (lowerMessage.includes('how to') || lowerMessage.includes('how do i')) {
    if (lowerMessage.includes('register') || lowerMessage.includes('sign up')) {
      return "To register, open the app and tap 'Sign Up' on the welcome screen. You can create an account using your email, phone number, or by connecting a social media account.";
    } else if (lowerMessage.includes('reset') || lowerMessage.includes('change password')) {
      return "To reset your password, go to the login screen and tap 'Forgot Password'. Enter your registered email, and we'll send you instructions to reset your password.";
    } else if (lowerMessage.includes('contact') || lowerMessage.includes('support')) {
      return "You're already contacting support through this ticket system! You can also reach us by email at support@servez.com or by phone at +1234567890 during business hours.";
    } else {
      return "I'm not sure how to help with that specific question. Could you provide more details so I can assist you better?";
    }
  }

  // Detect if user is asking about status of their issue
  if (lowerMessage.includes('status') || (lowerMessage.includes('what') && lowerMessage.includes('happen')) || 
      lowerMessage.includes('update') || lowerMessage.includes('progress')) {
    return "Your support ticket is currently being reviewed by our team. We typically respond to all inquiries within 24 hours during business days. Thanks for your patience!";
  }

  // Default response for messages we can't categorize
  return "Thank you for your message. I'm not sure I fully understand your request. Could you provide more details, or would you like to speak with a human support agent? A support team member will review this conversation soon.";
};

/**
 * Helper function to determine the context of a conversation based on previous messages
 */
const getConversationContext = (messages: SupportMessage[]): string | null => {
  // Look at the last 5 messages (or fewer if there aren't that many)
  const recentMessages = messages.slice(-5);
  
  // Count keywords to determine context
  let troubleshootingCount = 0;
  let bookingCount = 0;
  let paymentCount = 0;
  
  for (const msg of recentMessages) {
    const text = msg.message.toLowerCase();
    
    // Check for troubleshooting context
    if (text.includes('problem') || text.includes('issue') || text.includes('error') || 
        text.includes('not working') || text.includes('bug') || text.includes('crash')) {
      troubleshootingCount++;
    }
    
    // Check for booking context
    if (text.includes('book') || text.includes('appointment') || text.includes('schedule') || 
        text.includes('service') || text.includes('provider')) {
      bookingCount++;
    }
    
    // Check for payment context
    if (text.includes('payment') || text.includes('refund') || text.includes('charge') || 
        text.includes('card') || text.includes('transaction') || text.includes('wallet')) {
      paymentCount++;
    }
  }
  
  // Determine the dominant context
  if (troubleshootingCount > bookingCount && troubleshootingCount > paymentCount) {
    return 'troubleshooting';
  } else if (bookingCount > troubleshootingCount && bookingCount > paymentCount) {
    return 'booking';
  } else if (paymentCount > troubleshootingCount && paymentCount > bookingCount) {
    return 'payment';
  }
  
  // If no clear context, return null
  return null;
}; 