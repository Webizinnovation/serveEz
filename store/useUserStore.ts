import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

interface UserState {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  selectedOrderTab: 'ALL' | 'YOUR BOOKINGS' | 'FAVORITES';
  isLoading: boolean;
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
  fetchProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  clearProfile: () => void;
  refreshOnlineStatus: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isAuthenticated: false,
  selectedOrderTab: 'YOUR BOOKINGS',
  isLoading: false,
  isOnline: false,
  setIsOnline: (status) => set({ isOnline: status }),
  
  fetchProfile: async () => {
    try {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No authenticated user found');
        set({ 
          profile: null,
          isAuthenticated: false
        });
        return;
      }
      
      console.log('Fetching profile for user ID:', user.id);
      
      // Fetch with full table join for complete profile data
      const { data: profile, error } = await supabase
        .from('users')
        .select(`
          *,
          wallets (
            balance
          )
        `)
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }
      
      if (!profile) {
        console.error('No profile found for user ID:', user.id);
        return;
      }
      
      console.log('Profile loaded successfully. Phone verified:', profile.phone_verified);
      
      set({ 
        profile: {
          ...profile,
          wallet_balance: profile.wallets?.balance || 0,
          phone_verified: profile.phone_verified || false,
        },
        isAuthenticated: true 
      });
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  refreshProfile: async () => {
    try {
      const { profile } = get();
      
      if (!profile?.id) {
        console.log('No profile to refresh');
        return;
      }
      
      console.log('Refreshing profile for user ID:', profile.id);
      
      const { data: updatedProfile, error } = await supabase
        .from('users')
        .select(`
          *,
          wallets (
            balance
          )
        `)
        .eq('id', profile.id)
        .single();
        
      if (error) {
        console.error('Error refreshing user profile:', error);
        throw error;
      }
      
      if (!updatedProfile) {
        console.error('No profile found during refresh for user ID:', profile.id);
        return;
      }
      
      console.log('Profile refreshed successfully. Phone verified:', updatedProfile.phone_verified);
      
      set({ 
        profile: {
          ...updatedProfile,
          wallet_balance: updatedProfile.wallets?.balance || 0,
          phone_verified: updatedProfile.phone_verified
        }
      });
    } catch (error) {
      console.error('Error in refreshProfile:', error);
    }
  },
  
  updateProfile: async (updates) => {
    try {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found during profile update');
        return;
      }
      
      console.log('Updating profile for user ID:', user.id, 'with data:', updates);
      
      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
          
      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
      
      // Update local state with the changes
      set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
      }));
      
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error in updateProfile:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setProfile: (profile) => {
    console.log('Manually setting profile:', profile?.id);
    set({ profile });
  },

  clearProfile: () => {
    console.log('Clearing user profile and state');
    set({
      profile: null,
      isAuthenticated: false,
      selectedOrderTab: 'YOUR BOOKINGS',
      isLoading: false,
      isOnline: false
    });
  },

  refreshOnlineStatus: async () => {
    try {
      const { profile } = get();
      if (!profile || profile.role !== 'provider') return;
      
      const { data, error } = await supabase
        .from('providers')
        .select('availability')
        .eq('user_id', profile.id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        set({ isOnline: data.availability });
      }
    } catch (error) {
      console.error('Error refreshing online status:', error);
    }
  },
})); 