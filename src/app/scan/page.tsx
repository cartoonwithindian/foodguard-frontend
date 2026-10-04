import { AuthGuard } from "@/components/AuthGuard";
import { ScannerPage } from "@/components/scanner/ScannerPage";

type PageProps = {
  searchParams: Promise<{ mode?: string; open?: string; lang?: string }>;
};

export default async function ScanRoute({ searchParams }: PageProps) {
  const { mode, open, lang } = await searchParams;
  // Default to the identify landing showing all options (barcode, search,
  // manual, visual, multi-product scan).
  // Legacy deep link /scan?open=camera&mode=barcode still jumps straight to the scanner.
  // /scan?mode=multi jumps straight to the multi-product scanner.
  const initialScreen =
    mode === "multi"
      ? ("multi_scan" as const)
      : open === "camera" && mode === "barcode"
        ? "barcode"
        : ("identify" as const);
  return (
    <AuthGuard>
      <ScannerPage initialScreen={initialScreen} lang={lang} />
    </AuthGuard>
  );
}
