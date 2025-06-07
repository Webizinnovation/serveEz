import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Modal, StatusBar, Dimensions } from 'react-native';
import { Text, Button, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { useUserStore } from '../../../store/useUserStore';
import { Ionicons, AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';
import { Provider } from '../../../types';
import { useTheme } from '../../../components/ThemeProvider';

const { width } = Dimensions.get('window');

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingTop: '16@s',
  },
  sectionContainer: {
    marginBottom: '16@s',
    backgroundColor: '#fff',
    borderRadius: '12@s',
    padding: '16@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  input: {
    marginBottom: '12@s',
    backgroundColor: 'transparent',
  },
  actionButton: {
    marginRight: '8@s',
    borderRadius: '8@s',
  },
  saveButtonContainer: {
    padding: '16@s',
    marginBottom: '24@s',
    width: '100%',
  },
  saveButton: {
    borderRadius: '8@s',
    height: '50@s',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  pageTitle: {
    fontSize: '22@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@s',
    textAlign: 'center',
    color: '#333',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@s',
  },
  sectionTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginLeft: '8@s',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    marginBottom: '8@s',
    borderWidth: 1,
    borderColor: '#eee',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: '4@s',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCurrency: {
    fontSize: '14@s',
    color: '#666',
    marginRight: '2@s',
  },
  servicePrice: {
    fontSize: '14@s',
    color: '#666',
  },
  serviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addServiceForm: {
    padding: '16@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '12@s',
    marginBottom: '16@s',
    borderWidth: 1,
    borderColor: '#eee',
  },
  serviceInput: {
    marginBottom: '12@s',
    backgroundColor: 'transparent',
  },
  serviceButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: '8@s',
  },
  serviceButton: {
    flex: 1,
    marginHorizontal: '4@s',
  },
  cancelButton: {
    borderColor: '#ddd',
  },
  addButton: {
    marginTop: '8@s',
    borderRadius: '8@s',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: '16@s',
  },
  modalView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16@s',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
  },
  closeModalButton: {
    padding: '8@s',
  },
  modalScrollView: {
    padding: '16@s',
  },
  searchContainer: {
    padding: '12@s',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: '8@s',
    padding: '8@s',
  },
  searchInput: {
    flex: 1,
    fontSize: '16@s',
    color: '#000',
  },
  emptyServices: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: '16@s',
  },
  emptyServicesText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#999',
  },
  emptyServicesSubtext: {
    color: '#999',
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
    textAlign: 'center',
    marginTop: '4@s',
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    marginLeft: '8@s',
    fontFamily: 'Urbanist-Medium',
    fontSize: '16@s',
    color: Colors.primary,
  },
  passwordButton: {
    marginTop: '12@s',
    borderRadius: '8@s',
  },
  passwordInput: {
    marginBottom: '12@s',
    backgroundColor: 'transparent',
  },
  passwordSwitcher: {
    margin: 0,
    padding: 0,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: '12@s',
  },
  servicesContainer: {
    padding: '16@s',
    borderRadius: '16@s',
    borderWidth: 1,
    borderColor: '#ddd',
  },
});

// Define a type for service categories
type ServiceCategory = {
  name: string;
  subcategories?: string[]; // Optional subcategories
};

const services: ServiceCategory[] = [
  {
    name: "Appliances",
    subcategories: ["Air Conditioners", "Washing Machines", "Home Theaters", "Kitchen Appliances"]
  },
  { name: "Refrigerator Services" },
  {
    name: "Mechanics",
    subcategories: ["Benz Specialists", "Toyota Specialists", "BMW Specialists", "Honda Specialists", "General Mechanics", "Heavy-Duty Mechanics"]
  },
  { name: "Barbers" },
  { name: "Brick Layers" },
  { name: "Carpentry Services" },
  { name: "Laundry" },
  { name: "Car Washers" },
  { name: "Catering" },
  { name: "Shipping Services" },
  { name: "Electrician" },
  { name: "Fumigation Services" },
  {
    name: "Generator Services",
    subcategories: ["Installation", "Maintenance", "Repair", "Troubleshooting", "Parts Replacement", "Fuel Delivery"]
  },
  {
    name: "Hairstylist",
    subcategories: ["Braiding", "Natural Hair", "Locks/Dreadlocks", "Weave/Extensions", "Hair Coloring", "Wedding Styles", "Men's Hair"]
  },
  { name: "Movers" },
  { name: "Home Interior Designers" },
  { name: "Make-Up Artist" },
  { name: "Nail Technician" },
  { name: "Painter" },
  {
    name: "Phone Repairers",
    subcategories: ["iPhone Specialists", "Samsung Specialists", "General Phone Repair", "Tablet Repair"]
  },
  { 
    name: "Photographer",
    subcategories: ["Wedding Photography", "Portrait Photography", "Commercial Photography", "Event Photography"]
  },
  { name: "Plumber" },
  { name: "POP" },
  { name: "Tiller" },
  { 
    name: "Video Editor",
    subcategories: ["Commercial Video Editing", "Wedding Video Editing", "Social Media Content"]
  },
  { name: "Welder" },
  { name: "Legal service (Lawyer)" },
  {
    name: "Borehole service",
    subcategories: ["Drilling", "Maintenance", "Pump Installation"]
  },
  { name: "Water treatment services" },
  { name: "Geophysical survey" },
  { 
    name: "Fashion designer",
    subcategories: ["Traditional Wear", "Wedding Outfits", "Casual Wear", "Corporate Outfits"]
  },
  { 
    name: "Event Planner",
    subcategories: ["Wedding Planning", "Corporate Events", "Birthday Parties"]
  },
  { name: "Event Decorator" },
  { name: "Event Photographer" },
  { name: "Event Videographer" },
  { name: "Event Caterer" },
].sort((a, b) => a.name.localeCompare(b.name));

