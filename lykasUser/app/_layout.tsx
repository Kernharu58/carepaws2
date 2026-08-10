import { useEffect, useCallback, Component, type ReactNode } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import { useFonts, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { AuthProvider } from "../context/AuthContext";
import PrimaryButton from "../components/PrimaryButton";
import "../global.css";

SplashScreen.preventAutoHideAsync();

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * A minimal class-based error boundary wrapping the root layout, so a
 * single screen crash doesn't white-screen the whole app (§3's mobile
 * production addition). React error boundaries must be class
 * components — there is no hook equivalent.
 */
class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Uncaught error in app tree:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-cream px-8">
          <Text className="text-center font-display text-xl text-ink">Something went wrong</Text>
          <Text className="text-center font-sans text-sm text-muted">
            Please restart the app. If this keeps happening, contact support from the Help screen.
          </Text>
          <PrimaryButton label="Try again" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded && !fontError) {
    // Splash screen is still showing — render nothing underneath it.
    return null;
  }

  return (
    <RootErrorBoundary>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
    </RootErrorBoundary>
  );
}
