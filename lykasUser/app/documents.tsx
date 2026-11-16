import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeReload, useSilentFlag } from "../context/RealtimeContext";
import { View, Text, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import StateView from "../components/StateView";
import StatusBadge from "../components/StatusBadge";
import IdentityStatusCard from "../components/IdentityStatusCard";
import colors from "../utils/colors";
import {
  classifyUploadError,
  fetchIdentity,
  parseExpiryInput,
  uploadIdentityDocument,
  withdrawIdentityDocument,
  type IdentityOverview,
  type PickedFile,
} from "../utils/identity";

interface UserDocument {
  _id: string;
  type: string;
  label?: string;
  status: string;
  rejectedReason?: string;
  createdAt: string;
}

// Application documents only. Government IDs have their own verification flow above.
const DOC_TYPES = [
  { value: "proof_of_address", label: "Proof of address" },
  { value: "proof_of_income", label: "Proof of income" },
  { value: "house_photo", label: "House photo" },
  { value: "pet_owner_agreement", label: "Pet owner agreement" },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function DocumentsScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();
  const { refreshUser } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [identity, setIdentity] = useState<IdentityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Identity upload form
  const [showForm, setShowForm] = useState(false);
  const [idType, setIdType] = useState<string>("");
  const [expiryText, setExpiryText] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Synchronous guard: two quick taps must never send two uploads.
  const submittingRef = useRef(false);
  const lastStatus = useRef<string | null>(null);

  const live = useSilentFlag();

  const load = useCallback(async () => {
    const silent = live.take();
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [docsRes, overview] = await Promise.all([api.get("/api/documents/my"), fetchIdentity()]);
      setDocuments((docsRes.data.data as UserDocument[]).filter((d) => d.type !== "government_id"));
      setIdentity(overview);
      // A decision arrived (live update or pull): refresh the account so Profile matches.
      if (lastStatus.current && lastStatus.current !== overview.status) void refreshUser();
      lastStatus.current = overview.status;
    } catch (err) {
      if (!silent) setError(getApiErrorMessage(err, "Failed to load your documents"));
    } finally {
      setLoading(false);
    }
  }, [live, refreshUser]);

  useRealtimeReload(["UserDocument", "User"], load, live);

  useEffect(() => {
    load();
  }, [load]);

  const selectedType = identity?.idTypes.find((t) => t.value === idType);

  function openForm() {
    setNotice(null);
    setFormError(null);
    setFile(null);
    setExpiryText("");
    setIdType(identity?.idTypes[0]?.value ?? "");
    setShowForm(true);
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
    setFormError(null);
  }

  async function submitIdentity() {
    if (submittingRef.current) return;
    setFormError(null);
    if (!idType || !file) {
      setFormError("Choose the ID type and a photo or PDF of your ID.");
      return;
    }
    const expiry = parseExpiryInput(expiryText);
    if (!expiry.ok) {
      setFormError(expiry.message);
      return;
    }
    if (selectedType?.expiryRequired && !expiry.value) {
      setFormError("This ID type has an expiry date. Enter it exactly as printed on your ID.");
      return;
    }

    submittingRef.current = true;
    setProgress(0);
    try {
      await uploadIdentityDocument({ file, idType, expiresAt: expiry.value, onProgress: setProgress });
      setShowForm(false);
      setFile(null);
      setNotice("Your ID was uploaded. Staff will review it and you will be notified.");
      await load();
      void refreshUser();
    } catch (err) {
      const failure = classifyUploadError(err);
      setFormError(failure.message);
      // A lost connection or an "already pending" answer can mean the upload actually landed: ask the server.
      if (failure.kind === "network" || failure.kind === "duplicate_pending" || failure.kind === "already_verified") {
        const before = identity?.status;
        await load();
        const fresh = await fetchIdentity().catch(() => null);
        if (fresh && fresh.status === "pending" && before !== "pending") {
          setShowForm(false);
          setFormError(null);
          setNotice("Your ID was received. Staff will review it and you will be notified.");
        } else if (fresh && failure.kind !== "network") {
          setShowForm(false);
        }
      }
    } finally {
      submittingRef.current = false;
      setProgress(null);
    }
  }

  function confirmWithdraw() {
    const id = identity?.pendingDocument?._id;
    if (!id) return;
    Alert.alert("Withdraw this upload?", "Staff will no longer review it, and the image will be deleted. You can upload again at any time.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          try {
            await withdrawIdentityDocument(id);
            setNotice("Your upload was withdrawn.");
            await load();
            void refreshUser();
          } catch (err) {
            Alert.alert("Could not withdraw", getApiErrorMessage(err));
          }
        },
      },
    ]);
  }

  async function uploadDocument(type: string) {
    const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append("type", type);
      if (applicationId) formData.append("application", applicationId);
      formData.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      } as unknown as Blob);

      // Don't set Content-Type manually: axios/React Native computes the multipart boundary.
      await api.post("/api/documents", formData);
      load();
    } catch (err) {
      Alert.alert("Upload failed", getApiErrorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  const uploadingIdentity = progress !== null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="p-1">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-display text-xl text-ink">Documents</Text>
      </View>

      {loading ? (
        <StateView state="loading" />
      ) : error || !identity ? (
        <StateView state="error" message={error ?? "Failed to load your documents"} onRetry={load} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-5">
          {notice && (
            <Text testID="identity-notice" className="rounded-xl bg-mintBg px-4 py-3 font-sans text-sm text-ink">
              {notice}
            </Text>
          )}

          <IdentityStatusCard overview={identity} onUpload={openForm} onWithdraw={confirmWithdraw} busy={uploadingIdentity} />

          {showForm && (
            <View testID="identity-form" className="rounded-2xl border border-border bg-white p-4">
              <Text className="mb-2 font-sans-medium text-sm text-ink">Type of ID</Text>
              <View className="flex-row flex-wrap gap-2">
                {identity.idTypes.map((t) => (
                  <Pressable
                    key={t.value}
                    testID={`id-type-${t.value}`}
                    onPress={() => setIdType(t.value)}
                    disabled={uploadingIdentity}
                    accessibilityRole="button"
                    accessibilityState={{ selected: idType === t.value }}
                    className={`rounded-full border px-3 py-2 ${idType === t.value ? "border-primary bg-mintBg" : "border-border bg-white"}`}
                  >
                    <Text className="font-sans text-xs text-ink">{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text className="mb-1 mt-4 font-sans-medium text-sm text-ink">Expiry date{selectedType?.expiryRequired ? "" : " (if your ID has one)"}</Text>
              <TextInput
                testID="identity-expiry-input"
                value={expiryText}
                onChangeText={setExpiryText}
                editable={!uploadingIdentity}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                className="rounded-xl border border-border px-3 py-2.5 font-sans text-sm text-ink"
              />

              <Pressable
                testID="identity-choose-file"
                onPress={chooseFile}
                disabled={uploadingIdentity}
                accessibilityRole="button"
                className="mt-4 flex-row items-center gap-2 rounded-xl border border-border px-3 py-3"
              >
                <Ionicons name="image-outline" size={16} color={colors.primary} />
                <Text className="flex-1 font-sans text-sm text-ink" numberOfLines={1}>
                  {file ? file.name : "Choose a clear photo or PDF of your ID"}
                </Text>
              </Pressable>

              {uploadingIdentity && (
                <View className="mt-4" testID="identity-progress">
                  <View className="h-2 overflow-hidden rounded-full bg-border">
                    <View style={{ width: `${progress}%`, backgroundColor: colors.primary }} className="h-2" />
                  </View>
                  <Text className="mt-1 font-sans text-xs text-muted">Uploading… {progress}%</Text>
                </View>
              )}

              {formError && (
                <Text testID="identity-form-error" accessibilityRole="alert" className="mt-3 font-sans text-xs text-status-danger">
                  {formError}
                </Text>
              )}

              <View className="mt-4 flex-row gap-3">
                <Pressable
                  testID="identity-cancel"
                  onPress={() => setShowForm(false)}
                  disabled={uploadingIdentity}
                  accessibilityRole="button"
                  className="flex-1 items-center rounded-xl border border-border py-3"
                  style={{ opacity: uploadingIdentity ? 0.5 : 1 }}
                >
                  <Text className="font-sans-medium text-sm text-ink">Cancel</Text>
                </Pressable>
                <Pressable
                  testID="identity-submit"
                  onPress={submitIdentity}
                  disabled={uploadingIdentity}
                  accessibilityRole="button"
                  className="flex-1 items-center rounded-xl bg-primary py-3"
                  style={{ opacity: uploadingIdentity ? 0.6 : 1 }}
                >
                  <Text className="font-sans-medium text-sm text-white">{uploadingIdentity ? "Uploading…" : "Submit for review"}</Text>
                </Pressable>
              </View>
              <Text className="mt-3 font-sans text-xs text-muted">
                Your ID is stored privately and only authorised shelter staff can view it. The image is deleted after a short retention period; a record of the decision is kept.
              </Text>
            </View>
          )}

          <View>
            <Text className="mb-1 font-display text-base text-ink">Application documents</Text>
            <Text className="mb-3 font-sans text-xs text-muted">Supporting documents for an adoption or foster application. These are reviewed per application and are separate from identity verification.</Text>
            <View className="flex-row flex-wrap gap-2">
              {DOC_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => uploadDocument(t.value)}
                  disabled={uploading === t.value}
                  className="flex-row items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2"
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
                  <Text className="font-sans text-xs text-ink">{uploading === t.value ? "Uploading…" : t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {documents.length === 0 ? (
            <Text className="font-sans text-sm text-muted">No application documents uploaded yet.</Text>
          ) : (
            <View className="gap-2">
              {documents.map((item) => (
                <View key={item._id} className="rounded-xl border border-border bg-white px-4 py-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-sans text-sm text-ink">{DOC_TYPES.find((t) => t.value === item.type)?.label ?? item.type}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  {item.status === "rejected" && item.rejectedReason && <Text className="mt-1.5 font-sans text-xs text-status-danger">{item.rejectedReason}</Text>}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
