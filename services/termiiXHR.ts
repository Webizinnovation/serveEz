import { supabase } from './supabase';

/**
 * Service for handling OTP operations using the Termii API with XMLHttpRequest
 * Implementation based on the provided code sample
 */
class TermiiXHRService {
  // Read API details from environment variables
  private static apiKey = process.env.EXPO_PUBLIC_SMS_API_KEY || 'TLFySdyIpWrQLmZcXMzwhSfgKMXwVIgWMmnBkZpHRNmCsVvmhqJkhCvCKQCvVq';
  private static baseUrl = process.env.EXPO_PUBLIC_SMS_API_BASE_URL || 'https://v3.api.termii.com';
  
  /**
   * Normalizes a phone number to ensure it's in the correct international format
   * Removes leading zeros and ensures it has the country code
   */
  private static normalizePhoneNumber(phoneNumber: string): string {
    // Validate and handle empty input
    if (!phoneNumber || phoneNumber.trim() === '') {
      console.error('[TermiiXHRService] Invalid phone number provided');
      throw new Error('Invalid phone number');
    }
    
    // Log the input for debugging
    console.log('[TermiiXHRService] Normalizing phone number:', phoneNumber);
    
    // Check if the input looks like a UUID, which would indicate a mix-up with user ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(phoneNumber)) {
      console.error('[TermiiXHRService] Error: UUID provided instead of phone number:', phoneNumber);
      throw new Error('UUID provided instead of phone number');
    }
    
    // Remove any non-numeric characters except the leading plus sign
    let cleanedPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Clean phone number - remove leading zero if present
    let normalizedPhone = cleanedPhone.replace(/^0+/, '');
    
    // If it doesn't start with +, add + sign
    if (!normalizedPhone.startsWith('+')) {
      // If it doesn't start with country code, add Nigerian code as default
      if (!normalizedPhone.startsWith('234')) {
        normalizedPhone = '234' + normalizedPhone;
      }
    } else {
      // If it has + sign, remove it for API compatibility
      normalizedPhone = normalizedPhone.substring(1);
    }
    
