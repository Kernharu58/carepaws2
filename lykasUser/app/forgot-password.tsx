import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import PrimaryButton from "../components/PrimaryButton";
import FormInput from "../components/FormInput";
import colors from "../utils/colors";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6" keyboardShouldPersistTaps="handled">
        {sent ? (
          <View className="items-center gap-3">
            <Ionicons name="checkmark-circle" size={40} color={colors.status.success} />
            <Text className="text-center font-display text-xl text-ink">Check your email</Text>
            <Text className="text-center font-sans text-sm text-muted">
              If that email is registered, a reset link is on its way.
            </Text>
            <PrimaryButton label="Back to sign in" variant="outline" onPress={() => router.replace("/(auth)/logIn")} className="mt-4" />
          </View>
        ) : (
          <>
            <Text className="mb-2 font-display text-xl text-ink">Reset your password</Text>
            <Text className="mb-6 font-sans text-sm text-muted">We&apos;ll email you a link to reset it.</Text>
            {error && (
              <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
                <Text className="font-sans text-sm text-status-danger">{error}</Text>
              </View>
            )}
            <FormInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <PrimaryButton label="Send reset link" onPress={handleSubmit} loading={loading} className="mt-2" />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
