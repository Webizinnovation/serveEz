import { ScaledSheet, moderateScale ,verticalScale } from 'react-native-size-matters';
import { Colors } from '../constants/Colors';
import { StyleSheet } from 'react-native';

export const UserServicesStyles = ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      paddingVertical: '30@ms',
    },
    mainTabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: '16@ms',
    },
    mainTabButton: {
      paddingVertical: '8@ms',
    },
    selectedMainTab: {
      borderBottomWidth: '3@ms',
      borderBottomColor: 'rgba(30,141,204,0.93)',
      paddingHorizontal: '13@ms',
    },
    mainTabText: {
      fontSize: '14@ms',
      color: '#888',
      fontFamily: 'Urbanist-Bold',
    },
    selectedMainTabText: {
      color: 'rgba(0,0,0,0.65)',
      fontFamily: 'Urbanist-Bold',
    },
    bookingTabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: '16@ms',
    },
    bookingContainer: {
      paddingBottom: '16@ms',
    },
    bookingTabButton: {
      paddingVertical: '8@ms',
      paddingHorizontal: '16@ms',
      borderRadius: '20@ms',
      backgroundColor: '#F5F5F5',
    },
    selectedBookingTab: {
      backgroundColor: '#263238',
    },
    bookingTabText: {
      fontSize: '14@ms',
      color: '#888',
      fontFamily: 'Urbanist-Bold',
    },
    selectedBookingTabText: {
      color: '#fff',
      fontFamily: 'Urbanist-Bold',
    },
    servicesContainer: {
      paddingHorizontal: '16@ms',
      paddingBottom: '16@ms',
    },
    serviceButton: {
      backgroundColor: '#E5ECF0',
      margin: '8@ms',
      borderRadius: '20@ms',
      paddingVertical: '16@ms',
      paddingHorizontal: '20@ms',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 1.5,
      elevation: 2,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
    },
    serviceText: {
      fontSize: '15@ms',
      color: '#333',
      fontFamily: 'Urbanist-SemiBold',
      textAlign: 'center',
      flex: 1,
      flexWrap: 'wrap',
      marginRight: '8@ms',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24@ms',
    },
    emptyTitle: {
      fontSize: '20@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
      marginTop: '16@ms',
      marginBottom: '8@ms',
    },
    emptyText: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Regular',
      color: '#666',
      textAlign: 'center',
    },
    cancelledCard: {
      backgroundColor: '#fff',
      borderRadius: '12@s',
      padding: '16@s',
      marginBottom: '12@s',
      borderWidth: 1,
      borderColor: '#E8E8E8',
    },
    cancelledHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16@s',
    },
    cancelledDate: {
      fontSize: '14@s',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
    },
    statusContainer: {
      backgroundColor: '#FFE5E5',
      paddingHorizontal: '12@s',
      paddingVertical: '4@s',
      borderRadius: '6@s',
    },
    statusText: {
      color: '#FF4B55',
      fontSize: '12@s',
      fontFamily: 'Urbanist-SemiBold',
    },
    providerInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '16@s',
    },
    cancelledProviderImage: {
      width: '48@s',
      height: '48@s',
      borderRadius: '24@s',
      marginRight: '12@s',
    },
    providerDetails: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
    },
    rightColumn: {
      alignItems: 'flex-end',
      maxWidth: '60%',
      paddingLeft: '8@s',
    },
    bookingIdContainer: {
      backgroundColor: '#F5F5F5',
      paddingHorizontal: '8@s',
      paddingVertical: '4@s',
      borderRadius: '12@s',
    },
    bookingId: {
      fontSize: '12@s',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
    },
    providerName: {
      fontSize: '16@s',
      fontFamily: 'Urbanist-Bold',
      color: '#000',
      marginBottom: '4@s',
    },
    reportButton: {
      backgroundColor: '#FFE5E5',
      paddingVertical: '12@s',
      borderRadius: '8@s',
      alignItems: 'center',
    },
    reportButtonText: {
      color: '#FF4B55',
      fontSize: '14@s',
      fontFamily: 'Urbanist-SemiBold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16@s',
    },
    reportModalContent: {
      backgroundColor: '#fff',
      borderRadius: '16@s',
      padding: '20@s',
      width: '90%',
      maxWidth: '400@s',
      maxHeight: '85%',
    },
    reportModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@s',
      paddingBottom: '10@s',
      borderBottomWidth: '1@s',
      borderBottomColor: '#EFEFEF',
    },
    reportModalTitle: {
      fontSize: '20@s',
      fontFamily: 'Urbanist-Bold',
      color: '#000',
    },
    closeButton: {
      padding: '8@s',
      borderRadius: '20@s',
      backgroundColor: '#F5F5F5',
    },
    reportForm: {
      gap: '16@s',
    },
    inputContainer: {
      gap: '8@s',
    },
    inputLabel: {
      fontSize: '14@s',
      fontFamily: 'Urbanist-SemiBold',
      color: '#333',
    },
    reasonInput: {
      width: '100%',
      height: '48@s',
      borderWidth: '1@s',
      borderColor: '#DDD',
      borderRadius: '8@s',
      paddingHorizontal: '12@s',
      backgroundColor: '#F9F9F9',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Regular',
      marginBottom: '12@s',
    },
    descriptionInput: {
      width: '100%',
      minHeight: '100@s',
      borderWidth: '1@s',
      borderColor: '#DDD',
      borderRadius: '8@s',
      paddingHorizontal: '12@s',
      paddingVertical: '12@s',
      backgroundColor: '#F9F9F9',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Regular',
      marginBottom: '20@s',
      textAlignVertical: 'top',
    },
    submitReportButton: {
      backgroundColor: '#FF4B55',
      paddingVertical: '12@s',
      borderRadius: '8@s',
      alignItems: 'center',
      marginTop: '8@s',
    },
    submitReportButtonDisabled: {
      opacity: 0.7,
    },
    submitReportButtonText: {
      color: '#fff',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Bold',
    },
    reviewModalContent: {
      backgroundColor: '#fff',
      borderRadius: '16@s',
      padding: '20@s',
      width: '90%',
      maxWidth: '400@s',
      maxHeight: '85%',
    },
    reviewModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@s',
      paddingBottom: '10@s',
      borderBottomWidth: '1@s',
      borderBottomColor: '#EFEFEF',
    },
    reviewModalTitle: {
      fontSize: '20@s',
      fontFamily: 'Urbanist-Bold',
      color: '#000',
    },
    reviewForm: {
      gap: '16@s',
    },
    ratingContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: '8@s',
      marginBottom: '16@s',
    },
    reviewInput: {
      width: '100%',
      minHeight: '100@s',
      borderWidth: '1@s',
      borderColor: '#DDD',
      borderRadius: '8@s',
      paddingHorizontal: '12@s',
      paddingVertical: '12@s',
      backgroundColor: '#F9F9F9',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Regular',
      marginBottom: '20@s',
      textAlignVertical: 'top',
    },
    submitReviewButton: {
      backgroundColor: '#007BFF',
      paddingVertical: '12@s',
      borderRadius: '8@s',
      alignItems: 'center',
      marginTop: '8@s',
    },
    submitReviewButtonDisabled: {
      opacity: 0.7,
    },
    submitReviewButtonText: {
      color: '#fff',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Bold',
    },
    favoritesContainer: {
      padding: '8@ms',
    },
    favoriteColumnWrapper: {
      justifyContent: 'space-between',
      paddingHorizontal: '8@ms',
    },
    favoriteProviderCard: {
      width: '48%',
      backgroundColor: '#fff',
      borderRadius: '12@ms',
      marginBottom: '16@ms',
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
    },
    favoriteProviderImage: {
      width: '100%',
      height: '120@ms',
      resizeMode: 'cover',
    },
    favoriteProviderInfo: {
      padding: '12@ms',
    },
    favoriteProviderName: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#000',
      marginBottom: '4@ms',
    },
    favoriteProviderService: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
      marginBottom: '8@ms',
    },
    locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '4@ms',
    },
    locationText: {
      fontSize: '12@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
      marginLeft: '4@ms',
    },
    levelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    levelText: {
      fontSize: '12@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#007BFF',
      marginLeft: '4@ms',
    },
    moreButton: {
      position: 'absolute',
      bottom: '8@ms',
      right: '8@ms',
      padding: '4@ms',
      backgroundColor: '#F5F5F5',
      borderRadius: '15@ms',
      width: '30@ms',
      height: '30@ms',
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionsMenu: {
      position: 'absolute',
      bottom: '45@ms',
      right: '8@ms',
      backgroundColor: '#fff',
      borderRadius: '8@ms',
      padding: '8@ms',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      width: '150@ms',
    },
    optionButton: {
      paddingVertical: '8@ms',
      paddingHorizontal: '12@ms',
      borderRadius: '4@ms',
    },
    removeButton: {
      marginTop: '4@ms',
    },
    optionText: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#007BFF',
    },
    removeText: {
      color: '#FF4B55',
    },
    cancelModalContent: {
      backgroundColor: '#fff',
      borderRadius: '16@s',
      padding: '20@s',
      width: '90%',
      maxWidth: '400@s',
      maxHeight: '85%',
    },
    cancelModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@s',
      paddingBottom: '10@s',
      borderBottomWidth: '1@s',
      borderBottomColor: '#EFEFEF',
    },
    cancelModalTitle: {
      fontSize: '20@s',
      fontFamily: 'Urbanist-Bold',
      color: '#000',
    },
    cancelForm: {
      gap: '16@s',
    },
    cancelReasonInput: {
      width: '100%',
      minHeight: '100@s',
      borderWidth: '1@s',
      borderColor: '#DDD',
      borderRadius: '8@s',
      paddingHorizontal: '12@s',
      paddingVertical: '12@s',
      backgroundColor: '#F9F9F9',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Regular',
      marginBottom: '20@s',
      textAlignVertical: 'top',
    },
    cancelButton: {
      backgroundColor: '#FF4B55',
      paddingVertical: '12@s',
      borderRadius: '8@s',
      alignItems: 'center',
      marginTop: '8@s',
    },
    cancelButtonDisabled: {
      opacity: 0.7,
    },
    cancelButtonText: {
      color: '#fff',
      fontSize: '16@s',
      fontFamily: 'Urbanist-Bold',
    },
    subCategoryButton: {
      backgroundColor: '#F5F5F5',
      marginHorizontal: '16@ms',
      marginVertical: '4@ms',
      borderRadius: '12@ms',
      paddingVertical: '10@ms',
      paddingHorizontal: '20@ms',
      flexDirection: 'row',
      alignItems: 'center',
    },
    subCategoryText: {
      fontSize: '13@ms',
      color: '#777',
      fontFamily: 'Urbanist-Medium',
      marginLeft: '8@ms',
    },
    footerContainer: {
      paddingVertical: '16@vs',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '8@vs',
      marginBottom: '0@vs',
      paddingBottom: '24@vs',
      width: '100%',
    },
    footerText: {
      fontSize: '14@ms',
      color: '#888',
      fontFamily: 'Urbanist-Medium',
      textAlign: 'center',
    },
  });

