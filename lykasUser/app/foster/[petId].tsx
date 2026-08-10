import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import { formatDate } from "../../utils/format";
import StateView from "../../components/StateView";
import StatusBadge from "../../components/StatusBadge";
import colors from "../../utils/colors";

interface WeeklyReport {
  _id: string;
  weekNumber: number;
  reportDate: string;
  overallProgress: string;
  reviewedBy?: string;
}

interface FosterDetail {
  _id: string;
  pet: { name: string; species: string };
  status: string;
  weeklyReportsSubmitted: number;
  weeklyReportsRequired: number;
}

export default function FosterDetailScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [foster, setFoster] = useState<FosterDetail | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fostersRes = await api.get("/api/foster/my");
      const match = fostersRes.data.data.find((f: FosterDetail & { pet: { _id: string } }) => f.pet._id === petId);
      if (!match) throw new Error("Foster placement not found");
      setFoster(match);
      const reportsRes = await api.get(`/api/foster/${match._id}/reports`);
      setReports(reportsRes.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load foster details"));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateView state="loading" />;
  if (error || !foster) return <StateView state="error" message={error ?? "Not found"} onRetry={load} />;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-display text-xl text-ink">{foster.pet.name}'s foster progress</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8">
        <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-border bg-white p-4">
          <Text className="font-sans-medium text-sm text-ink">Status</Text>
          <StatusBadge status={foster.status} />
        </View>

        <View className="mb-6 flex-row items-center justify-between">
          <Text className="font-sans-medium text-sm text-ink">Weekly reports</Text>
          <Pressable onPress={() => router.push("/monitoring-report")} accessibilityRole="button">
            <Text className="font-sans-medium text-sm text-primary">Submit new</Text>
          </Pressable>
        </View>

        {reports.length === 0 ? (
          <StateView state="empty" title="No reports submitted yet" />
        ) : (
          reports.map((r) => (
            <View key={r._id} className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
              <View>
                <Text className="font-sans-medium text-sm text-ink">Week {r.weekNumber}</Text>
                <Text className="font-sans text-xs text-muted">{formatDate(r.reportDate)}</Text>
              </View>
              <StatusBadge status={r.overallProgress} tone={r.overallProgress === "Needs Attention" ? "danger" : "success"} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
