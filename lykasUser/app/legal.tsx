// app/legal.tsx — Privacy Policy / User Agreement viewer (public route).
// TODO: replace the placeholder text below with your final legal copy.
import { View, Text, ScrollView, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import colors from "../utils/colors";

const DOCS = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["What we collect", "Your name, email, phone, address, and the documents you upload (such as a government ID, proof of address and proof of income) when you apply to adopt, foster or volunteer."],
      ["How we use it", "To create your account, review adoption/foster/volunteer applications, verify your identity, communicate with you, and keep the animals in our care safe."],
      [
        "Government ID and identity verification",
        "To protect the animals in our care, shelter staff check one government-issued photo ID per person. This is done once and used for both adoption and foster applications. Your ID image is stored privately: it has no public link, and only shelter administrators who review IDs can open it (every time one is opened, it is logged). It is a staff visual review of the image you upload. It is not checked against any government database, and we do not use face recognition or any other biometric matching. We do not copy ID numbers into our records. We keep a record of each decision (the result, the ID type, the expiry date, who reviewed it, when, and the reason if it was not accepted). We delete the ID image itself 30 days after an ID is verified, and 14 days after an ID is rejected, replaced, expired or withdrawn. You can withdraw a pending upload yourself at any time, which deletes the image immediately. If you replace an ID, the earlier decision record is kept, not erased.",
      ],
      ["Sharing and storage", "Your data is visible only to authorized shelter staff and is not sold. We keep it only as long as needed for these purposes or as required by law. ID images follow the retention periods above."],
      ["Your rights", "You may request access, correction or deletion of your personal data by contacting support from the Help screen (Data Privacy Act of 2012, RA 10173)."],
    ],
  },
  terms: {
    title: "User Agreement",
    sections: [
      ["Using CarePaws", "You must be of legal age and provide accurate information. You are responsible for keeping your login credentials secure."],
      ["Applications", "Submitting an application does not guarantee approval. The shelter may approve, decline or request more information at its discretion."],
      ["Acceptable use", "Do not submit false documents, misuse the chat or reports, or harm other users or animals. Accounts that violate these terms may be suspended."],
      ["Changes", "We may update this agreement and will notify you of material changes."],
    ],
  },
} as const;

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const content = doc === "terms" ? DOCS.terms : DOCS.privacy;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text className="font-display text-xl text-ink">{content.title}</Text>
      </View>
      <ScrollView contentContainerClassName="gap-5 px-6 pb-10">
        {content.sections.map(([heading, body]) => (
          <View key={heading} className="gap-1.5">
            <Text className="font-sans-medium text-base text-ink">{heading}</Text>
            <Text className="font-sans text-sm leading-5 text-muted">{body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
