import { ShieldCheck } from "lucide-react";

type TrustFooterProps = {
  message: string;
};

export function TrustFooter({ message }: TrustFooterProps) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/15 bg-primary-light/45 p-4 text-center">
      <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-primary-dark">{message}</p>
    </div>
  );
}
