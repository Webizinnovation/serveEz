import { Resend } from 'resend';


const resendApiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY || '';
const resend = new Resend(resendApiKey);


const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'admin@serveez.com';

const FROM_EMAIL = process.env.EXPO_PUBLIC_FROM_EMAIL || 'no-reply@serveez.com';

/**
 * Sends an email notification to admin when a new booking is created
 * @param bookingData - The booking data to include in the email
 * @returns A promise that resolves when the email is sent
 */
export const sendBookingNotificationToAdmin = async (bookingData: any): Promise<boolean> => {
  try {
    console.log('[EmailService] Sending booking notification to admin');
    
    // Format date and time for better readability
    const formattedDate = new Date(bookingData.booking_date).toLocaleDateString();
    const [hours, minutes] = bookingData.booking_time.split(':');
    const formattedTime = `${hours}:${minutes}`;
    

    let servicesHtml = '<ul style="padding-left: 20px;">';
    if (bookingData.service_details && Array.isArray(bookingData.service_details)) {
      bookingData.service_details.forEach((service: any) => {
        servicesHtml += `<li>${service.service_name} ${
          service.details ? `<span style="color: #666; font-size: 14px;">(${service.details})</span>` : ''
        }</li>`;
      });
    } else {
      servicesHtml += `<li>${bookingData.service}</li>`;
    }
    servicesHtml += '</ul>';
   
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(bookingData.amount);
    
    const paymentPlan = bookingData.payment_plan === 'full_upfront' 
      ? 'Full Payment' 
      : 'Half Payment (50% now, 50% after service)';
    
    const customerName = bookingData.customer_name || 'Customer';
    const customerPhone = bookingData.customer_phone || 'N/A';
    const providerName = bookingData.provider_name || 'Provider';
    const providerPhone = bookingData.provider_phone || 'N/A';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0066cc; margin: 0;">New Booking Alert</h1>
          <p style="color: #666; font-size: 16px;">A new booking has been created in ServeEz</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
          <h2 style="margin-top: 0; color: #333; font-size: 18px;">Booking Details</h2>
          <p><strong>Booking ID:</strong> ${bookingData.id}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Address:</strong> ${bookingData.address}</p>
          ${bookingData.landmark ? `<p><strong>Landmark:</strong> ${bookingData.landmark}</p>` : ''}
          <p><strong>Payment Plan:</strong> ${paymentPlan}</p>
          <p><strong>Amount:</strong> ${formattedAmount}</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
          <h2 style="margin-top: 0; color: #333; font-size: 18px;">Services</h2>
          ${servicesHtml}
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
          <h2 style="margin-top: 0; color: #333; font-size: 18px;">Customer Information</h2>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Phone:</strong> ${customerPhone}</p>
          <p><strong>User ID:</strong> ${bookingData.user_id}</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
          <h2 style="margin-top: 0; color: #333; font-size: 18px;">Provider Information</h2>
          <p><strong>Name:</strong> ${providerName}</p>
          <p><strong>Phone:</strong> ${providerPhone}</p>
          <p><strong>Provider ID:</strong> ${bookingData.provider_id}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e6e6e6; color: #666; font-size: 14px;">
          <p>This is an automated email from ServeEz. Please do not reply to this email.</p>
        </div>
      </div>
    `;
    

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Booking: ${bookingData.service}`,
      html: htmlBody,
    });
    
    if (error) {
      console.error('[EmailService] Error sending email:', error);
      return false;
    }
    
    console.log('[EmailService] Email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('[EmailService] Exception sending email:', error);
    return false;
  }
};

export default {
  sendBookingNotificationToAdmin,
}; 