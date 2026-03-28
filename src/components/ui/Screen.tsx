import React, { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  avoidKeyboard?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
};

export function Screen({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  avoidKeyboard = false,
  edges = ['top', 'bottom', 'left', 'right'],
}: ScreenProps) {
  const theme = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
  };

  const inner = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );

  const wrappedInKeyboard = avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView style={[containerStyle, style]} edges={edges}>
      <StatusBar
        barStyle={theme.colors.statusBar === 'dark' ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.background}
      />
      {wrappedInKeyboard}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
