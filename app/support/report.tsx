import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../components/ThemeProvider';

// Simple MIME type detection function
const getMimeType = (fileUri: string): string => {
  const extension = fileUri.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

type AttachmentType = {
  uri: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
};

type ReportType = {
  id: string;
  user_id: string;
  reporter_type: string;
  issue_type: string;
  title: string;
  description: string;
  status: string;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
};

export default function ReportProblemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reportId = params.reportId as string | undefined;
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  
  // Define additional theme colors specific to this screen
  const extendedColors = {
    ...colors,
    secondaryBackground: isDark ? '#2C2C2C' : '#D9D9D9',
    border: isDark ? 'rgba(255,255,255,0.2)' : '#ccc',
  };

  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentType | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'form' | 'view'>(reportId ? 'view' : 'form');
  const [report, setReport] = useState<ReportType | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [fetchingReport, setFetchingReport] = useState(reportId ? true : false);

  const issueTypes = [
    'App Performance',
    'Booking Issue',
    'Payment Problem',
    'Provider Complaint',
    'Account Access',
    'Feature Request',
    'Other'
  ];
  
  // Fetch report details if we have a reportId
  useEffect(() => {
    if (reportId) {
      fetchReport(reportId);
    }
  }, [reportId]);
  
  const fetchReport = async (id: string) => {
    try {
      setFetchingReport(true);
      const { data, error } = await supabase
        .from('support_reports')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      setReport(data as ReportType);
      
      if (data.attachment_path) {
        // Get the signed URL for the attachment
        const { data: urlData, error: urlError } = await supabase.storage
          .from('report_attachments')
          .createSignedUrl(data.attachment_path, 60 * 60); // 1 hour expiry
          
        if (urlError) throw urlError;
        
        setAttachmentUrl(urlData.signedUrl);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      Alert.alert('Error', 'Failed to load report details');
    } finally {
      setFetchingReport(false);
    }
  };
  
  const createNewReport = () => {
    setViewMode('form');
    setReport(null);
    setIssueType('');
    setDescription('');
    setAttachment(null);
    router.setParams({});
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'You need to grant permission to access your media library.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileExtension = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = `image/${fileExtension}`;
        
        setAttachment({
          uri: asset.uri,
          type: 'image',
          name: `image.${fileExtension}`,
          mimeType: mimeType
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'You need to grant permission to access your camera.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileExtension = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = `image/${fileExtension}`;
        
        setAttachment({
          uri: asset.uri,
          type: 'image',
          name: `image.${fileExtension}`,
          mimeType: mimeType
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };
  
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true
      });
      
      if (result.canceled) return;
      
      const asset = result.assets?.[0];
      if (!asset) return;
      
      const mimeType = asset.mimeType || getMimeType(asset.uri);
      
      setAttachment({
        uri: asset.uri,
        type: 'file',
        name: asset.name || 'document',
        mimeType: mimeType
      });
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const uploadAttachment = async (userId: string, reportId: string) => {
    if (!attachment) return null;
    
    try {
      // Get file extension and name
      const filename = attachment.name;
      const filePath = `${userId}/${reportId}/${filename}`;
      
      // Upload exactly as in UserChatRoom.tsx (no third parameter)
      const { data, error } = await supabase.storage
        .from('report_attachments')
        .upload(filePath, {
          uri: attachment.uri,
          type: attachment.mimeType || 'application/octet-stream',
          name: attachment.name
        } as any);
      
      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }
      
      // Return the path for storing in the database
      return filePath;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!issueType) {
      Alert.alert('Error', 'Please select an issue type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the problem');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'You must be logged in to report a problem');
      return;
    }

    setLoading(true);

    try {
      // Create the report directly in the support_reports table
      const title = `Report: ${issueType}`;
      const reporterType = profile.role || 'user';
      
      let report;
      
      try {
        const { data, error: reportError } = await supabase
          .from('support_reports')
          .insert({
            user_id: profile.id,
            reporter_type: reporterType as 'user' | 'provider',
            issue_type: issueType,
            title: title,
            description: description,
            status: 'open'
          })
          .select()
          .single();
        
        if (reportError || !data) {
          throw new Error(reportError?.message || 'Failed to create support report');
        }
        
        report = data;
      } catch (createError) {
        console.error('Error creating report:', createError);
        throw createError; // Re-throw to show to the user
      }
      
      // If there's an attachment, try to upload it but don't block submission on failure
      if (attachment && report) {
        try {
          const attachmentPath = await uploadAttachment(profile.id, report.id);
          
          if (attachmentPath) {
            const { error: updateError } = await supabase
              .from('support_reports')
              .update({ attachment_path: attachmentPath })
              .eq('id', report.id);
            
            if (updateError) {
              console.error('Error updating report with attachment:', updateError);
            }
          }
        } catch (uploadError: any) {
          console.error('File upload error:', uploadError);
          
          // Check specifically for TypeError Network failure
          const isTypeErrorNetworkFailure = 
            (uploadError instanceof TypeError && 
             uploadError.message && 
             uploadError.message.includes('Network') && 
             uploadError.message.includes('fail')) ||
            (uploadError.message && 
             uploadError.message.includes('TypeError') && 
             uploadError.message.includes('Network') &&
             (uploadError.message.includes('fail') || uploadError.message.includes('failed')));
          
          // Check for other network errors as fallback
          const isOtherNetworkError = 
            uploadError.message && (
              uploadError.message.includes('Network request failed') ||
              uploadError.message.includes('network error') ||
              uploadError.message.includes('ERR_NETWORK') ||
              uploadError.message.includes('timeout') ||
              uploadError.message.includes('connection')
            );
          
          // Show different message based on error type
          if (isTypeErrorNetworkFailure) {
            Alert.alert(
              'Network Failure',
              'Your report was submitted successfully, but we couldn\'t upload the attachment due to a network failure. Your files were not included.'
            );
          } else if (isOtherNetworkError) {
            Alert.alert(
              'Network Issue',
              'Your report was submitted, but we couldn\'t upload the attachment due to a network problem.'
            );
          } else {
            Alert.alert(
              'Attachment Upload Issue',
              'Your report was submitted, but there was a problem with the attachment upload.'
            );
          }
          
          // Continue with the flow - the report was created successfully
        }
      }
      
      if (report) {
        // Set the report for viewing
        await fetchReport(report.id);
        
        // Change to view mode
        setViewMode('view');
        
        // Update the URL to include the report ID
        router.setParams({ reportId: report.id });
        
        // Reset form
        setIssueType('');
        setDescription('');
        setAttachment(null);
        
        // Show success message
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. Our team will review it and get back to you as soon as possible.'
        );
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(
        'Error',
        'Failed to submit your report: ' + (error instanceof Error ? error.message : 'Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };
  
  const getAttachmentIcon = () => {
    if (!attachment && !attachmentUrl) return null;
    
    const fileUrl = attachmentUrl || attachment?.uri || '';
    const isImage = attachment?.type === 'image' || 
                   (fileUrl.match(/\.(jpeg|jpg|gif|png)$/) !== null);
    
    if (isImage) {
      return <Feather name="image" size={20} color={isDark ? colors.text : "#333"} />;
    }
    
    // Determine file type icons based on extension or mime type
    if (fileUrl.match(/\.pdf$/i) || (attachment?.mimeType === 'application/pdf')) {
      return <FontAwesome5 name="file-pdf" size={20} color={isDark ? colors.text : "#333"} />;
    } else if (fileUrl.match(/\.(doc|docx)$/i) || 
             (attachment?.mimeType === 'application/msword') || 
             (attachment?.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      return <FontAwesome5 name="file-word" size={20} color={isDark ? colors.text : "#333"} />;
    } else if (fileUrl.match(/\.txt$/i) || (attachment?.mimeType === 'text/plain')) {
      return <FontAwesome5 name="file-alt" size={20} color={isDark ? colors.text : "#333"} />;
    }
    
    return <FontAwesome5 name="file" size={20} color={isDark ? colors.text : "#333"} />;
  };
  
  const openAttachment = async () => {
    if (attachmentUrl) {
      try {
        // Use the Linking API to open the URL
        await Linking.openURL(attachmentUrl);
      } catch (error) {
        console.error('Error opening attachment:', error);
        Alert.alert('Error', 'Could not open the attachment');
      }
    }
  };

  const renderForm = () => (
    <View style={styles.formContainer}>
      <Text style={[styles.formLabel, { color: extendedColors.text }]}>Issue Type*</Text>
      <View style={styles.issueTypeContainer}>
        {issueTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.issueTypeButton,
              { backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0' },
              issueType === type && { 
                backgroundColor: isDark ? 'rgba(245,130,32,0.2)' : 'rgba(0,69,108,0.1)',
                borderColor: extendedColors.tint,
                borderWidth: 1
              }
            ]}
            onPress={() => setIssueType(type)}
          >
            <Text style={[
              styles.issueTypeText,
              { color: isDark ? extendedColors.subtext : '#666' },
              issueType === type && { color: extendedColors.tint, fontFamily: 'Urbanist-Bold' }
            ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.formLabel, { color: extendedColors.text }]}>Description*</Text>
      <View style={[
        styles.textAreaContainer, 
        { 
          backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0',
          borderColor: isDark ? extendedColors.border : '#ddd'
        }
      ]}>
        <TextInput
          style={[
            styles.textArea,
            { color: extendedColors.text }
          ]}
          placeholder="Please describe the issue you're experiencing in detail..."
          placeholderTextColor={extendedColors.subtext}
          multiline
          numberOfLines={8}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />
      </View>

      <Text style={[styles.formLabel, { color: extendedColors.text, marginTop: 20 }]}>Attachment (Optional)</Text>
      <View style={styles.attachmentContainer}>
        <TouchableOpacity 
          style={[styles.attachmentButton, { backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0' }]} 
          onPress={pickImage}
        >
          <Feather name="image" size={20} color={isDark ? extendedColors.text : "#555"} />
          <Text style={[styles.attachmentButtonText, { color: isDark ? extendedColors.text : "#555" }]}>
            Image
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.attachmentButton, { backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0' }]} 
          onPress={takePhoto}
        >
          <Feather name="camera" size={20} color={isDark ? extendedColors.text : "#555"} />
          <Text style={[styles.attachmentButtonText, { color: isDark ? extendedColors.text : "#555" }]}>
            Camera
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.attachmentButton, { backgroundColor: isDark ? extendedColors.secondaryBackground : '#f0f0f0' }]} 
          onPress={pickDocument}
        >
          <Feather name="file" size={20} color={isDark ? extendedColors.text : "#555"} />
          <Text style={[styles.attachmentButtonText, { color: isDark ? extendedColors.text : "#555" }]}>
            File
          </Text>
        </TouchableOpacity>
      </View>

      {attachment && (
        <View style={styles.previewContainer}>
          {attachment.type === 'image' ? (
            <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
          ) : (
            <View style={[styles.filePreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f8f8f8' }]}>
              <FontAwesome5 
                name={
                  attachment.mimeType.includes('pdf') ? 'file-pdf' :
                  attachment.mimeType.includes('word') ? 'file-word' :
                  attachment.mimeType.includes('text') ? 'file-alt' : 'file'
                } 
                size={24} 
                color={isDark ? colors.text : "#333"} 
              />
              <Text style={[styles.fileNameText, { color: extendedColors.text }]} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.removeButton} onPress={removeAttachment}>
            <Feather name="x" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.formInfo, { color: extendedColors.subtext }]}>
        * Including specific details like dates, times, error messages, and steps to reproduce the issue will help us address your problem more quickly.
      </Text>

      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: extendedColors.tint },
          (loading || !issueType || !description.trim()) && styles.disabledButton
        ]}
        onPress={handleSubmit}
        disabled={loading || !issueType || !description.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Report</Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  const renderReportView = () => {
    if (fetchingReport) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: extendedColors.text }]}>Loading report details...</Text>
        </View>
      );
    }
    
    if (!report) {
      return (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: extendedColors.text }]}>Report not found</Text>
          <TouchableOpacity 
            style={[styles.newReportButton, { backgroundColor: extendedColors.tint }]}
            onPress={createNewReport}
          >
            <Text style={styles.newReportButtonText}>Create New Report</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.reportContainer}>
        <View style={styles.reportHeaderRow}>
          <View>
            <Text style={[styles.reportTitle, { color: extendedColors.text }]}>
              {report.title}
            </Text>
            <Text style={[styles.reportDate, { color: extendedColors.subtext }]}>
              {new Date(report.created_at).toLocaleDateString()} • {report.issue_type}
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge, 
            { 
              backgroundColor: 
                report.status === 'open' ? '#F7C26C' : 
                report.status === 'in_progress' ? '#6EB4FF' : '#7EE38F',
            }
          ]}>
            <Text style={styles.statusText}>
              {report.status === 'open' ? 'Open' : 
               report.status === 'in_progress' ? 'In Progress' : 'Resolved'}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.sectionTitle, { color: extendedColors.text }]}>Description</Text>
        <Text style={[styles.reportDescription, { color: extendedColors.text }]}>
          {report.description}
        </Text>
        
        {report.attachment_path && (
          <>
            <Text style={[styles.sectionTitle, { color: extendedColors.text, marginTop: 20 }]}>Attachment</Text>
            <TouchableOpacity
              style={[styles.attachmentRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f8f8f8' }]}
              onPress={openAttachment}
            >
              {getAttachmentIcon()}
              <Text style={[styles.attachmentName, { color: extendedColors.text }]}>
                {report.attachment_path.split('/').pop() || 'Attachment'}
              </Text>
              <Feather name="external-link" size={18} color={isDark ? colors.text : "#555"} />
            </TouchableOpacity>
          </>
        )}
        
        <TouchableOpacity 
          style={[styles.newReportButton, { backgroundColor: extendedColors.tint, marginTop: 30 }]}
          onPress={createNewReport}
        >
          <Text style={styles.newReportButtonText}>Create New Report</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Helper function to render the main content conditionally
  const renderContent = () => {
    // Only render the full content if the profile exists
    if (!profile) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: extendedColors.text }]}>Loading...</Text>
        </View>
      );
    }

    return viewMode === 'form' ? renderForm() : renderReportView();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: extendedColors.background }]}>
      <View style={[styles.header, { backgroundColor: extendedColors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? extendedColors.text : "#000"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: extendedColors.text }]}>
          {viewMode === 'form' ? 'Report a Problem' : 'Report Details'}
        </Text>
        {viewMode === 'view' && (
          <TouchableOpacity style={styles.headerButton} onPress={createNewReport}>
            <Ionicons name="add-circle-outline" size={24} color={isDark ? extendedColors.text : "#000"} />
          </TouchableOpacity>
        )}
        {viewMode === 'form' && <View style={{ width: 24 }} />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: '12@s',
    paddingHorizontal: '16@s',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: '8@s',
  },
  headerButton: {
    padding: '8@s',
  },
  headerTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: '30@s',
  },
  formContainer: {
    padding: '16@s',
  },
  formLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '10@s',
    marginTop: '16@s',
  },
  issueTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: '10@s',
  },
  issueTypeButton: {
    paddingHorizontal: '16@s',
    paddingVertical: '8@s',
    borderRadius: '8@s',
    marginRight: '8@s',
    marginBottom: '8@s',
  },
  issueTypeText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
  },
  textAreaContainer: {
    borderWidth: 1,
    borderRadius: '12@s',
    height: '160@s',
    padding: '12@s',
  },
  textArea: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '15@s',
    height: '140@s',
  },
  attachmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: '16@s',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12@s',
    borderRadius: '8@s',
    flex: 0.3,
  },
  attachmentButtonText: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '14@s',
    marginLeft: '8@s',
  },
  previewContainer: {
    marginBottom: '16@s',
    position: 'relative',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '200@s',
    borderRadius: '8@s',
    resizeMode: 'cover',
  },
  filePreview: {
    width: '100%',
    padding: '20@s',
    borderRadius: '8@s',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileNameText: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '16@s',
    marginLeft: '10@s',
    flex: 1,
  },
  removeButton: {
    position: 'absolute',
    top: '10@s',
    right: '10@s',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: '15@s',
    width: '30@s',
    height: '30@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formInfo: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '13@s',
    fontStyle: 'italic',
    marginTop: '10@s',
    marginBottom: '24@s',
  },
  submitButton: {
    paddingVertical: '14@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontFamily: 'Urbanist-Bold',
    fontSize: '16@s',
  },
  loadingContainer: {
    padding: '30@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: '12@s',
    fontFamily: 'Urbanist-Medium',
    fontSize: '16@s',
  },
  errorContainer: {
    padding: '30@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginBottom: '16@s',
    fontFamily: 'Urbanist-Medium',
    fontSize: '16@s',
  },
  newReportButton: {
    paddingVertical: '12@s',
    paddingHorizontal: '20@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10@s',
  },
  newReportButtonText: {
    color: 'white',
    fontFamily: 'Urbanist-Bold',
    fontSize: '16@s',
  },
  reportContainer: {
    padding: '16@s',
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16@s',
  },
  reportTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '4@s',
  },
  reportDate: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Medium',
  },
  statusBadge: {
    paddingVertical: '4@s',
    paddingHorizontal: '12@s',
    borderRadius: '20@s',
  },
  statusText: {
    color: '#333',
    fontSize: '12@s',
    fontFamily: 'Urbanist-Bold',
  },
  sectionTitle: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
    marginTop: '16@s',
  },
  reportDescription: {
    fontSize: '15@s',
    fontFamily: 'Urbanist-Regular',
    lineHeight: '22@s',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '12@s',
    borderRadius: '8@s',
    marginTop: '8@s',
  },
  attachmentName: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
    marginLeft: '10@s',
  },
}); 