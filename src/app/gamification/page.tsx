import { AuthGuard } from "@/components/AuthGuard";
import { GamificationScreen } from "@/components/gamification";

export default function GamificationRoute() {
  return (
    <AuthGuard>
      <GamificationScreen />
    </AuthGuard>
  );
}