    console.log('[TermiiXHRService] Normalized phone number:', phoneNumber, '→', normalizedPhone);
    return normalizedPhone;
  }
  
  /**
   * Sends an OTP using XMLHttpRequest exactly as provided in the sample
   * @param phoneNumber - The phone number to send OTP to
   * @param userId - The user ID associated with this OTP
   * @returns A promise that resolves when the request is complete
   */
 static async sendOTP(userId: string, phoneNumber: string, emailAddress: string = '') {
  return new Promise<any>(async (resolve, reject) => {
    try {
      if (!phoneNumber || phoneNumber.trim() === '') {
        console.error('[TermiiXHRService] Error: Phone number is required');
        reject(new Error('Phone number is required'));
        return;
      }

      const phoneToUse = phoneNumber.trim();
      const formattedPhone = TermiiXHRService.normalizePhoneNumber(phoneToUse);
      console.log('[TermiiXHRService] Sending OTP to formatted number:', formattedPhone);

      const requestBody = {
        api_key: TermiiXHRService.apiKey,
        message_type: "NUMERIC",
        to: formattedPhone,
        from: "N-Alert", 
        channel: "dnd",
        pin_attempts: 3,
        pin_time_to_live: 5,
        pin_length: 4,
        pin_placeholder: "{pin}", 
        pin_type: "NUMERIC",
        message_text: "Your ServeEz verification code is {pin}. Expires in 5 minutes.", 
        route_id: 117 
      };

      console.log('[TermiiXHRService] Sending request to Termii API:', JSON.stringify({
        ...requestBody,
        api_key: '****'
      }, null, 2));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${TermiiXHRService.baseUrl}/api/sms/otp/send`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = async function() {
        let response;
        try {
          response = JSON.parse(xhr.responseText);
          console.log('[TermiiXHRService] Raw API response:', JSON.stringify(response, null, 2));
        } catch (parseError) {
          console.error('[TermiiXHRService] Error parsing API response:', parseError);
          reject(new Error('Invalid API response format'));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[TermiiXHRService] API request successful with status:', xhr.status);
          console.log('[TermiiXHRService] SMS Message ID:', response.sms_message_id); // Log for tracking

          let referenceId = response.pinId || (response.data && response.data.pinId);
          if (!referenceId) {
            console.error('[TermiiXHRService] No pinId found in response');
            reject(new Error('No reference ID found'));
            return;
          }

          resolve({
            success: true,
            message: 'OTP sent successfully',
            referenceId,
            smsMessageId: response.sms_message_id 
          });
        } else {
          console.error('[TermiiXHRService] API request failed with status:', xhr.status);
          reject(new Error(response.message || 'Failed to send OTP'));
        }
      };

      xhr.onerror = function() {
        console.error('[TermiiXHRService] Network error sending OTP request');
        reject(new Error('Network error when sending OTP'));
      };

      xhr.send(JSON.stringify(requestBody));
    } catch (error) {
      console.error('[TermiiXHRService] Exception in sendOTP:', error);
      reject(error);
    }
  });
}
  
  /**
   * Verifies an OTP code using XMLHttpRequest
   * @param code - The OTP code to verify
   * @param userId - The user ID associated with this OTP
   * @param referenceId - The reference ID returned by the SMS API
   * @returns A promise resolving to the result of the verification
   */
  static verifyOTP(code: string, userId: string, referenceId?: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('[TermiiXHRService] Verifying OTP for user:', userId, 'with code:', code, 'reference:', referenceId);
        
        // Ensure we have a reference ID
        if (!referenceId) {
          console.error('[TermiiXHRService] No reference ID provided for verification');
          reject(new Error('Missing reference ID for verification'));
          return;
        }

        // Verify using Termii API
        try {
          // Prepare API request for verification - use pin_id as the parameter name
          const requestBody = {
            api_key: TermiiXHRService.apiKey,
            pin_id: referenceId,
            pin: code
          };

          console.log('[TermiiXHRService] Sending verification request to Termii API:', JSON.stringify({
            ...requestBody,
            api_key: '****' // Mask the API key in logs
          }, null, 2));
          
          // Send the verification request
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${TermiiXHRService.baseUrl}/api/sms/otp/verify`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          
          // Create a promise to handle the XMLHttpRequest
          const apiVerification = await new Promise((resolveXhr, rejectXhr) => {
            xhr.onload = function() {
              try {
                const response = JSON.parse(xhr.responseText);
                console.log('[TermiiXHRService] Verification API response:', JSON.stringify(response, null, 2));
                
                if (xhr.status >= 200 && xhr.status < 300) {
                  // Check if the verification was successful based on response
                  if (response.verified === true || response.status === 'success' || 
                      (response.data && response.data.verified === true) ||
                      (typeof response.pinId !== 'undefined') || 
                      (response.verified === "true")) {
                    console.log('[TermiiXHRService] API verification successful');
                    resolveXhr(true);
                  } else {
                    console.log('[TermiiXHRService] API verification failed: incorrect code');
                    resolveXhr(false);
                  }
                } else {
                  console.error('[TermiiXHRService] API verification failed with status:', xhr.status);
                  resolveXhr(false);
                }
              } catch (parseError) {
                console.error('[TermiiXHRService] Error parsing verification response:', parseError);
                console.log('[TermiiXHRService] Raw response text:', xhr.responseText);
                resolveXhr(false);
              }
            };
            
            xhr.onerror = function() {
              console.error('[TermiiXHRService] Network error during verification');
              rejectXhr(new Error('Network error during verification'));
            };
            
            xhr.send(JSON.stringify(requestBody));
          });
          
          if (apiVerification === true) {
            console.log('[TermiiXHRService] Verification successful');
            resolve(true);
            return;
          }
          
          // API verification failed
          console.log('[TermiiXHRService] API verification returned false');
          resolve(false);
          return;
        } catch (apiError: any) {
          console.error('[TermiiXHRService] Error using API verification:', apiError);
          reject(new Error('API verification failed: ' + apiError.message));
          return;
        }
      } catch (error) {
        console.error('[TermiiXHRService] Error in verifyOTP:', error);
        reject(error);
      }
    });
  }
}

export default TermiiXHRService; 