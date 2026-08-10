import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const DROP_OFF_OPTIONS = [
  { value: "walk_in", label: "Walk-in" },
  { value: "schedule", label: "Schedule pickup" },
  { value: "courier", label: "Courier" },
] as const;

export default function DonateGoodsScreen() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [dropOff, setDropOff] = useState<(typeof DROP_OFF_OPTIONS)[number]["value"]>("walk_in");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name) {
      setError("Please describe what you're donating.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/donations/goods", {
        name,
        quantity: quantity ? Number(quantity) : undefined,
        unit,
        dropOff,
        notes,
      });
      Alert.alert("Thank you!", "The shelter will follow up on your donation.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit your donation"));
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
          <Text className="font-display text-xl text-ink">Donate goods</Text>
        </View>

        <Text className="mb-4 font-sans text-sm text-muted">
          Dog and cat food, bedding, cleaning supplies, and more make a real difference.
        </Text>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <FormInput label="What are you donating?" value={name} onChangeText={setName} placeholder="e.g. Dog food, blankets" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <FormInput label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. kg, bags" />
          </View>
        </View>

        <Text className="mb-2 font-sans-medium text-sm text-ink">How will you get it to us?</Text>
        <View className="mb-4 gap-2">
          {DROP_OFF_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setDropOff(opt.value)}
              className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 ${dropOff === opt.value ? "border-primary bg-mintBg" : "border-border bg-white"}`}
            >
              <Ionicons
                name={dropOff === opt.value ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={dropOff === opt.value ? colors.primary : colors.mutedLight}
              />
              <Text className="font-sans text-sm text-ink">{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <FormInput label="Notes (optional)" value={notes} onChangeText={setNotes} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: "top" }} />

        <PrimaryButton label="Submit donation" onPress={handleSubmit} loading={submitting} className="mt-2" />
      </ScrollView>
    </SafeAreaView>
  );
}
