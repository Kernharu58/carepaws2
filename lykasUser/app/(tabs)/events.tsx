import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import { formatDate } from "../../utils/format";
import StateView from "../../components/StateView";
import StatusBadge from "../../components/StatusBadge";
import colors from "../../utils/colors";

interface EventItem {
  _id: string;
  title: string;
  category: string;
  date: string;
  location?: string;
  status: string;
  currentAttendees: number;
  maxAttendees?: number;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/events", { params: { status: "upcoming" } });
      setEvents(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pb-3 pt-2">
        <Text className="font-display text-xl text-ink">Community events</Text>
      </View>

      {loading ? (
        <StateView state="loading" />
      ) : error ? (
        <StateView state="error" message={error} onRetry={load} />
      ) : events.length === 0 ? (
        <StateView state="empty" title="No upcoming events" message="Check back soon for adoption drives and fundraisers." />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e._id}
          contentContainerClassName="px-5 pb-8 gap-3"
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-border bg-white p-4">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="flex-1 font-sans-medium text-base text-ink" numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusBadge status={item.category} tone="neutral" />
              </View>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                <Text className="font-sans text-xs text-muted">{formatDate(item.date)}</Text>
              </View>
              {item.location && (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text className="font-sans text-xs text-muted">{item.location}</Text>
                </View>
              )}
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="font-sans text-xs text-mutedLight">
                  {item.currentAttendees}{item.maxAttendees ? `/${item.maxAttendees}` : ""} attending
                </Text>
                <StatusBadge status={item.status} />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
