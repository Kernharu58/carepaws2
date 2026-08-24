import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FormInput from "../../components/FormInput";
import PrimaryButton from "../../components/PrimaryButton";
import StateView from "../../components/StateView";
import { api, getApiErrorMessage } from "../../utils/api";

const OPTIONS = {
  appetite: ["Excellent", "Good", "Fair", "Poor"],
  energy: ["Very Active", "Active", "Low", "Lethargic"],
  overallProgress: ["Excellent", "Good", "Fair", "Needs Attention"],
} as const;

export default function FosterWeeklyReportScreen() {
  const { fosterId, petName } = useLocalSearchParams<{ fosterId: string; petName?: string }>();
  const [weekNumber, setWeekNumber] = useState("");
  const [appetite, setAppetite] = useState<(typeof OPTIONS.appetite)[number]>("Good");
  const [energy, setEnergy] = useState<(typeof OPTIONS.energy)[number]>("Active");
  const [overallProgress, setOverallProgress] = useState<(typeof OPTIONS.overallProgress)[number]>("Good");
  const [weightChange, setWeightChange] = useState("");
  const [behavior, setBehavior] = useState("");
  const [healthConcerns, setHealthConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noReportsRemaining, setNoReportsRemaining] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [fosterRes, reportsRes] = await Promise.all([
          api.get(`/api/foster/${fosterId}`),
          api.get(`/api/foster/${fosterId}/reports`),
        ]);
        const required = fosterRes.data.data.weeklyReportsRequired;
        const submitted = new Set<number>(
          reportsRes.data.data
            .filter((report: { status?: string }) => report.status === "submitted")
            .map((report: { weekNumber: number }) => report.weekNumber)
        );
        const firstMissing = Array.from({ length: required }, (_, index) => index + 1).find((week) => !submitted.has(week));
        if (firstMissing) setWeekNumber(String(firstMissing));
        else setNoReportsRemaining(true);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load the foster report schedule"));
      } finally {
        setLoading(false);
      }
    }
    if (fosterId) load();
  }, [fosterId]);

  async function submit() {
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1) {
      setError("Enter a valid report week.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/foster/${fosterId}/reports`, {
        weekNumber: week,
        weightChange: weightChange ? Number(weightChange) : undefined,
        appetite,
        energy,
        behavior: behavior || undefined,
        healthConcerns: healthConcerns || undefined,
        overallProgress,
        notes: notes || undefined,
      });
      Alert.alert("Report submitted", "Your weekly foster report was saved.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit weekly foster report"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <StateView state="loading" />;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 font-display text-xl text-ink">Weekly foster report</Text>
        <Text className="mb-5 font-sans text-sm text-muted">{petName ? `${petName} · ` : ""}Record this week&apos;s progress.</Text>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <FormInput
          label="Week number"
          value={weekNumber}
          onChangeText={setWeekNumber}
          keyboardType="number-pad"
          editable={!noReportsRemaining}
        />
        <FormInput label="Weight change (kg)" value={weightChange} onChangeText={setWeightChange} keyboardType="decimal-pad" />

        <Text className="mb-2 font-sans-medium text-sm text-ink">Appetite</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {OPTIONS.appetite.map((value) => (
            <Text key={value} onPress={() => setAppetite(value)} className={`rounded-full border px-3 py-2 font-sans-medium text-xs ${appetite === value ? "border-primary bg-primary text-white" : "border-border bg-white text-ink"}`}>
              {value}
            </Text>
          ))}
        </View>

        <Text className="mb-2 font-sans-medium text-sm text-ink">Energy</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {OPTIONS.energy.map((value) => (
            <Text key={value} onPress={() => setEnergy(value)} className={`rounded-full border px-3 py-2 font-sans-medium text-xs ${energy === value ? "border-primary bg-primary text-white" : "border-border bg-white text-ink"}`}>
              {value}
            </Text>
          ))}
        </View>

        <Text className="mb-2 font-sans-medium text-sm text-ink">Overall progress</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {OPTIONS.overallProgress.map((value) => (
            <Text key={value} onPress={() => setOverallProgress(value)} className={`rounded-full border px-3 py-2 font-sans-medium text-xs ${overallProgress === value ? "border-primary bg-primary text-white" : "border-border bg-white text-ink"}`}>
              {value}
            </Text>
          ))}
        </View>

        <FormInput label="Behavior" value={behavior} onChangeText={setBehavior} multiline numberOfLines={3} />
        <FormInput label="Health concerns" value={healthConcerns} onChangeText={setHealthConcerns} multiline numberOfLines={3} />
        <FormInput label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        <PrimaryButton
          label="Submit weekly report"
          onPress={submit}
          loading={submitting}
          disabled={noReportsRemaining}
          className="mt-2"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
