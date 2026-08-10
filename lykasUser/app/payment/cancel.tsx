import { View, Text } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../../components/PrimaryButton";
import colors from "../../utils/colors";

/** Deep-link landing screen from the payment gateway (§6.2, §4). */
export default function PaymentCancelScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-cream px-8">
      <Ionicons name="close-circle" size={56} color={colors.status.neutral} />
      <Text className="text-center font-display text-2xl text-ink">Payment cancelled</Text>
      <Text className="text-center font-sans text-sm text-muted">No charge was made. You can try again anytime.</Text>
      <PrimaryButton label="Back to home" onPress={() => router.replace("/(tabs)")} className="mt-2" />
    </SafeAreaView>
  );
}
