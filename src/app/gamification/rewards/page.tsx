import { AuthGuard } from "@/components/AuthGuard";
import { RewardsScreen } from "@/components/gamification";

export default function GamificationRewardsRoute() {
  return (
    <AuthGuard>
      <RewardsScreen />
    </AuthGuard>
  );
}
