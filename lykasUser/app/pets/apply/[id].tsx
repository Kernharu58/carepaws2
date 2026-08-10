import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../../utils/api";
import FormInput from "../../../components/FormInput";
import PrimaryButton from "../../../components/PrimaryButton";
import colors from "../../../utils/colors";

export default function ApplyToPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [experience, setExperience] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [isRenting, setIsRenting] = useState(false);
  const [landlordApproval, setLandlordApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!phone || !address) {
      setError("Phone and address are required.");
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
        type: "adoption",
      });
      Alert.alert("Application submitted", "We'll be in touch about next steps.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/my-applications") },
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit your application"));
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
          <Text className="font-display text-xl text-ink">Adoption application</Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3">
            <Text className="font-sans text-sm text-status-danger">{error}</Text>
          </View>
        )}

        <FormInput label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="apply-phone" />
        <FormInput label="Home address" value={address} onChangeText={setAddress} testID="apply-address" />
        <FormInput label="Household size" value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" testID="apply-household" />
        <FormInput
          label="Pet ownership / handling experience"
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

        <PrimaryButton label="Submit application" onPress={handleSubmit} loading={submitting} className="mt-2" testID="apply-submit" />
      </ScrollView>
    </SafeAreaView>
  );
}
