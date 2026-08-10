import { View, Text, ActivityIndicator } from "react-native";
import colors from "../utils/colors";
import PrimaryButton from "./PrimaryButton";

interface StateViewProps {
  state: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Generic empty/loading/error state used across every list screen. */
export default function StateView({ state, title, message, onRetry }: StateViewProps) {
  if (state === "loading") {
    return (
      <View className="flex-1 items-center justify-center gap-3 py-16">
        <ActivityIndicator size="large" color={colors.primary} />
        {message && <Text className="font-sans text-muted">{message}</Text>}
      </View>
    );
  }

  if (state === "error") {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6 py-16">
        <Text className="font-sans-medium text-center text-base text-ink">{title ?? "Something went wrong"}</Text>
        {message && <Text className="text-center font-sans text-sm text-muted">{message}</Text>}
        {onRetry && <PrimaryButton label="Try again" variant="outline" onPress={onRetry} className="mt-2" />}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-2 px-6 py-16">
      <Text className="font-sans-medium text-center text-base text-ink">{title ?? "Nothing here yet"}</Text>
      {message && <Text className="text-center font-sans text-sm text-muted">{message}</Text>}
    </View>
  );
}
