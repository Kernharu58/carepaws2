import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    api
      .post("/api/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(getApiErrorMessage(err, "Verification failed"));
      });
  }, [token]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-cream px-8">
      {status === "verifying" && <Text className="font-sans text-muted">Verifying your email…</Text>}
      {status === "success" && (
        <>
          <Ionicons name="checkmark-circle" size={40} color={colors.status.success} />
          <Text className="text-center font-display text-xl text-ink">Email verified</Text>
          <PrimaryButton label="Continue" onPress={() => router.replace("/(tabs)")} />
        </>
      )}
      {status === "error" && (
        <>
          <Ionicons name="close-circle" size={40} color={colors.status.danger} />
          <Text className="text-center font-sans text-sm text-ink">{message}</Text>
        </>
      )}
    </SafeAreaView>
  );
}
