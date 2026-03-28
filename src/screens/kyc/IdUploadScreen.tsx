import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { KycProgressHeader } from '@/components/kyc/KycProgressHeader';
import { useTheme } from '@/theme';
import { useKycStore, selectIsIdUploadComplete } from '@/store/kycStore';
import { uploadIdDocument } from '@/api/endpoints/kyc';
import { validateImageFile } from '@/utils/validation';
import type { KycStackParamList } from '@/navigation/KycNavigator';
import type { DocumentType } from '@/api/endpoints/kyc';

type NavigationProp = NativeStackNavigationProp<KycStackParamList, 'IdUpload'>;

const DOCUMENT_TYPES: { type: DocumentType; labelKey: string; icon: string; needsBack: boolean }[] = [
  { type: 'passport', labelKey: 'kyc.idUpload.passport', icon: '🛂', needsBack: false },
  { type: 'national_id', labelKey: 'kyc.idUpload.nationalId', icon: '🪪', needsBack: true },
  { type: 'driver_license', labelKey: 'kyc.idUpload.driverLicense', icon: '🚗', needsBack: true },
];

async function pickImage(source: 'camera' | 'gallery'): Promise<string | null> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  }
}

export function IdUploadScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const {
    session,
    selectedDocumentType,
    capturedIdFront,
    capturedIdBack,
    setSelectedDocumentType,
    setCapturedIdFront,
    setCapturedIdBack,
    addUploadedDocument,
  } = useKycStore();
  const isComplete = useKycStore(selectIsIdUploadComplete);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedDocInfo = DOCUMENT_TYPES.find((d) => d.type === selectedDocumentType);

  function showImageSourcePicker(onSource: (source: 'camera' | 'gallery') => void) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('kyc.idUpload.takePhoto'), t('kyc.idUpload.chooseGallery'), t('common.cancel')],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) onSource('camera');
          else if (buttonIndex === 1) onSource('gallery');
        },
      );
    } else {
      Alert.alert(
        'Choose source',
        undefined,
        [
          { text: t('kyc.idUpload.takePhoto'), onPress: () => onSource('camera') },
          { text: t('kyc.idUpload.chooseGallery'), onPress: () => onSource('gallery') },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
    }
  }

  async function handleCaptureFront() {
    showImageSourcePicker(async (source) => {
      const uri = await pickImage(source);
      if (!uri || !selectedDocumentType) return;
      const validationError = validateImageFile(uri);
      if (validationError) {
        setUploadError(t(validationError));
        return;
      }
      setCapturedIdFront({ uri, documentType: selectedDocumentType, side: 'front' });
    });
  }

  async function handleCaptureBack() {
    showImageSourcePicker(async (source) => {
      const uri = await pickImage(source);
      if (!uri || !selectedDocumentType) return;
      const validationError = validateImageFile(uri);
      if (validationError) {
        setUploadError(t(validationError));
        return;
      }
      setCapturedIdBack({ uri, documentType: selectedDocumentType, side: 'back' });
    });
  }

  async function handleNext() {
    if (!session || !capturedIdFront || !selectedDocumentType) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const frontDoc = await uploadIdDocument(session.sessionId, capturedIdFront.uri, selectedDocumentType, 'front');
      addUploadedDocument(frontDoc);

      if (selectedDocInfo?.needsBack && capturedIdBack) {
        const backDoc = await uploadIdDocument(session.sessionId, capturedIdBack.uri, selectedDocumentType, 'back');
        addUploadedDocument(backDoc);
      }

      navigation.navigate('Selfie');
    } catch {
      setUploadError(t('errors.serverError'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Screen scrollable>
      <KycProgressHeader currentStep={1} totalSteps={3} title={t('kyc.idUpload.title')} />

      <View style={styles.content}>
        <Typography variant="body" style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>
          {t('kyc.idUpload.subtitle')}
        </Typography>

        {/* Document type selector */}
        <View style={styles.docTypeRow}>
          {DOCUMENT_TYPES.map((doc) => {
            const isSelected = selectedDocumentType === doc.type;
            return (
              <TouchableOpacity
                key={doc.type}
                onPress={() => setSelectedDocumentType(doc.type)}
                style={[
                  styles.docTypeCard,
                  {
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.surface,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                testID={`doc-type-${doc.type}`}
              >
                <Typography style={styles.docTypeIcon}>{doc.icon}</Typography>
                <Typography
                  variant="caption"
                  center
                  style={{
                    color: isSelected ? theme.colors.primary : theme.colors.text,
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  {t(doc.labelKey)}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Instructions */}
        {selectedDocumentType && (
          <View style={[styles.instructionsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('kyc.idUpload.instructions.title')}
            </Typography>
            {[
              '☀️ ' + t('kyc.idUpload.instructions.light'),
              '📋 ' + t('kyc.idUpload.instructions.flat'),
              '🔍 ' + t('kyc.idUpload.instructions.clear'),
              '🚫 ' + t('kyc.idUpload.instructions.noGlare'),
            ].map((tip) => (
              <Typography key={tip} variant="bodySmall" style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>
                {tip}
              </Typography>
            ))}
          </View>
        )}

        {/* Front capture */}
        {selectedDocumentType && (
          <View style={styles.captureSection}>
            <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('kyc.idUpload.frontSide')}
            </Typography>
            <TouchableOpacity
              onPress={handleCaptureFront}
              style={[
                styles.capturePlaceholder,
                {
                  borderColor: capturedIdFront ? theme.colors.success : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              testID="capture-front-button"
              accessibilityRole="button"
            >
              {capturedIdFront ? (
                <Image source={{ uri: capturedIdFront.uri }} style={styles.capturedImage} resizeMode="cover" />
              ) : (
                <View style={styles.placeholderContent}>
                  <Typography style={styles.captureIcon}>📷</Typography>
                  <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                    {t('kyc.idUpload.takePhoto')} / {t('kyc.idUpload.chooseGallery')}
                  </Typography>
                </View>
              )}
            </TouchableOpacity>
            {capturedIdFront && (
              <TouchableOpacity
                onPress={handleCaptureFront}
                style={styles.retakeLink}
                accessibilityRole="button"
              >
                <Typography variant="bodySmall" style={{ color: theme.colors.primary }}>
                  {t('kyc.idUpload.retake')}
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Back capture (only for national_id and driver_license) */}
        {selectedDocumentType && selectedDocInfo?.needsBack && (
          <View style={styles.captureSection}>
            <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('kyc.idUpload.backSide')}
            </Typography>
            <TouchableOpacity
              onPress={handleCaptureBack}
              style={[
                styles.capturePlaceholder,
                {
                  borderColor: capturedIdBack ? theme.colors.success : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              testID="capture-back-button"
              accessibilityRole="button"
            >
              {capturedIdBack ? (
                <Image source={{ uri: capturedIdBack.uri }} style={styles.capturedImage} resizeMode="cover" />
              ) : (
                <View style={styles.placeholderContent}>
                  <Typography style={styles.captureIcon}>📷</Typography>
                  <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                    {t('kyc.idUpload.takePhoto')} / {t('kyc.idUpload.chooseGallery')}
                  </Typography>
                </View>
              )}
            </TouchableOpacity>
            {capturedIdBack && (
              <TouchableOpacity
                onPress={handleCaptureBack}
                style={styles.retakeLink}
                accessibilityRole="button"
              >
                <Typography variant="bodySmall" style={{ color: theme.colors.primary }}>
                  {t('kyc.idUpload.retake')}
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        )}

        {uploadError && (
          <Typography variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
            {uploadError}
          </Typography>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          label={t('common.next')}
          onPress={handleNext}
          loading={isUploading}
          disabled={!isComplete}
          size="lg"
          testID="id-upload-next-button"
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
  docTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  docTypeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  docTypeIcon: {
    fontSize: 28,
  },
  instructionsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  captureSection: {
    marginBottom: 20,
  },
  capturePlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderContent: {
    alignItems: 'center',
  },
  captureIcon: {
    fontSize: 40,
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  retakeLink: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
});
