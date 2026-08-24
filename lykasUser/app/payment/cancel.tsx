import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../../components/PrimaryButton";
import StateView from "../../components/StateView";
import StatusBadge from "../../components/StatusBadge";
import { api, getApiErrorMessage } from "../../utils/api";
import colors from "../../utils/colors";

export default function PaymentCancelScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paymentId) return;
    try {
      const res = await api.get(`/api/payments/my/${paymentId}`);
      setStatus(res.data.data.status);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to check payment status"));
    }
  }, [paymentId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!paymentId) return;
      try {
        const res = await api.post(`/api/payments/${paymentId}/cancel`);
        if (mounted) setStatus(res.data.data.status);
      } catch {
        // The redirect is not a cancellation confirmation. Fall back to the
        // authoritative backend status and let PayMongo webhooks resolve it.
        if (mounted) await load();
      }
    })();
    return () => { mounted = false; };
  }, [load, paymentId]);

  if (error) return <SafeAreaView className="flex-1 bg-cream"><StateView state="error" message={error} onRetry={load} /></SafeAreaView>;

  const cancelled = status === "cancelled";
  const paid = status === "paid";

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-cream px-8">
      <Ionicons name={paid ? "checkmark-circle" : cancelled ? "close-circle" : "time"} size={56} color={paid ? colors.status.success : cancelled ? colors.status.neutral : colors.primary} />
      <Text className="text-center font-display text-2xl text-ink">{paid ? "Payment successful" : cancelled ? "Payment cancelled" : "Payment pending"}</Text>
      <StatusBadge status={status || "pending"} />
      <Text className="text-center font-sans text-sm text-muted">
        {paid ? "PayMongo confirmed the payment. The redirect result is not used as confirmation." : cancelled ? "The payment is confirmed as cancelled by the backend." : "Leaving the checkout page does not by itself cancel or fail a payment. The backend will update this status from PayMongo."}
      </Text>
      <PrimaryButton label="Back to home" onPress={() => router.replace("/(tabs)")} className="mt-2" />
    </SafeAreaView>
  );
}
