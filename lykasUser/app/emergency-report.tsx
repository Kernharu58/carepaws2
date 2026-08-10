import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const TYPES = [
  { value: "stray_animal", label: "Stray animal" },
  { value: "injured_animal", label: "Injured animal" },
  { value: "abuse_report", label: "Abuse report" },
  { value: "abandoned_animal", label: "Abandoned animal" },
  { value: "other", label: "Other" },
] as const;

export default function EmergencyReportScreen() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("stray_animal");
  const [animalType, setAnimalType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!description) {
      setError("Please describe what you're seeing.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/emergency-reports", { type, animalType, description, location, contactName, contactPhone });
      Alert.alert("Report submitted", "Thank you — our team will follow up as soon as possible.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit report"));
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
          <Text className="font-display text-xl text-ink">Report an emergency</Text>
        </View>

        <View className="mb-4 rounded-xl border border-status-warning/30 bg-status-warningBg px-4 py-3">
          <Text className="font-sans text-xs text-status-warning">
            For animals in immediate danger, also contact local animal control or emergency services.
          </Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <Text className="mb-2 font-sans-medium text-sm text-ink">Type of report</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              className={`rounded-full border px-3 py-1.5 ${type === t.value ? "border-primary bg-primary" : "border-border bg-white"}`}
            >
              <Text className={`font-sans-medium text-xs ${type === t.value ? "text-white" : "text-ink"}`}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <FormInput label="Animal type (if known)" value={animalType} onChangeText={setAnimalType} placeholder="e.g. Dog, Cat" />
        <FormInput
          label="What's happening?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />
        <FormInput label="Location" value={location} onChangeText={setLocation} placeholder="Street, landmark, or area" />
        <FormInput label="Your name (optional)" value={contactName} onChangeText={setContactName} />
        <FormInput label="Your phone (optional)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

        <PrimaryButton label="Submit report" onPress={handleSubmit} loading={submitting} className="mt-2" />
      </ScrollView>
    </SafeAreaView>
  );
}
