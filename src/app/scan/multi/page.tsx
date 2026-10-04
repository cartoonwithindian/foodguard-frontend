import { AuthGuard } from "@/components/AuthGuard";
import { MultiProductScanner } from "@/components/scanner/multi/MultiProductScanner";

export default function MultiScanRoute() {
  return (
    <AuthGuard>
      <MultiProductScanner />
    </AuthGuard>
  );
}
