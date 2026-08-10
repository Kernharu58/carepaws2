import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-3 bg-cream px-8">
        <Text className="font-display text-xl text-ink">This screen doesn't exist</Text>
        <Link href="/" className="font-sans-medium text-primary">
          Go to home screen
        </Link>
      </View>
    </>
  );
}
