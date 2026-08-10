import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getApiErrorMessage } from "../utils/api";
import PrimaryButton from "../components/PrimaryButton";
import FormInput from "../components/FormInput";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — request a new one.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      router.replace("/(auth)/logIn");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 font-display text-xl text-ink">Choose a new password</Text>
        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}
        <FormInput label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <FormInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <PrimaryButton label="Reset password" onPress={handleSubmit} loading={loading} className="mt-2" />
      </ScrollView>
    </SafeAreaView>
  );
}
