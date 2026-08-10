import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import { formatDate } from "../../utils/format";
import StateView from "../../components/StateView";
import colors from "../../utils/colors";

interface MedicalSummary {
  vaccinations: { _id: string; vaccineName: string; dateGiven: string; nextDueDate?: string }[];
  vetVisits: { _id: string; visitDate: string; reason: string; clinic?: string }[];
  records: { _id: string; type: string; date: string; description?: string }[];
}

export default function HealthTimelineScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [summary, setSummary] = useState<MedicalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/medical/summary/${petId}`);
      setSummary(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load health records"));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateView state="loading" />;
  if (error || !summary) return <StateView state="error" message={error ?? "No data"} onRetry={load} />;

  const hasAny = summary.vaccinations.length + summary.vetVisits.length + summary.records.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="font-display text-xl text-ink">Health timeline</Text>
        </View>
        <Pressable onPress={() => router.push(`/baby-book/${petId}`)} accessibilityRole="button">
          <Text className="font-sans-medium text-sm text-primary">Baby book</Text>
        </Pressable>
      </View>

      {!hasAny ? (
        <StateView state="empty" title="No medical records yet" />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-8">
          {summary.vaccinations.length > 0 && (
            <View className="mb-5">
              <Text className="mb-2 font-sans-medium text-sm text-ink">Vaccinations</Text>
              {summary.vaccinations.map((v) => (
                <View key={v._id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                  <Ionicons name="medkit-outline" size={16} color={colors.primary} />
                  <View className="flex-1">
                    <Text className="font-sans-medium text-xs text-ink">{v.vaccineName}</Text>
                    <Text className="font-sans text-xs text-muted">
                      Given {formatDate(v.dateGiven)}
                      {v.nextDueDate ? ` · Next due ${formatDate(v.nextDueDate)}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {summary.vetVisits.length > 0 && (
            <View className="mb-5">
              <Text className="mb-2 font-sans-medium text-sm text-ink">Vet visits</Text>
              {summary.vetVisits.map((v) => (
                <View key={v._id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                  <Ionicons name="fitness-outline" size={16} color={colors.primary} />
                  <View className="flex-1">
                    <Text className="font-sans-medium text-xs text-ink">{v.reason}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {formatDate(v.visitDate)}
                      {v.clinic ? ` · ${v.clinic}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {summary.records.length > 0 && (
            <View className="mb-5">
              <Text className="mb-2 font-sans-medium text-sm text-ink">Other records</Text>
              {summary.records.map((r) => (
                <View key={r._id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                  <View className="flex-1">
                    <Text className="font-sans-medium text-xs text-ink">{r.type}</Text>
                    <Text className="font-sans text-xs text-muted">{formatDate(r.date)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
