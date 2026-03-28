import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ActionSheetIOS } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { KycProgressHeader } from '@/components/kyc/KycProgressHeader';
import { useTheme } from '@/theme';
import { useKycStore } from '@/store/kycStore';
import { uploadProofOfAddress, submitKycSession } from '@/api/endpoints/kyc';
import type { KycStackParamList } from '@/navigation/KycNavigator';

type NavigationProp = NativeStackNavigationProp<KycStackParamList, 'Address'>;

const ADDRESS_DOC_TYPES = [
  { key: 'utilityBill', icon: '💡' },
  { key: 'bankStatement', icon: '🏦' },
  { key: 'taxDocument', icon: '📄' },
  { key: 'governmentLetter', icon: '📮' },
] as const;

export function AddressScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const {
    session,
    capturedAddressDoc,
    setCapturedAddressDoc,
    addUploadedDocument,
    setSession,
  } = useKycStore();

  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string>('image/jpeg');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUploadDocument() {
    const pick = async (method: 'photo' | 'file') => {
      if (method === 'photo') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('errors.galleryPermissionDenied'));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          setCapturedAddressDoc(result.assets[0].uri);
          setDocMimeType('image/jpeg');
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset) {
          setCapturedAddressDoc(asset.uri);
          setDocMimeType(asset.mimeType ?? 'image/jpeg');
        }
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('kyc.idUpload.takePhoto'),
            t('kyc.idUpload.chooseGallery'),
            'Choose a file (PDF)',
            t('common.cancel'),
          ],
          cancelButtonIndex: 3,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(t('errors.cameraPermissionDenied'));
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
            if (!result.canceled && result.assets[0]) {
              setCapturedAddressDoc(result.assets[0].uri);
              setDocMimeType('image/jpeg');
            }
          } else if (buttonIndex === 1) {
            pick('photo');
          } else if (buttonIndex === 2) {
            pick('file');
          }
        },
      );
    } else {
      Alert.alert(
        t('kyc.address.uploadDocument'),
        undefined,
        [
          { text: t('kyc.idUpload.chooseGallery'), onPress: () => pick('photo') },
          { text: 'Choose a file (PDF)', onPress: () => pick('file') },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
    }
  }

  async function handleSubmit() {
    if (!session || !capturedAddressDoc) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const addressDoc = await uploadProofOfAddress(session.sessionId, capturedAddressDoc, docMimeType);
      addUploadedDocument(addressDoc);

      const updatedSession = await submitKycSession(session.sessionId);
      setSession(updatedSession);

      navigation.navigate('KycStatus');
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen scrollable>
      <KycProgressHeader currentStep={3} totalSteps={3} title={t('kyc.address.title')} />

      <View style={styles.content}>
        <Typography variant="body" style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>
          {t('kyc.address.subtitle')}
        </Typography>

        {/* Accepted document types */}
        <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('kyc.address.accepted')}
        </Typography>

        <View style={styles.docTypesGrid}>
          {ADDRESS_DOC_TYPES.map((doc) => {
            const isSelected = selectedDocType === doc.key;
            return (
              <TouchableOpacity
                key={doc.key}
                onPress={() => setSelectedDocType(doc.key)}
                style={[
                  styles.docTypeCard,
                  {
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.surface,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                testID={`address-doc-${doc.key}`}
              >
                <Typography style={styles.docTypeIcon}>{doc.icon}</Typography>
                <Typography
                  variant="bodySmall"
                  center
                  style={{
                    color: isSelected ? theme.colors.primary : theme.colors.text,
                    fontWeight: isSelected ? '600' : '400',
                    lineHeight: 18,
                  }}
                >
                  {t(`kyc.address.types.${doc.key}`)}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Requirements note */}
        <View style={[styles.requirementsNote, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
            ℹ️ {t('kyc.address.requirements')}
          </Typography>
        </View>

        {/* Upload area */}
        <TouchableOpacity
          onPress={handleUploadDocument}
          style={[
            styles.uploadArea,
            {
              borderColor: capturedAddressDoc ? theme.colors.success : theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          testID="upload-address-doc-button"
          accessibilityRole="button"
        >
          {capturedAddressDoc ? (
            <View style={styles.uploadedState}>
              <Typography style={{ fontSize: 36 }}>✅</Typography>
              <Typography variant="body" style={{ color: theme.colors.success, marginTop: 8, fontWeight: '600' }}>
                {t('kyc.address.uploaded')}
              </Typography>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                Tap to replace
              </Typography>
            </View>
          ) : (
            <View style={styles.uploadedState}>
              <Typography style={{ fontSize: 36 }}>📂</Typography>
              <Typography variant="body" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                {t('kyc.address.uploadDocument')}
              </Typography>
            </View>
          )}
        </TouchableOpacity>

        {error && (
          <Typography variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
            {error}
          </Typography>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          label={t('common.submit')}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!capturedAddressDoc}
          size="lg"
          testID="submit-kyc-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  docTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  docTypeCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  docTypeIcon: {
    fontSize: 28,
  },
  requirementsNote: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadedState: {
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
});
