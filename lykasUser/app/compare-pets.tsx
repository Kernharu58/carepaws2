import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import StateView from "../components/StateView";
import colors from "../utils/colors";

interface PetDetail {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  gender?: string;
  size?: string;
  temperament?: string;
  energyLevel?: string;
  imageUrl?: string | null;
}

const ROWS: { label: string; key: keyof PetDetail }[] = [
  { label: "Species", key: "species" },
  { label: "Breed", key: "breed" },
  { label: "Age", key: "age" },
  { label: "Gender", key: "gender" },
  { label: "Size", key: "size" },
  { label: "Temperament", key: "temperament" },
  { label: "Energy level", key: "energyLevel" },
];

export default function ComparePetsScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const [pets, setPets] = useState<PetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ids) return;
    setLoading(true);
    setError(null);
    try {
      const petIds = ids.split(",");
      const results = await Promise.all(petIds.map((id) => api.get(`/api/pets/${id}`)));
      setPets(results.map((r) => r.data.data));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load pets to compare"));
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateView state="loading" />;
  if (error) return <StateView state="error" message={error} onRetry={load} />;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-display text-xl text-ink">Compare pets</Text>
      </View>

      <ScrollView horizontal contentContainerClassName="px-5 pb-8">
        {pets.map((pet) => (
          <Pressable key={pet._id} onPress={() => router.push(`/pets/${pet._id}`)} className="mr-3 w-40 rounded-2xl border border-border bg-white p-3">
            <View className="mb-2 h-28 items-center justify-center overflow-hidden rounded-xl bg-cardBg">
              {pet.imageUrl ? (
                <Image source={{ uri: pet.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Ionicons name="paw" size={28} color={colors.sand} />
              )}
            </View>
            <Text className="mb-2 font-display text-sm text-ink" numberOfLines={1}>
              {pet.name}
            </Text>
            {ROWS.map((row) => (
              <View key={row.label} className="mb-1.5 border-t border-border/60 pt-1.5">
                <Text className="font-sans text-[10px] uppercase tracking-wide text-mutedLight">{row.label}</Text>
                <Text className="font-sans text-xs text-ink">{String(pet[row.key] ?? "—")}</Text>
              </View>
            ))}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
