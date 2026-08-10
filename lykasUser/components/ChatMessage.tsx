import { View, Text } from "react-native";
import { Image } from "expo-image";

export interface ChatMessageData {
  _id: string;
  sender: "user" | "admin" | "shelter";
  text?: string;
  image?: string;
  createdAt: string;
}

/** A single chat bubble — right-aligned/primary for the current user's own messages. */
export default function ChatMessage({ message, isOwn }: { message: ChatMessageData; isOwn: boolean }) {
  return (
    <View className={`mb-2 max-w-[80%] ${isOwn ? "self-end" : "self-start"}`}>
      <View className={`rounded-2xl px-4 py-2.5 ${isOwn ? "bg-primary" : "bg-cardBg"}`}>
        {message.image && (
          <Image source={{ uri: message.image }} style={{ width: 200, height: 150, borderRadius: 12, marginBottom: message.text ? 6 : 0 }} contentFit="cover" />
        )}
        {message.text && <Text className={`font-sans text-sm ${isOwn ? "text-white" : "text-ink"}`}>{message.text}</Text>}
      </View>
    </View>
  );
}
