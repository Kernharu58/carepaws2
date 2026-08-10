import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import { type PetSummary } from "../components/PetCard";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"] as const;

export default function MonitoringReportScreen() {
  const [pets, setPets] = useState<PetSummary[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState("");
  const [diet, setDiet] = useState("");
  const [exerciseRoutine, setExerciseRoutine] = useState("");
  const [overallCondition, setOverallCondition] = useState<(typeof CONDITIONS)[number]>("Good");
  const [behaviorAtHome, setBehaviorAtHome] = useState("");
  const [issuesOrConcerns, setIssuesOrConcerns] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPets = useCallback(async () => {
    try {
      const res = await api.get("/api/pets/my-pets");
      setPets(res.data.data);
      if (res.data.data.length > 0) setSelectedPetId(res.data.data[0]._id);
    } catch {
      // Non-fatal — the picker will just be empty and the form unusable,
      // which the empty-pets check below surfaces clearly.
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  async function handleSubmit() {
    if (!selectedPetId) {
      setError("Select a pet first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/monitoring-reports", {
        pet: selectedPetId,
        currentWeight: currentWeight ? Number(currentWeight) : undefined,
        diet,
        exerciseRoutine,
        overallCondition,
        behaviorAtHome,
        issuesOrConcerns,
      });
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

        {pets.length === 0 ? (
          <Text className="font-sans text-sm text-muted">You don't have any adopted pets to report on yet.</Text>
        ) : (
          <>
            <Text className="mb-2 font-sans-medium text-sm text-ink">Which pet?</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {pets.map((p) => (
                <Pressable
                  key={p._id}
                  onPress={() => setSelectedPetId(p._id)}
                  className={`rounded-full border px-4 py-2 ${selectedPetId === p._id ? "border-primary bg-primary" : "border-border bg-white"}`}
                >
                  <Text className={`font-sans-medium text-sm ${selectedPetId === p._id ? "text-white" : "text-ink"}`}>{p.name}</Text>
                </Pressable>
              ))}
            </View>

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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
