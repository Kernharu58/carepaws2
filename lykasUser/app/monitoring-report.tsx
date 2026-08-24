import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"] as const;

interface MonitoringReport {
  _id: string;
  pet: { _id: string; name: string };
  application: { _id: string };
  monitoringPeriod: number;
  scheduledDate: string;
  dueDate: string;
  reportMonth: string;
  status: "scheduled" | "pending" | "reviewed" | "flagged";
  submittedAt?: string | null;
}

export default function MonitoringReportScreen() {
  const [reports, setReports] = useState<MonitoringReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState("");
  const [diet, setDiet] = useState("");
  const [exerciseRoutine, setExerciseRoutine] = useState("");
  const [overallCondition, setOverallCondition] = useState<(typeof CONDITIONS)[number]>("Good");
  const [behaviorAtHome, setBehaviorAtHome] = useState("");
  const [issuesOrConcerns, setIssuesOrConcerns] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMonitoring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/monitoring-reports/my");
      const data: MonitoringReport[] = res.data.data ?? [];
      setReports(data);
      const next = res.data.next ?? data.find((report) => ["pending", "scheduled"].includes(report.status));
      setSelectedReportId(next?._id ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load your monitoring schedule"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  const selectedReport = reports.find((report) => report._id === selectedReportId) ?? null;
  const dueReports = reports.filter((report) => report.status === "pending");

  async function handleSubmit() {
    if (!selectedReport) {
      setError("There is no monitoring report due for submission yet.");
      return;
    }
    if (selectedReport.status !== "pending") {
      setError("This monitoring period is not due yet.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/monitoring-reports", {
        application: selectedReport.application._id,
        pet: selectedReport.pet._id,
        monitoringPeriod: selectedReport.monitoringPeriod,
        currentWeight: currentWeight ? Number(currentWeight) : undefined,
        diet,
        exerciseRoutine,
        overallCondition,
        behaviorAtHome,
        issuesOrConcerns,
      });
      await loadMonitoring();
      Alert.alert("Report submitted", "Thanks for keeping us updated!", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit report"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="font-display text-xl text-ink">Post-adoption check-in</Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        {loading ? (
          <Text className="font-sans text-sm text-muted">Loading your monitoring schedule…</Text>
        ) : reports.length === 0 ? (
          <Text className="font-sans text-sm text-muted">You don&apos;t have a post-adoption monitoring schedule yet.</Text>
        ) : (
          <>
            <Text className="mb-2 font-sans-medium text-sm text-ink">Monitoring period</Text>
            <View className="mb-4 gap-2">
              {reports.map((report) => {
                const selectable = report.status === "pending";
                return (
                  <Pressable
                    key={report._id}
                    disabled={!selectable}
                    onPress={() => setSelectedReportId(report._id)}
                    className={`rounded-xl border px-4 py-3 ${
                      selectedReportId === report._id ? "border-primary bg-primary" : "border-border bg-white"
                    } ${!selectable ? "opacity-60" : ""}`}
                  >
                    <Text className={`font-sans-medium text-sm ${selectedReportId === report._id ? "text-white" : "text-ink"}`}>
                      {report.pet.name} · Check-in {report.monitoringPeriod}
                    </Text>
                    <Text className={`font-sans text-xs ${selectedReportId === report._id ? "text-white" : "text-muted"}`}>
                      {report.status === "scheduled"
                        ? `Scheduled ${new Date(report.scheduledDate).toLocaleDateString()}`
                        : report.status === "pending"
                          ? `Due ${new Date(report.dueDate).toLocaleDateString()}`
                          : report.status === "reviewed"
                            ? "Completed"
                            : "Submitted and flagged for follow-up"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {dueReports.length === 0 ? (
              <Text className="font-sans text-sm text-muted">
                Your next check-in is not due yet. You can return here when the scheduled date arrives.
              </Text>
            ) : selectedReport ? (
              <>
                <FormInput label="Current weight (kg)" value={currentWeight} onChangeText={setCurrentWeight} keyboardType="decimal-pad" />
                <FormInput label="Diet" value={diet} onChangeText={setDiet} />
                <FormInput label="Exercise routine" value={exerciseRoutine} onChangeText={setExerciseRoutine} />

                <Text className="mb-2 font-sans-medium text-sm text-ink">Overall condition</Text>
                <View className="mb-4 flex-row gap-2">
                  {CONDITIONS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setOverallCondition(c)}
                      className={`flex-1 items-center rounded-xl border py-2.5 ${overallCondition === c ? "border-primary bg-primary" : "border-border bg-white"}`}
                    >
                      <Text className={`font-sans-medium text-xs ${overallCondition === c ? "text-white" : "text-ink"}`}>{c}</Text>
                    </Pressable>
                  ))}
                </View>

                <FormInput
                  label="Behavior at home"
                  value={behaviorAtHome}
                  onChangeText={setBehaviorAtHome}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />
                <FormInput
                  label="Any issues or concerns?"
                  value={issuesOrConcerns}
                  onChangeText={setIssuesOrConcerns}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />

                <PrimaryButton label="Submit check-in" onPress={handleSubmit} loading={submitting} className="mt-2" />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
