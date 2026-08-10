import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const AVAILABILITY_OPTIONS = ["Weekday mornings", "Weekday afternoons", "Weekends", "Flexible"];

export default function VolunteerPortalScreen() {
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [motivation, setMotivation] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleAvailability(opt: string) {
    setAvailability((prev) => (prev.includes(opt) ? prev.filter((a) => a !== opt) : [...prev, opt]));
  }

  async function handleSubmit() {
    if (!phone || !address) {
      setError("Phone and address are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/volunteers/register", { phone, address, motivation, availability });
      Alert.alert("Application submitted", "We'll review your application and get back to you.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit your application"));
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
          <Text className="font-display text-xl text-ink">Become a volunteer</Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <FormInput label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <FormInput label="Address" value={address} onChangeText={setAddress} />
        <FormInput
          label="Why do you want to volunteer?"
          value={motivation}
          onChangeText={setMotivation}
          multiline
          numberOfLines={4}
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />

        <Text className="mb-2 font-sans-medium text-sm text-ink">When are you available?</Text>
        <View className="mb-4 gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => toggleAvailability(opt)}
              className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 ${availability.includes(opt) ? "border-primary bg-mintBg" : "border-border bg-white"}`}
            >
              <Ionicons
                name={availability.includes(opt) ? "checkbox" : "square-outline"}
                size={18}
                color={availability.includes(opt) ? colors.primary : colors.mutedLight}
              />
              <Text className="font-sans text-sm text-ink">{opt}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="Submit application" onPress={handleSubmit} loading={submitting} className="mt-2" />
      </ScrollView>
    </SafeAreaView>
  );
}
