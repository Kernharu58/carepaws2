import { Pressable, View, Text } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import colors from "../utils/colors";
import StatusBadge from "./StatusBadge";

export interface PetSummary {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  status: string;
  imageUrl?: string | null;
}

export default function PetCard({ pet, onPress, favorite }: { pet: PetSummary; onPress: () => void; favorite?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full overflow-hidden rounded-2xl border border-border bg-white"
      accessibilityRole="button"
      accessibilityLabel={`${pet.name}, ${pet.species}${pet.breed ? `, ${pet.breed}` : ""}, ${pet.status}`}
    >
      <View className="h-40 items-center justify-center bg-cardBg">
        {pet.imageUrl ? (
          <Image source={{ uri: pet.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <Ionicons name="paw" size={36} color={colors.sand} />
        )}
        {favorite !== undefined && (
          <View className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5">
            <Ionicons name={favorite ? "heart" : "heart-outline"} size={14} color={favorite ? colors.accentOrange : colors.mutedLight} />
          </View>
        )}
      </View>
      <View className="gap-1 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-base text-ink" numberOfLines={1}>
            {pet.name}
          </Text>
          <StatusBadge status={pet.status} />
        </View>
        <Text className="font-sans text-sm text-muted">
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""}
          {pet.age ? ` · ${pet.age}y` : ""}
        </Text>
      </View>
    </Pressable>
  );
}
