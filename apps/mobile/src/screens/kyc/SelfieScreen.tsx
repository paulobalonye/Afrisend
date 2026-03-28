import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, Alert, Platform, ActionSheetIOS } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { KycProgressHeader } from '@/components/kyc/KycProgressHeader';
import { useTheme } from '@/theme';
import { useKycStore } from '@/store/kycStore';
import { uploadSelfie } from '@/api/endpoints/kyc';
import type { KycStackParamList } from '@/navigation/KycNavigator';

type NavigationProp = NativeStackNavigationProp<KycStackParamList, 'Selfie'>;

export function SelfieScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { session, capturedSelfie, setCapturedSelfie, addUploadedDocument } = useKycStore();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleCaptureSelfie() {
    const capture = async (source: 'camera' | 'gallery') => {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('errors.cameraPermissionDenied'));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: true,
          aspect: [1, 1],
          cameraType: ImagePicker.CameraType.front,
        });
        if (!result.canceled && result.assets[0]) {
          setCapturedSelfie(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('errors.galleryPermissionDenied'));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: true,
          aspect: [1, 1],
        });
        if (!result.canceled && result.assets[0]) {
          setCapturedSelfie(result.assets[0].uri);
        }
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('kyc.idUpload.takePhoto'), t('kyc.idUpload.chooseGallery'), t('common.cancel')],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) capture('camera');
          else if (buttonIndex === 1) capture('gallery');
        },
      );
    } else {
      Alert.alert(
        t('kyc.selfie.capture'),
        undefined,
        [
          { text: t('kyc.idUpload.takePhoto'), onPress: () => capture('camera') },
          { text: t('kyc.idUpload.chooseGallery'), onPress: () => capture('gallery') },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
    }
  }

  async function handleNext() {
    if (!session || !capturedSelfie) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const selfieDoc = await uploadSelfie(session.sessionId, capturedSelfie);
      addUploadedDocument(selfieDoc);
      navigation.navigate('Address');
    } catch {
      setUploadError(t('errors.serverError'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Screen scrollable>
      <KycProgressHeader currentStep={2} totalSteps={3} title={t('kyc.selfie.title')} />

      <View style={styles.content}>
        <Typography variant="body" style={{ color: theme.colors.textSecondary, marginBottom: 24 }}>
          {t('kyc.selfie.subtitle')}
        </Typography>

        {/* Face outline / selfie area */}
        <View style={styles.selfieArea}>
          {capturedSelfie ? (
            <Image source={{ uri: capturedSelfie }} style={styles.selfieImage} />
          ) : (
            <View
              style={[
                styles.facePlaceholder,
                { borderColor: theme.colors.primary + '60', backgroundColor: theme.colors.surface },
              ]}
            >
              <Typography style={styles.faceIcon}>🙂</Typography>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 8 }} center>
                {t('kyc.selfie.subtitle')}
              </Typography>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('kyc.selfie.instructions.title')}
          </Typography>
          {[
            '☀️ ' + t('kyc.selfie.instructions.light'),
            '👓 ' + t('kyc.selfie.instructions.glasses'),
            '😐 ' + t('kyc.selfie.instructions.neutral'),
            '🎯 ' + t('kyc.selfie.instructions.center'),
          ].map((tip) => (
            <Typography key={tip} variant="bodySmall" style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>
              {tip}
            </Typography>
          ))}
        </View>

        {/* Liveness check note */}
        <View style={[styles.livenessNote, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
          <Typography variant="bodySmall" style={{ color: theme.colors.primary, lineHeight: 20 }}>
            🔒 {t('kyc.selfie.livenessCheck')}: {t('kyc.selfie.livenessInstructions')}
          </Typography>
        </View>

        {uploadError && (
          <Typography variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
            {uploadError}
          </Typography>
        )}
      </View>

      <View style={styles.footer}>
        {capturedSelfie ? (
          <View style={styles.footerButtons}>
            <Button
              label={t('kyc.selfie.retake')}
              onPress={handleCaptureSelfie}
              variant="outline"
              fullWidth={false}
              style={styles.retakeButton}
            />
            <Button
              label={t('common.next')}
              onPress={handleNext}
              loading={isUploading}
              fullWidth={false}
              style={styles.nextButton}
              testID="selfie-next-button"
            />
          </View>
        ) : (
          <Button
            label={t('kyc.selfie.capture')}
            onPress={handleCaptureSelfie}
            size="lg"
            testID="capture-selfie-button"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  selfieArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  facePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIcon: {
    fontSize: 64,
  },
  selfieImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  instructionsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  livenessNote: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
