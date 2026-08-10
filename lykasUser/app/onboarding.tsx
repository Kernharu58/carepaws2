import { useRef, useState } from "react";
import { View, Text, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../utils/colors";

const { width } = Dimensions.get("window");

const SLIDES = [
  { icon: "paw" as const, title: "Welcome to CarePaws", body: "Find your new best friend from shelters and fosters near you." },
  { icon: "heart" as const, title: "Adopt, foster, or volunteer", body: "Every path helps a pet — browse pets, apply to foster, or give your time." },
  { icon: "chatbubbles" as const, title: "We're with you the whole way", body: "Chat with shelter staff, track your application, and follow your pet's journey home." },
];

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIndex !== index) setIndex(newIndex);
  }

  function next() {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width }} className="flex-1 items-center justify-center gap-4 px-10">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-mintBg">
              <Ionicons name={slide.icon} size={36} color={colors.primary} />
            </View>
            <Text className="text-center font-display text-2xl text-ink">{slide.title}</Text>
            <Text className="text-center font-sans text-base text-muted">{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-2 pb-4">
        {SLIDES.map((slide, i) => (
          <View key={slide.title} className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : "w-2 bg-border"}`} />
        ))}
      </View>

      <View className="gap-3 px-6 pb-8">
        <PrimaryButton label={index === SLIDES.length - 1 ? "Get started" : "Next"} onPress={next} />
        {index < SLIDES.length - 1 && (
          <PrimaryButton label="Skip" variant="outline" onPress={() => router.replace("/(tabs)")} />
        )}
      </View>
    </SafeAreaView>
  );
}
