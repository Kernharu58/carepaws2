import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Image } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, getApiErrorMessage } from "../utils/api";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import StateView from "../components/StateView";
import StatusBadge from "../components/StatusBadge";
import colors from "../utils/colors";

const TYPES = [
  { value: "stray_animal", label: "Stray animal" },
  { value: "injured_animal", label: "Injured animal" },
  { value: "abuse_report", label: "Abuse report" },
  { value: "abandoned_animal", label: "Abandoned animal" },
] as const;

type PhotoAsset = ImagePicker.ImagePickerAsset;
interface EmergencyReport { _id: string; type: string; description: string; location?: string; photos?: string[]; priority: string; status: string; resolutionNote?: string; createdAt: string; }

export default function EmergencyReportScreen() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("stray_animal");
  const [animalType, setAnimalType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const res = await api.get("/api/emergency-reports/my");
      setReports(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load your reports"));
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach emergency photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (!result.canceled) setPhotos(result.assets.slice(0, 5));
  }

  async function handleSubmit() {
    if (!description.trim()) { setError("Please describe what you're seeing."); return; }
    setError(null); setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      if (animalType) formData.append("animalType", animalType);
      formData.append("description", description.trim());
      if (location) formData.append("location", location);
      if (contactName) formData.append("contactName", contactName);
      if (contactPhone) formData.append("contactPhone", contactPhone);
      photos.forEach((photo, index) => formData.append("photos", { uri: photo.uri, name: photo.fileName ?? `emergency-${index + 1}.jpg`, type: photo.mimeType ?? "image/jpeg" } as unknown as Blob));
      await api.post("/api/emergency-reports", formData);
      setDescription(""); setLocation(""); setAnimalType(""); setContactName(""); setContactPhone(""); setPhotos([]);
      await loadReports();
      Alert.alert("Report submitted", "Thank you — our team will follow up as soon as possible.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit report"));
    } finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center gap-2"><Pressable onPress={() => router.back()} className="p-1"><Ionicons name="chevron-back" size={22} color={colors.ink} /></Pressable><Text className="font-display text-xl text-ink">Report an emergency</Text></View>
        <View className="mb-4 rounded-xl border border-status-warning/30 bg-status-warningBg px-4 py-3"><Text className="font-sans text-xs text-status-warning">For animals in immediate danger, also contact local animal control or emergency services.</Text></View>
        {error && <View className="mb-4 rounded-xl border border-status-danger/20 bg-status-dangerBg px-4 py-3"><Text className="font-sans text-sm text-status-danger">{error}</Text></View>}
        <Text className="mb-2 font-sans-medium text-sm text-ink">Type of report</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">{TYPES.map((t) => <Pressable key={t.value} onPress={() => setType(t.value)} className={`rounded-full border px-3 py-1.5 ${type === t.value ? "border-primary bg-primary" : "border-border bg-white"}`}><Text className={`font-sans-medium text-xs ${type === t.value ? "text-white" : "text-ink"}`}>{t.label}</Text></Pressable>)}</View>
        <FormInput label="Animal type (if known)" value={animalType} onChangeText={setAnimalType} placeholder="e.g. Dog, Cat" />
        <FormInput label="What's happening?" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: "top" }} />
        <FormInput label="Location" value={location} onChangeText={setLocation} placeholder="Street, landmark, or area" />
        <FormInput label="Your name (optional)" value={contactName} onChangeText={setContactName} />
        <FormInput label="Your phone (optional)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        <Pressable onPress={pickPhotos} className="mb-3 flex-row items-center gap-2 rounded-xl border border-border bg-white px-4 py-3"><Ionicons name="camera-outline" size={20} color={colors.primary} /><Text className="font-sans-medium text-sm text-ink">Attach photos ({photos.length}/5)</Text></Pressable>
        {photos.length > 0 && <ScrollView horizontal className="mb-3">{photos.map((p) => <Image key={p.assetId ?? p.uri} source={{ uri: p.uri }} className="mr-2 h-20 w-20 rounded-xl" />)}</ScrollView>}
        <PrimaryButton label="Submit report" onPress={handleSubmit} loading={submitting} className="mt-2" />

        <Text className="mb-3 mt-8 font-display text-lg text-ink">Your emergency reports</Text>
        {loadingReports ? <StateView state="loading" /> : reports.length === 0 ? <StateView state="empty" title="No reports yet" message="Submitted reports and their current status will appear here." /> : reports.map((report) => (
          <View key={report._id} className="mb-3 rounded-2xl border border-border bg-white p-4">
            <View className="mb-2 flex-row items-center justify-between"><Text className="font-sans-medium text-sm text-ink">{report.type.replace(/_/g, " ")}</Text><StatusBadge status={report.status} /></View>
            <Text className="font-sans text-sm text-slate">{report.description}</Text>
            {!!report.location && <Text className="mt-1 font-sans text-xs text-muted">{report.location}</Text>}
            <View className="mt-2 flex-row items-center justify-between"><StatusBadge status={report.priority} /><Text className="font-sans text-xs text-mutedLight">{new Date(report.createdAt).toLocaleString()}</Text></View>
            {!!report.resolutionNote && <Text className="mt-2 rounded-lg bg-gray-50 p-2 font-sans text-xs text-slate">Resolution: {report.resolutionNote}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
