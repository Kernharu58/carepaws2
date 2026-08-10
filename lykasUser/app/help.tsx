import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import StateView from "../components/StateView";
import colors from "../utils/colors";

interface FaqItem {
  _id: string;
  title: string;
  body: string;
}

export default function HelpScreen() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/content/public", { params: { type: "faq" } });
      setFaqs(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load help content"));
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
        <Text className="font-display text-xl text-ink">Help &amp; Support</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8">
        <Pressable
          onPress={() => Linking.openURL("mailto:support@carepaws.example")}
          className="mb-5 flex-row items-center gap-3 rounded-2xl border border-border bg-white p-4"
        >
          <Ionicons name="mail-outline" size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-sans-medium text-sm text-ink">Contact support</Text>
            <Text className="font-sans text-xs text-muted">support@carepaws.example</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>

        <Text className="mb-3 font-sans-medium text-sm text-ink">Frequently asked questions</Text>

        {loading ? (
          <StateView state="loading" />
        ) : error ? (
          <StateView state="error" message={error} onRetry={load} />
        ) : faqs.length === 0 ? (
          <StateView state="empty" title="No FAQs published yet" />
        ) : (
          faqs.map((faq) => (
            <Pressable
              key={faq._id}
              onPress={() => setExpandedId(expandedId === faq._id ? null : faq._id)}
              className="mb-2 rounded-xl border border-border bg-white px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 font-sans-medium text-sm text-ink">{faq.title}</Text>
                <Ionicons name={expandedId === faq._id ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedLight} />
              </View>
              {expandedId === faq._id && <Text className="mt-2 font-sans text-sm text-slate">{faq.body}</Text>}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
