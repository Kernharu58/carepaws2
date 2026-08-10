import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../../components/PrimaryButton";
import colors from "../../utils/colors";

/** Deep-link landing screen from the payment gateway (§6.2, §4). */
export default function PaymentSuccessScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-cream px-8">
      <Ionicons name="checkmark-circle" size={56} color={colors.status.success} />
      <Text className="text-center font-display text-2xl text-ink">Payment successful</Text>
      <Text className="text-center font-sans text-sm text-muted">
        Thank you for your support{paymentId ? ` — reference ${paymentId.slice(-6)}` : ""}.
      </Text>
      <PrimaryButton label="Back to home" onPress={() => router.replace("/(tabs)")} className="mt-2" />
    </SafeAreaView>
  );
}
