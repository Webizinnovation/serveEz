import React, { memo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, InteractionManager } from 'react-native';
import { ServiceItem as ServiceItemType } from '../types/index';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface ServiceItemProps {
  service: ServiceItemType;
  onSelect: () => void;
  onAgreedAmountChange: (amount: string) => void;
  onServiceDetailsChange: (details: string) => void;
  isDark?: boolean;
  colors?: any;
}

export const ServiceItem = memo(({ 
  service, 
  onSelect, 
  onAgreedAmountChange,
  onServiceDetailsChange,
  isDark = false,
  colors
}: ServiceItemProps) => {
  const [localAgreedAmount, setLocalAgreedAmount] = useState<string>(
    service.agreedAmount?.toString() || ''
  );
  const [localDetails, setLocalDetails] = useState<string>(
    service.serviceDetails || ''
  );
  
 
  const isMounted = useRef(true);
  const detailsTimerRef = useRef<any>(null);
  const amountTimerRef = useRef<any>(null);
  const lastSubmittedDetails = useRef(service.serviceDetails || '');
  const lastSubmittedAmount = useRef(service.agreedAmount?.toString() || '');

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
      if (detailsTimerRef.current) {
        clearTimeout(detailsTimerRef.current);
      }
      if (amountTimerRef.current) {
        clearTimeout(amountTimerRef.current);
      }
    };
  }, []);

  const handleAmountChange = useCallback((text: string) => {
    try {
      const numericText = text.replace(/[^0-9]/g, '');
      
      setLocalAgreedAmount(numericText);
      
      if (amountTimerRef.current) {
        clearTimeout(amountTimerRef.current);
      }
      
      if (numericText !== lastSubmittedAmount.current) {
        amountTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            lastSubmittedAmount.current = numericText;
            requestAnimationFrame(() => {
              if (isMounted.current) {
                onAgreedAmountChange(numericText);
              }
            });
          }
        }, 800);
      }
    } catch (err) {
      console.error('Error updating amount:', err);
    }
  }, [onAgreedAmountChange]);

  const handleDetailsChange = useCallback((text: string) => {
    try {
      setLocalDetails(text);
      
      if (detailsTimerRef.current) {
        clearTimeout(detailsTimerRef.current);
      }
      
      if (text !== lastSubmittedDetails.current) {
        detailsTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            lastSubmittedDetails.current = text;
            requestAnimationFrame(() => {
              if (isMounted.current) {
                onServiceDetailsChange(text);
              }
            });
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Error updating service details:', err);
    }
  }, [onServiceDetailsChange]);

  React.useEffect(() => {
    if (isMounted.current) {
      const newAmount = service.agreedAmount?.toString() || '';
      const newDetails = service.serviceDetails || '';
      
      if (newAmount !== localAgreedAmount) {
        setLocalAgreedAmount(newAmount);
        lastSubmittedAmount.current = newAmount;
      }
      
      if (newDetails !== localDetails) {
        setLocalDetails(newDetails);
        lastSubmittedDetails.current = newDetails;
      }
    }
  }, [service.agreedAmount, service.serviceDetails]);
  
  return (
    <View style={[
      styles.container, 
      isDark && {
        borderColor: colors.border,
        backgroundColor: colors.cardBackground
      },
      service.selected && [
        styles.selected,
        isDark && {
          borderColor: colors.tint,
          backgroundColor: 'rgba(51,169,212,0.15)'
        }
      ]
    ]}>
      <TouchableOpacity 
        style={styles.mainContent}
        onPress={onSelect}
      >
        <View style={styles.serviceInfo}>
          <Text style={[
            styles.name,
            isDark && { color: colors.text }
          ]}>{service.name}</Text>
          <Text style={[
            styles.price,
            isDark && { color: colors.subtext }
          ]}>₦{service.price.toLocaleString()}</Text>
        </View>
        <View style={[
          styles.checkbox, 
          isDark && { borderColor: colors.border },
          service.selected && [
            styles.checkboxSelected,
            isDark && { backgroundColor: colors.tint, borderColor: colors.tint }
          ]
        ]}>
          {service.selected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>

      {service.selected && (
        <View style={[
          styles.detailsContainer,
          isDark && { borderTopColor: colors.border }
        ]}>
          <TextInput
            style={[
              styles.input,
              isDark && {
                borderColor: colors.border,
                backgroundColor: colors.secondaryBackground,
                color: colors.text
              }
            ]}
            placeholder="Enter agreed amount (optional)"
            placeholderTextColor={isDark ? colors.inactive : '#999'}
            keyboardType="numeric"
            value={localAgreedAmount}
            onChangeText={handleAmountChange}
            maxLength={10}
            returnKeyType="done"
          />
          <TextInput
            style={[
              styles.input, 
              styles.detailsInput,
              isDark && {
                borderColor: colors.border,
                backgroundColor: colors.secondaryBackground,
                color: colors.text
              }
            ]}
            placeholder="Enter service details (optional)"
            placeholderTextColor={isDark ? colors.inactive : '#999'}
            multiline
            numberOfLines={3}
            value={localDetails}
            onChangeText={handleDetailsChange}
            maxLength={500}
            textAlignVertical="top"
            blurOnSubmit={true}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selected: {
    borderColor: '#00456C',
    backgroundColor: '#F0F9FF',
  },
  name: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
  price: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  serviceInfo: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  detailsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
  detailsInput: {
    height: 100,
    textAlignVertical: 'top',
  },
}); 