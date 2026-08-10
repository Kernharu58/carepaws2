import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import colors from "../../utils/colors";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/logIn" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="adopt"
        options={{ title: "Adopt", tabBarIcon: ({ color, size }) => <Ionicons name="paw" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: "Favorites", tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: "Events", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: "Chat", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }}
      />
      {/* Reachable from Profile rather than the tab bar itself, to keep
          the bar to a manageable 6 items — still file-based routes
          under (tabs) per the source app's structure. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="my-applications" options={{ href: null }} />
    </Tabs>
  );
}