export const UserWalletStyles = ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f9f9f9', 
      paddingHorizontal: '10@ms' 
    },
    balanceCard: {
      width: 'auto',
      height: '210@ms',
      backgroundColor: '#263238',
      borderRadius: '16@ms',
      padding: '16@ms',
      marginBottom: '16@ms',
    },
    backgroundImageStyle: {
      borderRadius: '16@ms',
    },
    balanceTitle: {
      color: '#A9BCCF',
      fontSize: '14.56@ms',
      fontFamily: 'Urbanist-SemiBold',
    },
    balanceAmount: {
      color: '#FFFFFF',
      fontSize: '44@ms',
      fontFamily: 'Urbanist-Regular',
      marginVertical: '8@ms',
    },
    actionButtons: {
      flexDirection: 'row',
      paddingVertical: '40@ms',
      justifyContent: 'center',
      gap: '40@ms',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12@ms',
      borderRadius: '8@ms',
      minWidth: '120@ms',
      gap: '8@ms',
    },
    withdrawButton: {
      backgroundColor: '#666',
    },
    depositButton: {
      backgroundColor: Colors.primary,
    },
    actionButtonText: {
      color: 'white',
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
    },
    payrollContainer: {
      backgroundColor: '#FFFFFF',
      borderRadius: '12@ms',
      padding: '18@ms',
      marginBottom: '16@ms',
      elevation: 5,
      borderColor: Colors.primary,
      borderWidth: 1,
    },
    pallroll: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: '15@ms',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
      marginBottom: '10@ms',
    },
    payrollTitle: {
      fontSize: '14.56@ms',
      color: '#082431',
      fontFamily: 'Urbanist-Medium',
    },
    payrollServers: {
      fontSize: '13@ms',
      color: '#08243',
      fontFamily: 'Urbanist-Regular',
    },
    payrollDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
      paddingVertical: '8@ms',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
      marginBottom: '8@ms',
    },
    payrollIcon: {
      marginRight: '8@ms',
    },
    payrollTextContainer: {
      flex: 1,
    },
    payrollName: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-SemiBold',
      color: 'rgba(51,51,51,0.68)',
    },
    payrollAmount: {
      fontSize: '12@ms',
      paddingTop: '4@ms',
      color: '#FF5A5F',
      fontFamily: 'Urbanist-Bold',
    },
    payrollService: {
      fontSize: '12@ms',
      color: '#666',
      fontFamily: 'Urbanist-Regular',
      marginTop: '2@ms',
    },
    payNowButton: {
      borderColor: Colors.primary,
      borderWidth: 1,
      paddingVertical: '8@ms',
      paddingHorizontal: '16@ms',
      borderRadius: '20@ms',
      backgroundColor: Colors.primary,
    },
    payNowText: {
      color: '#FFFFFF',
      fontSize: '12@ms',
      fontFamily: 'Urbanist-Bold',
    },
    transactionsContainer: {
      paddingBottom: '16@ms',
    },
    transactionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@ms',
    },
    transactionsTitle: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
    },
    seeAllText: {
      fontSize: '12@ms',
      color: Colors.primary,
      fontFamily: 'Urbanist-SemiBold',
    },
    transactionsList: {
      paddingBottom: '16@ms',
    },
    transactionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: '12@ms',
      padding: '12@ms',
      marginBottom: '8@ms',
      elevation: 3,
    },
    transactionDetails: {
      flex: 1,
      paddingLeft: '8@ms',
    },
    transactionName: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
    },
    transactionDate: {
      fontSize: '12@ms',
      color: '#666',
      fontFamily: 'Urbanist-Medium',
      marginTop: '2@ms',
    },
    transactionAmount: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
    },
    headerContainer: {
      marginTop: '10@ms',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: '20@ms',
    },
    imageUploadContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileImage: {
      width: '50@ms',
      height: '50@ms',
      borderRadius: '30@ms',
      borderWidth: 2,
      borderColor: '#fff',
      backgroundColor: '#ccc',
      marginRight: '8@ms',
    },
    greeting: { 
      fontSize: '20@ms', 
      fontFamily: 'Urbanist-SemiBold' 
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24@ms',
      backgroundColor: '#fff',
      borderRadius: '12@ms',
      marginTop: '8@ms',
    },
    emptyTitle: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
      marginTop: '12@ms',
      marginBottom: '4@ms',
    },
    emptyText: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Regular',
      color: '#666',
      textAlign: 'center',
      lineHeight: '20@ms',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: 'white',
      borderTopLeftRadius: '20@ms',
      borderTopRightRadius: '20@ms',
      padding: '16@ms',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '16@ms',
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    modalTitle: {
      fontSize: '18@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
    },
    closeButton: {
      padding: '4@ms',
    },
    modalBody: {
      paddingVertical: '16@ms',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '16@ms',
    },
    modalIcon: {
      marginRight: '12@ms',
    },
    transactionType: {
      fontSize: '20@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
    },
    amountLarge: {
      fontSize: '32@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
      marginBottom: '24@ms',
    },
    detailsContainer: {
      backgroundColor: '#f8f8f8',
      borderRadius: '12@ms',
      padding: '16@ms',
    },
    detailItem: {
      marginBottom: '12@ms',
    },
    detailLabel: {
      fontSize: '12@ms',
      color: '#666',
      fontFamily: 'Urbanist-Medium',
      marginBottom: '4@ms',
    },
    detailValue: {
      fontSize: '14@ms',
      color: '#333',
      fontFamily: 'Urbanist-Bold',
    },
  }); 