export default function EditProfileScreen() {
  const { profile } = useUserStore();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [newService, setNewService] = useState({ name: '', price: '' });
  const { isDark, colors } = useTheme();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    bio: '',
    experience: '',
    services: [] as string[],
    pricing: {} as Record<string, number>,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Profile',
      headerStyle: {
        backgroundColor: isDark ? colors.cardBackground : '#fff',
      },
      headerTintColor: isDark ? colors.text : '#000',
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{ marginLeft: 16, padding: 8 }}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isDark ? colors.text : '#000'} 
          />
        </TouchableOpacity>
      ),
      headerShadowVisible: false,
    });
  }, [isDark]);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      if (!profile?.id) {
        throw new Error("User profile ID is missing");
      }
      
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setProviderData(data);
      
      setFormData(prev => ({
        ...prev,
        bio: data.bio || '',
        experience: data.experience?.toString() || '',
        services: data.services || [],
        pricing: data.pricing || {},
      }));
    } catch (error) {
      console.error('Error fetching provider data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, [profile?.id]);

  /**
   * Adds a new service to the provider's service list with validation
   * Validates input, formats price correctly, and updates the state
   */
  const handleAddService = useCallback(() => {
    // Input validation
    if (!newService.name.trim()) {
      Alert.alert('Missing Information', 'Please select a service name');
      return;
    }
    
    if (!newService.price.trim()) {
      Alert.alert('Missing Information', 'Please enter a price for this service');
      return;
    }
    
    // Price validation
    const priceValue = parseFloat(newService.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than zero');
      return;
    }
    
    if (priceValue > 1000000) {
      Alert.alert('Price Limit Exceeded', 'The maximum price allowed is 1,000,000');
      return;
    }
    
    // Check if service already exists
    if (formData.services.includes(newService.name)) {
      // Update existing service price
      setFormData(prev => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          [newService.name]: priceValue
        }
      }));
      
      Alert.alert('Service Updated', `Price for ${newService.name} has been updated`);
    } else {
      // Add new service
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, newService.name],
        pricing: {
          ...prev.pricing,
          [newService.name]: priceValue
        }
      }));
    }

    // Reset form and close add service section
    setNewService({ name: '', price: '' });
    setShowAddService(false);
  }, [newService, formData.services]);

  /**
   * Removes a service from the provider's service list
   * Confirms with user before removing and handles state updates efficiently
   */
  const handleRemoveService = useCallback((service: string, index: number) => {
    // Ask for confirmation before removing
    Alert.alert(
      'Remove Service',
      `Are you sure you want to remove "${service}" from your services?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Create a new services array without the removed service
            const newServices = formData.services.filter((_, i) => i !== index);
            
            // Create a new pricing object without the removed service
            const newPricing = { ...formData.pricing };
            delete newPricing[service]; // More explicit than destructuring
            
            // Update state in a single operation to avoid multiple re-renders
            setFormData(prev => ({
              ...prev,
              services: newServices,
              pricing: newPricing
            }));
          }
        }
      ]
    );
  }, [formData]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone,
        })
        .eq('id', profile?.id);

      if (userError) throw userError;

      const { error: providerError } = await supabase
        .from('providers')
        .update({
          bio: formData.bio,
          experience: parseInt(formData.experience) || 0,
          services: formData.services,
          pricing: formData.pricing,
        })
        .eq('user_id', profile?.id);

      if (providerError) throw providerError;

      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert('Success', 'Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategoryExpansion = useCallback((categoryName: string, event: any) => {
    // Prevent the parent touchable from being triggered
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    
    setExpandedCategories(prev => {
      if (prev.includes(categoryName)) {
        return prev.filter(cat => cat !== categoryName);
      } else {
        return [...prev, categoryName];
      }
    });
  }, []);

  if (loading && !providerData) {
    return (
      <View style={[styles.loadingContainer, isDark && { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDark && { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {/* Page Title */}
            <Text style={[styles.pageTitle, isDark && { color: colors.text }]}>
              Edit Your Profile
            </Text>

            {/* Personal Information Section */}
            <View style={[styles.sectionContainer, isDark && { backgroundColor: colors.cardBackground, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={styles.sectionTitleContainer}>
                <MaterialCommunityIcons 
                  name="account-details" 
                  size={22} 
                  color={isDark ? colors.tint : Colors.primary} 
                />
                <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Personal Information</Text>
              </View>
              
              <TextInput
                label="Full Name"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                mode="outlined"
                style={styles.input}
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="Email Address"
                value={formData.email}
                mode="outlined"
                style={styles.input}
                disabled
                outlineColor={isDark ? '#444' : "#ddd"}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? 'rgba(0,0,0,0.2)' : '#f5f5f5',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="Bio"
                value={formData.bio}
                onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
                mode="outlined"
                multiline
                numberOfLines={4}
                style={styles.input}
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="Years of Experience"
                value={formData.experience}
                onChangeText={(text) => setFormData(prev => ({ ...prev, experience: text }))}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
            </View>

            {/* Services & Pricing Section */}
            <View style={[styles.sectionContainer, isDark && { backgroundColor: colors.cardBackground, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={styles.sectionTitleContainer}>
                <MaterialCommunityIcons 
                  name="store-outline" 
                  size={22} 
                  color={isDark ? colors.tint : Colors.primary} 
                />
                <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Services & Pricing</Text>
              </View>
              
              <View style={[styles.servicesContainer, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]}>
                {formData.services.length === 0 && (
                  <View style={[styles.emptyServices, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <MaterialCommunityIcons 
                      name="cart-outline" 
                      size={32} 
                      color={isDark ? '#555' : '#ccc'} 
                      style={{ marginBottom: 10 }}
                    />
                    <Text style={[styles.emptyServicesText, isDark && { color: colors.subtext }]}>
                      No services added yet
                    </Text>
                    <Text style={[styles.emptyServicesSubtext, isDark && { color: 'rgba(255,255,255,0.5)' }]}>
                      Add services you offer and set your prices
                    </Text>
                  </View>
                )}

                {formData.services.map((service, index) => (
                  <View key={index} style={[
                    styles.serviceCard, 
                    isDark && { 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.1)'
                    }
                  ]}>
                    <View style={styles.serviceInfo}>
                      <Text style={[
                        styles.serviceName, 
                        isDark && { color: colors.text }
                      ]}>
                        {service}
                      </Text>
                      <View style={styles.priceContainer}>
                        <Text style={[
                          styles.priceCurrency, 
                          isDark && { color: colors.subtext }
                        ]}>₦</Text>
                        <Text style={[
                          styles.servicePrice, 
                          isDark && { color: colors.subtext }
                        ]}>
                          {formData.pricing[service]?.toLocaleString() || '0'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.serviceActions}>
                      <IconButton
                        icon="pencil"
                        size={20}
                        iconColor={isDark ? colors.tint : Colors.primary}
                        onPress={() => {
                          setNewService({ 
                            name: service, 
                            price: formData.pricing[service]?.toString() || ''
                          });
                          setShowAddService(true);
                        }}
                        style={[
                          styles.actionButton, 
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(52, 152, 219, 0.1)' }
                        ]}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        iconColor="#e74c3c"
                        onPress={() => handleRemoveService(service, index)}
                        style={[
                          styles.actionButton, 
                          { backgroundColor: isDark ? 'rgba(231, 76, 60, 0.1)' : 'rgba(231, 76, 60, 0.1)' }
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
              
              {showAddService ? (
                <View style={[styles.addServiceForm, isDark && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <TouchableOpacity
                    onPress={() => setShowServiceModal(true)}
                    activeOpacity={0.7}
                  >
                    <TextInput
                      label="Service"
                      value={newService.name || ""}
                      mode="outlined"
                      style={styles.serviceInput}
                      outlineColor={isDark ? '#444' : "#ddd"}
                      activeOutlineColor={Colors.primary}
                      editable={false}
                      right={<TextInput.Icon 
                        icon="menu-down" 
                        color={isDark ? '#fff' : '#666'} 
                        onPress={() => setShowServiceModal(true)} 
                      />}
                      placeholder="Select a service"
                      theme={{ 
                        colors: { 
                          text: isDark ? '#fff' : '#000', 
                          placeholder: isDark ? colors.subtext : '#999',
                          background: isDark ? colors.cardBackground : 'transparent',
                          primary: Colors.primary,
                          onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                        } 
                      }}
                      textColor={isDark ? '#fff' : '#000'}
                    />
                    
                    <TextInput
                      label="Price (₦)"
                      value={newService.price}
                      onChangeText={(text) => setNewService(prev => ({ ...prev, price: text }))}
                      mode="outlined"
                      keyboardType="numeric"
                      style={styles.serviceInput}
                      outlineColor={isDark ? '#444' : "#ddd"}
                      activeOutlineColor={Colors.primary}
                      theme={{ 
                        colors: { 
                          text: isDark ? '#fff' : '#000', 
                          placeholder: isDark ? colors.subtext : '#999',
                          background: isDark ? colors.cardBackground : 'transparent',
                          primary: Colors.primary,
                          onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                        } 
                      }}
                      textColor={isDark ? '#fff' : '#000'}
                    />
                    
                    <View style={styles.serviceButtonRow}>
                      <Button 
                        mode="outlined" 
                        onPress={() => {
                          setShowAddService(false);
                          setNewService({ name: '', price: '' });
                        }}
                        style={[styles.serviceButton, styles.cancelButton, isDark && { borderColor: '#444' }]}
                        textColor={isDark ? colors.text : undefined}
                      >
                        Cancel
                      </Button>
                      <Button 
                        mode="contained" 
                        onPress={handleAddService}
                        style={styles.serviceButton}
                        buttonColor={Colors.primary}
                      >
                        Save
                      </Button>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <Button 
                  mode="outlined" 
                  icon="plus" 
                  onPress={() => {
                    setNewService({ name: '', price: '' });
                    setShowAddService(true);
                  }}
                  style={[styles.addButton, isDark && { borderColor: Colors.primary }]}
                  textColor={isDark ? Colors.primary : undefined}
                >
                  Add Service
                </Button>
              )}
            </View>

            {/* Password Section */}
            <View style={[styles.sectionContainer, isDark && { backgroundColor: colors.cardBackground, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={styles.sectionTitleContainer}>
                <MaterialCommunityIcons 
                  name="shield-lock" 
                  size={22} 
                  color={isDark ? colors.tint : Colors.primary} 
                />
                <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Change Password</Text>
              </View>
              
              <TextInput
                label="Current Password"
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="New Password"
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <TextInput
                label="Confirm New Password"
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                outlineColor={isDark ? '#444' : "#ddd"}
                activeOutlineColor={Colors.primary}
                theme={{ 
                  colors: { 
                    text: isDark ? '#fff' : '#000', 
                    placeholder: isDark ? colors.subtext : '#999',
                    background: isDark ? colors.cardBackground : 'transparent',
                    primary: Colors.primary,
                    onSurfaceVariant: isDark ? 'rgba(255,255,255,0.7)' : '#666'
                  } 
                }}
                textColor={isDark ? '#fff' : '#000'}
              />
              
              <Button 
                mode="contained" 
                onPress={handleUpdatePassword} 
                style={styles.passwordButton}
                loading={loading}
                buttonColor={Colors.primary}
              >
                Update Password
              </Button>
            </View>

            {/* Save Button - Improved */}
            <View style={styles.saveButtonContainer}>
              <Button 
                mode="contained"
                style={styles.saveButton}
                buttonColor={Colors.primary}
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                labelStyle={styles.saveButtonText}
                contentStyle={{ height: 50 }}
              >
                Save Changes
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      {/* Service Selection Modal */}
      <Modal
        visible={showServiceModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalView}>
          <View style={[styles.modalHeader, isDark && { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>Select a Service</Text>
            <TouchableOpacity 
              onPress={() => setShowServiceModal(false)}
              style={styles.closeModalButton}
            >
              <AntDesign name="close" size={24} color={isDark ? colors.text : "black"} />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchContainer, isDark && { backgroundColor: colors.cardBackground, borderBottomColor: '#444' }]}>
            <View style={[styles.searchWrapper, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="search" size={18} color={isDark ? colors.subtext : "#999"} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, isDark && { color: '#fff', backgroundColor: 'transparent' }]}
                placeholder="Search services..."
                placeholderTextColor={isDark ? colors.subtext : "#999"}
                value={serviceSearch}
                onChangeText={setServiceSearch}
                theme={{ colors: { text: isDark ? '#fff' : '#000' } }}
              />
            </View>
          </View>
          <ScrollView style={[styles.modalScrollView, isDark && { backgroundColor: colors.cardBackground }]}>
            {services
              .filter((serviceItem: ServiceCategory) => 
                !serviceSearch || 
                serviceItem.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                (serviceItem.subcategories?.some((sub: string) => 
                  sub.toLowerCase().includes(serviceSearch.toLowerCase())) ?? false)
              )
              .map((serviceItem: ServiceCategory) => (
                <View key={serviceItem.name}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: formData.services.includes(serviceItem.name) 
                        ? (isDark ? 'rgba(52, 152, 219, 0.2)' : "#e6f7ff") 
                        : (isDark ? colors.cardBackground : "white"),
                      borderRadius: 8,
                      marginBottom: 5,
                      borderWidth: 1,
                      borderColor: formData.services.includes(serviceItem.name) 
                        ? (isDark ? '#3498db' : "#91d5ff") 
                        : (isDark ? 'rgba(255,255,255,0.1)' : "#ddd")
                    }}
                  >
                    {/* Service name touchable */}
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 4 }}
                      onPress={() => {
                        if (formData.services.includes(serviceItem.name)) {
                          setFormData(prev => ({
                            ...prev,
                            services: formData.services.filter(s => s !== serviceItem.name)
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            services: [...formData.services, serviceItem.name]
                          }));
                          // Close the modal after selecting a service
                          setShowServiceModal(false);
                          // Set the new service name
                          setNewService(prev => ({ ...prev, name: serviceItem.name }));
                        }
                      }}
                    >
                      <Text style={{ 
                        color: isDark ? colors.text : "#333", 
                        fontSize: 16,
                        fontFamily: 'Urbanist-Medium'
                      }}>
                        {serviceItem.name}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* Selection indicator or expand button */}
                    {formData.services.includes(serviceItem.name) ? (
                      <Ionicons name="checkmark-circle" size={20} color={isDark ? '#3498db' : "#1890ff"} />
                    ) : serviceItem.subcategories && serviceItem.subcategories.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => toggleCategoryExpansion(serviceItem.name, { stopPropagation: () => {} })}
                        style={{ padding: 8 }}
                      >
                        <MaterialCommunityIcons 
                          name={expandedCategories.includes(serviceItem.name) ? "chevron-down" : "chevron-right"} 
                          size={20} 
                          color={isDark ? colors.subtext : "#999"} 
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  
                  {/* Subcategories section */}
                  {serviceItem.subcategories && expandedCategories.includes(serviceItem.name) && 
                    serviceItem.subcategories
                      .filter((subcat: string) => !serviceSearch || subcat.toLowerCase().includes(serviceSearch.toLowerCase()))
                      .map((subcategory: string, index: number) => {
                        const serviceWithSubcat = `${serviceItem.name} - ${subcategory}`;
                        return (
                          <TouchableOpacity
                            key={`${serviceItem.name}-${subcategory}-${index}`}
                            style={{
                              padding: 10,
                              paddingLeft: 20,
                              backgroundColor: formData.services.includes(serviceWithSubcat)
                                ? (isDark ? 'rgba(52, 152, 219, 0.1)' : "#f0f8ff")
                                : (isDark ? colors.secondaryBackground : "#f8f9fa"),
                              borderRadius: 8,
                              marginBottom: 5,
                              marginLeft: 15,
                              borderWidth: 1,
                              borderColor: formData.services.includes(serviceWithSubcat)
                                ? (isDark ? 'rgba(52, 152, 219, 0.5)' : "#bae7ff")
                                : (isDark ? 'rgba(255,255,255,0.1)' : "#eee")
                            }}
                            onPress={() => {
                              if (formData.services.includes(serviceWithSubcat)) {
                                setFormData(prev => ({
                                  ...prev,
                                  services: formData.services.filter(s => s !== serviceWithSubcat)
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  services: [...formData.services, serviceWithSubcat]
                                }));
                                // Close the modal after selecting a subcategory
                                setShowServiceModal(false);
                                // Set the new service name
                                setNewService(prev => ({ ...prev, name: serviceWithSubcat }));
                              }
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ 
                                color: isDark ? colors.subtext : "#666", 
                                fontSize: 14,
                                fontFamily: 'Urbanist-Regular'
                              }}>
                                • {subcategory}
                              </Text>
                              {formData.services.includes(serviceWithSubcat) && (
                                <Ionicons name="checkmark-circle" size={16} color={isDark ? '#3498db' : "#1890ff"} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                  }
                </View>
              ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
} 