import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface NotificationState {
  // For providers: new booking requests
  hasNewRequests: boolean;
  // For users: bookings that have been accepted but not viewed
  hasAcceptedBookings: boolean;
  
  // Functions to check and update notification states
  checkNewRequests: (providerId: string) => Promise<void>;
  checkAcceptedBookings: (userId: string) => Promise<void>;
  
  // Functions to clear notifications once viewed
  clearNewRequestsNotification: () => void;
  clearAcceptedBookingsNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  hasNewRequests: false,
  hasAcceptedBookings: false,
  
  checkNewRequests: async (providerId: string) => {
    try {
      // Get count of new pending requests
      const { data, error, count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact' })
        .eq('provider_id', providerId)
        .eq('status', 'pending')
        .eq('is_viewed', false);
        
      if (error) throw error;
      
      set({ hasNewRequests: (count !== null && count > 0) });
    } catch (error) {
      console.error('Error checking for new requests:', error);
    }
  },
  
  checkAcceptedBookings: async (userId: string) => {
    try {
      // Get count of newly accepted bookings
      const { data, error, count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .eq('is_viewed', false);
        
      if (error) throw error;
      
      set({ hasAcceptedBookings: (count !== null && count > 0) });
    } catch (error) {
      console.error('Error checking for accepted bookings:', error);
    }
  },
  
  clearNewRequestsNotification: () => {
    set({ hasNewRequests: false });
  },
  
  clearAcceptedBookingsNotification: () => {
    set({ hasAcceptedBookings: false });
  }
})); 