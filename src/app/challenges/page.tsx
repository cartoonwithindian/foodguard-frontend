import { AuthGuard } from "@/components/AuthGuard";
import { ChallengesScreen } from "@/components/challenges/ChallengesScreen";

export default function ChallengesRoute() {
  return (
    <AuthGuard>
      <ChallengesScreen />
    </AuthGuard>
  );
}
