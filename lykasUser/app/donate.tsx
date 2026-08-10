import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const PRESET_AMOUNTS = [100, 250, 500, 1000]; // PHP

export default function DonateScreen() {
  const [amount, setAmount] = useState<number | null>(250);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveAmount = customAmount ? Number(customAmount) : amount;

  async function handleDonate() {
    if (!effectiveAmount || effectiveAmount <= 0) {
      setError("Enter a valid donation amount.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/api/payments/create-checkout", {
        type: "donation",
        amount: Math.round(effectiveAmount * 100), // PHP -> centavos
        description: "CarePaws donation",
      });
      const checkoutUrl = res.data.data.paymongoCheckoutUrl;
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      } else {
        Alert.alert("Checkout unavailable", "Please try again shortly.");
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to start checkout"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="font-display text-xl text-ink">Make a donation</Text>
        </View>

        <Text className="mb-4 font-sans text-sm text-muted">
          Every peso helps cover food, medical care, and shelter for animals waiting for a home.
        </Text>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <View className="mb-4 flex-row flex-wrap gap-2">
          {PRESET_AMOUNTS.map((amt) => (
            <Pressable
              key={amt}
              onPress={() => {
                setAmount(amt);
                setCustomAmount("");
              }}
              className={`rounded-xl border px-5 py-3 ${amount === amt && !customAmount ? "border-primary bg-primary" : "border-border bg-white"}`}
            >
              <Text className={`font-sans-bold text-sm ${amount === amt && !customAmount ? "text-white" : "text-ink"}`}>₱{amt}</Text>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Or enter a custom amount (PHP)"
          value={customAmount}
          onChangeText={(v) => {
            setCustomAmount(v);
            setAmount(null);
          }}
          keyboardType="decimal-pad"
        />

        <PrimaryButton label={`Donate via GCash or card`} onPress={handleDonate} loading={submitting} className="mt-2" />

        <Pressable onPress={() => router.push("/donate-goods")} className="mt-4 items-center" accessibilityRole="button">
          <Text className="font-sans-medium text-sm text-primary">Prefer to donate goods instead?</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
