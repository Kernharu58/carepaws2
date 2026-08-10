import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import AppointmentCard, { type AppointmentSummary } from "../../components/AppointmentCard";
import StateView from "../../components/StateView";
import colors from "../../utils/colors";

export default function AppointmentsListScreen() {
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/appointments");
      setAppointments(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load appointments"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-display text-xl text-ink">Available appointments</Text>
      </View>

      {loading ? (
        <StateView state="loading" />
      ) : error ? (
        <StateView state="error" message={error} onRetry={load} />
      ) : appointments.length === 0 ? (
        <StateView state="empty" title="No open appointments" message="Check back soon for new shift and visit slots." />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a._id}
          contentContainerClassName="px-5 pb-8 gap-3"
          renderItem={({ item }) => (
            <AppointmentCard appointment={item} onPress={() => router.push(`/appointments/apply/${item._id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