export const getUserServicesStyles = (isDark: boolean) => {
  return ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : '#fff',
      paddingVertical: '30@ms',
    },
    mainTabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: '16@ms',
    },
    mainTabButton: {
      paddingVertical: '8@ms',
    },
    selectedMainTab: {
      borderBottomWidth: '3@ms',
      borderBottomColor: 'rgba(30,141,204,0.93)',
      paddingHorizontal: '13@ms',
    },
    mainTabText: {
      fontSize: '14@ms',
      color: isDark ? '#BBBBBB' : '#888',
      fontFamily: 'Urbanist-Bold',
    },
    selectedMainTabText: {
      color: isDark ? '#FFFFFF' : 'rgba(0,0,0,0.65)',
      fontFamily: 'Urbanist-Bold',
    },
    bookingTabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: '16@ms',
    },
    bookingContainer: {
      paddingBottom: '16@ms',
    },
    bookingTabButton: {
      paddingVertical: '8@ms',
      paddingHorizontal: '16@ms',
      borderRadius: '20@ms',
      backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
    },
    selectedBookingTab: {
      backgroundColor: isDark ? '#3D7BFF' : '#263238',
    },
    bookingTabText: {
      fontSize: '14@ms',
      color: isDark ? '#BBBBBB' : '#888',
      fontFamily: 'Urbanist-Bold',
    },
    selectedBookingTabText: {
      color: '#fff',
      fontFamily: 'Urbanist-Bold',
    },
    servicesContainer: {
      paddingHorizontal: '16@ms',
      paddingBottom: '16@ms',
    },
    serviceButton: {
      backgroundColor: isDark ? '#2A2A2A' : '#E5ECF0',
      margin: '8@ms',
      borderRadius: '20@ms',
      paddingVertical: '16@ms',
      paddingHorizontal: '20@ms',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 1.5,
      elevation: 2,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
    },
    serviceText: {
      fontSize: '15@ms',
      color: isDark ? '#FFFFFF' : '#333',
      fontFamily: 'Urbanist-SemiBold',
      textAlign: 'left',
      flex: 1,
      flexWrap: 'wrap',
      marginRight: '8@ms',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24@ms',
    },
    emptyTitle: {
      fontSize: '20@ms',
      fontFamily: 'Urbanist-Bold',
      color: isDark ? '#FFFFFF' : '#333',
      marginTop: '16@ms',
      marginBottom: '8@ms',
    },
    emptyText: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Regular',
      color: isDark ? '#BBBBBB' : '#666',
      textAlign: 'center',
    },
    cancelledCard: {
      backgroundColor: isDark ? '#1E1E1E' : '#fff',
      borderRadius: '12@s',
      padding: '16@s',
      marginBottom: '12@s',
      borderWidth: 1,
      borderColor: isDark ? '#333333' : '#E8E8E8',
    },
    // Add more style properties with isDark condition as needed...
  });
}; 
