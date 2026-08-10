import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../utils/api";
import { formatDate } from "../../utils/format";
import StateView from "../../components/StateView";
import PrimaryButton from "../../components/PrimaryButton";
import FormInput from "../../components/FormInput";
import colors from "../../utils/colors";

interface BabyBookEntry {
  _id: string;
  title: string;
  content?: string;
  category: string;
  date: string;
}

const CATEGORIES = ["Milestone", "Health", "Funny Moment", "Training", "First Time", "General"];

export default function BabyBookScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [entries, setEntries] = useState<BabyBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/baby-book/${petId}`);
      setEntries(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load the baby book"));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!title) return;
    setSaving(true);
    try {
      await api.post("/api/baby-book", { pet: petId, title, content, category });
      setAdding(false);
      setTitle("");
      setContent("");
      setCategory("General");
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save entry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="font-display text-xl text-ink">Baby book</Text>
        </View>
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add entry">
          <Ionicons name="add-circle" size={26} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <StateView state="loading" />
      ) : error ? (
        <StateView state="error" message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <StateView state="empty" title="No entries yet" message="Add your first milestone or funny moment." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e._id}
          contentContainerClassName="px-5 pb-8 gap-3"
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-border bg-white p-4">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="font-sans-medium text-base text-ink" numberOfLines={1}>
                  {item.title}
                </Text>
                <View className="rounded-full bg-blush px-2.5 py-0.5">
                  <Text className="font-sans text-xs text-accentOrange">{item.category}</Text>
                </View>
              </View>
              <Text className="mb-1 font-sans text-xs text-muted">{formatDate(item.date)}</Text>
              {item.content && <Text className="font-sans text-sm text-slate">{item.content}</Text>}
            </View>
          )}
        />
      )}

      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-cream p-5">
            <Text className="mb-4 font-display text-lg text-ink">New baby book entry</Text>
            <FormInput label="Title" value={title} onChangeText={setTitle} />
            <FormInput
              label="Details"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
            <View className="mb-4 flex-row flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 ${category === c ? "border-primary bg-primary" : "border-border bg-white"}`}
                >
                  <Text className={`font-sans text-xs ${category === c ? "text-white" : "text-ink"}`}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-3">
              <PrimaryButton label="Cancel" variant="outline" onPress={() => setAdding(false)} className="flex-1" />
              <PrimaryButton label="Save" onPress={handleAdd} loading={saving} className="flex-1" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
