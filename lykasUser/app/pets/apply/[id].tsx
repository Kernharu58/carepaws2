import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../../utils/api";
import { isEmailNotVerifiedError } from "../../../utils/emailVerification";
import FormInput from "../../../components/FormInput";
import PrimaryButton from "../../../components/PrimaryButton";
import colors from "../../../utils/colors";

// Matches the shelter's foster trial rules (30-60 days), so what the applicant
// offers is something staff can actually schedule.
const FOSTER_DAY_OPTIONS = [30, 45, 60] as const;

export default function ApplyToPetScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id: string; type?: string }>();
  // Never trust the raw param: anything other than "foster" is an adoption.
  const type = typeParam === "foster" ? "foster" : "adoption";
  const isFoster = type === "foster";
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [experience, setExperience] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [isRenting, setIsRenting] = useState(false);
  const [landlordApproval, setLandlordApproval] = useState(false);
  const [fosterDays, setFosterDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!phone || !address) {
      setError("Phone and address are required.");
      return;
    }
    if (isFoster && !fosterDays) {
      setError("Please tell us how long you can foster.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/applications", {
        pet: id,
        phone,
        address,
        experience,
        householdSize: householdSize ? Number(householdSize) : undefined,
        isRenting,
        landlordApproval,
        type,
        ...(isFoster && fosterDays ? { fosterDays, fosterPeriod: `${fosterDays} days` } : {}),
      });
      Alert.alert("Application submitted", `We'll be in touch about your ${type} application.`, [
        { text: "OK", onPress: () => router.replace("/(tabs)/my-applications") },
      ]);
    } catch (err) {
      // EMAIL_NOT_VERIFIED is shown as a prompt by the API client; skip the raw banner.
      if (!isEmailNotVerifiedError(err)) setError(getApiErrorMessage(err, "Failed to submit your application"));
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
          <Text className="font-display text-xl text-ink">{isFoster ? "Foster application" : "Adoption application"}</Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <FormInput label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="apply-phone" />
        <FormInput label="Home address" value={address} onChangeText={setAddress} testID="apply-address" />
        {isFoster && (
          <View className="mb-4 gap-1.5" testID="apply-foster-period">
            <Text className="font-sans-medium text-sm text-ink">How long can you foster?</Text>
            <View className="flex-row gap-2">
              {FOSTER_DAY_OPTIONS.map((days) => {
                const selected = fosterDays === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => setFosterDays(days)}
                    testID={`apply-foster-${days}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${days} days`}
                    accessibilityState={{ selected }}
                    className={`flex-1 items-center rounded-xl border py-3 ${selected ? "border-primary bg-primary" : "border-border bg-white"}`}
                  >
                    <Text className={`font-sans-bold text-base ${selected ? "text-white" : "text-ink"}`}>{days}</Text>
                    <Text className={`font-sans text-xs ${selected ? "text-white" : "text-muted"}`}>days</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="font-sans text-xs text-muted">Foster trials run 30 to 60 days. The shelter confirms the final dates with you.</Text>
          </View>
        )}
        <FormInput label="Household size" value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" testID="apply-household" />
        <FormInput
          label={isFoster ? "Experience caring for pets (foster)" : "Pet ownership / handling experience"}
          value={experience}
          onChangeText={setExperience}
          multiline
          numberOfLines={4}
          style={{ minHeight: 96, textAlignVertical: "top" }}
          testID="apply-experience"
        />

        <View className="mb-4 flex-row items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
          <Text className="font-sans text-sm text-ink">I am renting my home</Text>
          <Switch
            value={isRenting}
            onValueChange={setIsRenting}
            trackColor={{ true: colors.primary, false: colors.border }}
            testID="apply-renting-switch"
          />
        </View>

        {isRenting && (
          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
            <Text className="flex-1 pr-2 font-sans text-sm text-ink">My landlord has approved pet ownership</Text>
            <Switch value={landlordApproval} onValueChange={setLandlordApproval} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        )}

        <PrimaryButton label={isFoster ? "Submit foster application" : "Submit application"} onPress={handleSubmit} loading={submitting} className="mt-2" testID="apply-submit" />
      </ScrollView>
    </SafeAreaView>
  );
}
