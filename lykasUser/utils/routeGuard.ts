/**
 * Routes reachable without a signed-in user. Everything else — every
 * top-level screen (my-pets, payments, donate, foster-dashboard,
 * documents, notifications, application-details/[id], baby-book/[petId],
 * ...) plus the whole (tabs) group — requires one, because every
 * "my"/user-scoped endpoint those screens call is itself `protect`ed
 * server-side (confirmed against the route files: there is no anonymous
 * path anywhere in this app once you're past these). "onboarding" is
 * static marketing content with no API calls, so there's no harm in it
 * being reachable pre-auth too.
 */
export const PUBLIC_ROUTES = new Set(["onboarding", "forgot-password", "reset-password", "verify-email", "help", "+not-found"]);

/**
 * Pure decision function for the root navigation guard: given the current
 * auth state and route segments, where (if anywhere) should we redirect?
 * Returns null when the current screen is already the right place to be.
 *
 * Kept side-effect-free and independent of expo-router/React so the
 * decision itself can be unit tested directly (see
 * __tests__/route-guard.test.ts) instead of only through a rendered
 * component tree — this is the logic that closes the "deep link to a
 * protected screen while logged out" gap, so it's worth exercising on its
 * own rather than trusting it by inspection alone.
 */
export function getRedirectTarget(params: {
  isAuthenticated: boolean;
  loading: boolean;
  segments: readonly string[];
}): string | null {
  const { isAuthenticated, loading, segments } = params;
  if (loading || segments.length === 0) return null;

  const inAuthGroup = segments[0] === "(auth)";
  const isPublicRoute = inAuthGroup || PUBLIC_ROUTES.has(segments[0]);

  if (!isAuthenticated && !isPublicRoute) return "/(auth)/logIn";
  if (isAuthenticated && inAuthGroup) return "/(tabs)";
  return null;
}
