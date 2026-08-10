import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

/** Three-dot "someone is typing" indicator for the chat screen. */
export default function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-row items-center gap-1 self-start rounded-2xl bg-cardBg px-4 py-3" accessibilityLabel="Typing">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          className="h-2 w-2 rounded-full bg-mutedLight"
          style={{ opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }}
        />
      ))}
    </View>
  );
}
