import { AuthGuard } from "@/components/AuthGuard";
import { ProductAnalysisPage } from "@/components/analysis/ProductAnalysisPage";

type PageProps = {
  searchParams: Promise<{
    barcode?: string;
    ingredients?: string;
    imageUrl?: string;
    productName?: string;
    brand?: string;
    ocrText?: string;
    ocrConfidence?: string;
    scan_event_id?: string;
    lang?: string;
  }>;
};

export default async function AnalysisRoute({ searchParams }: PageProps) {
  const {
    barcode,
    ingredients,
    imageUrl,
    productName,
    brand,
    ocrText,
    ocrConfidence,
    scan_event_id,
    lang,
  } = await searchParams;

  const confidence =
    typeof ocrConfidence === "string" && ocrConfidence.trim() !== ""
      ? Number(ocrConfidence)
      : null;

  return (
    <AuthGuard>
      <ProductAnalysisPage
        barcode={barcode ?? ""}
        ingredients={ingredients ?? ""}
        imageUrl={imageUrl ?? ""}
        productName={productName ?? ""}
        brand={brand ?? ""}
        ocrText={ocrText ?? ""}
        ocrConfidence={Number.isFinite(confidence) ? confidence : null}
        scanEventId={scan_event_id}
        lang={lang}
      />
    </AuthGuard>
  );
}
