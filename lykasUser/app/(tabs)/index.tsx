import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, FlatList } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import PetCard, { type PetSummary } from "../../components/PetCard";
import StateView from "../../components/StateView";
import colors from "../../utils/colors";

interface Announcement {
  _id: string;
  title: string;
  message: string;
  level: "info" | "warning" | "critical";
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [pets, setPets] = useState<PetSummary[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [petsRes, announcementsRes] = await Promise.all([
        api.get("/api/pets", { params: { limit: 6, status: "Available" } }),
        api.get("/api/announcements/active"),
      ]);
      setPets(petsRes.data.data);
      setAnnouncements(announcementsRes.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load your feed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateView state="loading" />;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="font-sans text-sm text-muted">Welcome back,</Text>
            <Text className="font-display text-xl text-ink">{user?.displayName?.split(" ")[0]}</Text>
          </View>
          <Ionicons name="paw" size={28} color={colors.primary} />
        </View>

        {error && <StateView state="error" message={error} onRetry={load} />}

        {announcements.map((a) => (
          <View
            key={a._id}
            className={`mb-3 rounded-2xl border px-4 py-3 ${
              a.level === "critical" ? "border-status-danger/20 bg-status-dangerBg" : a.level === "warning" ? "border-status-warning/20 bg-status-warningBg" : "border-border bg-white"
            }`}
          >
            <Text className="font-sans-medium text-sm text-ink">{a.title}</Text>
            <Text className="mt-0.5 font-sans text-xs text-muted">{a.message}</Text>
          </View>
        ))}

        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <Text className="font-display text-lg text-ink">Pets looking for a home</Text>
          <Text onPress={() => router.push("/(tabs)/adopt")} className="font-sans-medium text-sm text-primary">
            See all
          </Text>
        </View>

        {pets.length === 0 ? (
          <StateView state="empty" title="No pets available right now" message="Check back soon — new pets are added regularly." />
        ) : (
          <FlatList
            horizontal
            data={pets}
            keyExtractor={(p) => p._id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: 160, marginRight: 12 }}>
                <PetCard pet={item} onPress={() => router.push(`/pets/${item._id}`)} />
              </View>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
