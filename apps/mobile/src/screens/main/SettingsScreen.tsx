import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { useTheme } from '@/theme';
import { useLanguageStore } from '@/store/languageStore';
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from '@/i18n';

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const theme = useTheme();
  const { currentLanguage, setLanguage } = useLanguageStore();

  async function handleSelectLanguage(lang: SupportedLanguage) {
    if (lang === currentLanguage) return;
    await setLanguage(lang);
  }

  return (
    <Screen scrollable>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          testID="settings-back-button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Typography variant="body" style={{ color: theme.colors.primary }}>
            ← {t('common.back')}
          </Typography>
        </TouchableOpacity>
        <Typography variant="h3" style={{ color: theme.colors.text }}>
          {t('settings.title')}
        </Typography>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Language section */}
        <View style={styles.section}>
          <Typography
            variant="bodySmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            {t('settings.language')}
          </Typography>
          <View
            style={[
              styles.optionsCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            {SUPPORTED_LANGUAGES.map((lang, index) => {
              const isSelected = lang === currentLanguage;
              const isLast = index === SUPPORTED_LANGUAGES.length - 1;

              return (
                <TouchableOpacity
                  key={lang}
                  testID={`language-option-${lang}`}
                  onPress={() => handleSelectLanguage(lang)}
                  style={[
                    styles.option,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Typography
                    variant="body"
                    style={{
                      color: isSelected ? theme.colors.primary : theme.colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    }}
                  >
                    {LANGUAGE_NAMES[lang]}
                  </Typography>
                  {isSelected && (
                    <Typography
                      testID={`language-option-${lang}-selected`}
                      style={{ color: theme.colors.primary, fontSize: 18 }}
                    >
                      ✓
                    </Typography>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 4,
    minWidth: 80,
  },
  headerSpacer: {
    minWidth: 80,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  optionsCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
