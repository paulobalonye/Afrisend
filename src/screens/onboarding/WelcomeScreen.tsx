import React, { useRef, useState } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { useTheme } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
};

const SLIDES: Slide[] = [
  { key: 'slide1', titleKey: 'onboarding.slide1.title', descriptionKey: 'onboarding.slide1.description', icon: '🌍' },
  { key: 'slide2', titleKey: 'onboarding.slide2.title', descriptionKey: 'onboarding.slide2.description', icon: '⚡' },
  { key: 'slide3', titleKey: 'onboarding.slide3.title', descriptionKey: 'onboarding.slide3.description', icon: '🔒' },
];

export function WelcomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(slideIndex);
  }

  function handleGetStarted() {
    navigation.navigate('Phone');
  }

  function handleSignIn() {
    navigation.navigate('Phone');
  }

  function handleNext() {
    if (currentSlide < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentSlide + 1, animated: true });
    } else {
      handleGetStarted();
    }
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* Hero area with carousel */}
      <View style={[styles.heroArea, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.brandContainer}>
          <Typography variant="h1" style={styles.brandName} center>
            AfriSend
          </Typography>
          <Typography
            variant="body"
            style={[styles.tagline, { color: 'rgba(255,255,255,0.8)' }]}
            center
          >
            {t('onboarding.welcome.title')}
          </Typography>
        </View>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <Typography style={styles.slideIcon} center>{item.icon}</Typography>
            <Typography variant="h3" center style={{ color: theme.colors.text, marginBottom: 8 }}>
              {t(item.titleKey)}
            </Typography>
            <Typography variant="body" center style={{ color: theme.colors.textSecondary, paddingHorizontal: 16 }}>
              {t(item.descriptionKey)}
            </Typography>
          </View>
        )}
      />

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: theme.colors.background }]}>
        <StepIndicator totalSteps={SLIDES.length} currentStep={currentSlide} style={styles.dots} />

        <Button
          label={currentSlide < SLIDES.length - 1 ? t('common.next') : t('onboarding.welcome.cta')}
          onPress={handleNext}
          size="lg"
          testID="welcome-cta-button"
        />

        <TouchableOpacity
          onPress={handleSignIn}
          style={styles.signInLink}
          accessibilityRole="button"
        >
          <Typography variant="body" style={{ color: theme.colors.textSecondary }} center>
            {t('onboarding.welcome.signIn')}
          </Typography>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroArea: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    color: '#FFF',
    letterSpacing: 1,
  },
  tagline: {
    letterSpacing: 0.3,
  },
  slide: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 8,
  },
  slideIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  controls: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 16,
  },
  dots: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  signInLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});
