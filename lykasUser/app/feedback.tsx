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
  { value: "general", label: "General" },
  { value: "complaint", label: "Complaint" },
  { value: "review", label: "Review" },
  { value: "suggestion", label: "Suggestion" },
] as const;

export default function FeedbackScreen() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("general");
  const [rating, setRating] = useState(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!message) {
      setError("Please share your feedback.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/feedback", { type, rating: rating || undefined, subject, message });
      Alert.alert("Thank you", "Your feedback has been submitted.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit feedback"));
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
          <Text className="font-display text-xl text-ink">Share feedback</Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <View className="mb-4 flex-row flex-wrap gap-2">
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              className={`rounded-full border px-4 py-2 ${type === t.value ? "border-primary bg-primary" : "border-border bg-white"}`}
            >
              <Text className={`font-sans-medium text-sm ${type === t.value ? "text-white" : "text-ink"}`}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {type === "review" && (
          <View className="mb-4 flex-row gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n} stars`}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={28} color={colors.amber} />
              </Pressable>
            ))}
          </View>
        )}

        <FormInput label="Subject" value={subject} onChangeText={setSubject} />
        <FormInput
          label="Your message"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />

        <PrimaryButton label="Submit feedback" onPress={handleSubmit} loading={submitting} className="mt-2" />
      </ScrollView>
    </SafeAreaView>
  );
}
