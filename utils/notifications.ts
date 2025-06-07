import { supabase } from '../services/supabase';

/**
 * Gets the correct user ID for notifications
 * This function checks if the ID is a provider ID and returns the associated user ID if it is
 * @param id The ID to check (could be user ID or provider ID)
 * @returns The correct user ID for notifications, or null if not found
 */
export const getNotificationUserId = async (id: string): Promise<string | null> => {
  try {
    // First check if this is a user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!userError && user) {
      return user.id;
    }
    
    // If not a user ID, check if it's a provider ID
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('users!inner(id)')
      .eq('id', id)
      .single();
    
    if (!providerError && provider) {
      return (provider.users as any).id;
    }
    
    // Also check if this is a user ID in the providers table
    const { data: providerByUser, error: providerByUserError } = await supabase
      .from('providers')
      .select('users!inner(id)')
      .eq('users.id', id)
      .single();
    
    if (!providerByUserError && providerByUser) {
      return (providerByUser.users as any).id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting notification user ID:', error);
    return null;
  }
};

/**
 * Creates a notification for a user
 * @param userId User ID to send notification to
 * @param title Notification title
 * @param message Notification message
 * @param type Notification type: 'order', 'chat', 'payment', or 'system'
 * @param referenceId Optional reference ID for the notification
 */
export const createUserNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: 'order' | 'chat' | 'payment' | 'system',
  referenceId?: string
): Promise<boolean> => {
  try {
    // Get the correct user ID for notifications
    const notificationUserId = await getNotificationUserId(userId);
    
    if (!notificationUserId) {
      console.error('Cannot create notification: User/Provider does not exist:', userId);
      return false;
    }
    
    
    const { error } = await supabase.rpc('create_user_notification', {
      p_user_id: notificationUserId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_reference_id: referenceId
    });
    
    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

/**
 * Sends a notification to a user when their booking status changes
 * @param userId User ID or Provider ID to notify
 * @param bookingId ID of the booking
 * @param newStatus New status of the booking
 * @param serviceName Name of the service (optional)
 */
export const sendBookingStatusNotification = async (
  userId: string,
  bookingId: string,
  newStatus: 'accepted' | 'in_progress' | 'completed' | 'cancelled',
  serviceName?: string
): Promise<boolean> => {
  try {
    // Skip if userId is not provided
    if (!userId) {
      console.warn('Cannot send notification: No user ID provided');
      return false;
    }
    
    let title = '';
    let message = '';
    
    switch (newStatus) {
      case 'accepted':
        title = 'Booking Accepted';
        message = serviceName 
          ? `Your booking for ${serviceName} has been accepted.` 
          : 'Your service booking has been accepted.';
        break;
      case 'in_progress':
        title = 'Service In Progress';
        message = serviceName 
          ? `Your ${serviceName} service is now in progress.` 
          : 'Your service is now in progress.';
        break;
      case 'completed':
        title = 'Service Completed';
        message = serviceName 
          ? `Your ${serviceName} service has been completed.` 
          : 'Your service has been completed.';
        break;
      case 'cancelled':
        title = 'Booking Cancelled';
        message = serviceName 
          ? `Your booking for ${serviceName} has been cancelled.` 
          : 'Your service booking has been cancelled.';
        break;
    }
    
    return await createUserNotification(userId, title, message, 'order', bookingId);
  } catch (error) {
    console.error('Error sending booking status notification:', error);
    return false;
  }
};

/**
 * Updates a booking status and resets the is_viewed flag
 * @param bookingId Booking ID to update
 * @param status New status
 * @param updatedBy ID of the user who updated the booking
 * @returns Success status
 */
export const updateBookingStatus = async (
  bookingId: string, 
  status: string,
  updatedBy: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status, 
        updated_at: new Date().toISOString(),
        is_viewed: false // Reset viewed status when status changes
      })
      .eq('id', bookingId);
      
    if (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating booking status:', error);
    return false;
  }
}; 