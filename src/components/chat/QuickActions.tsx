"use client";

type QuickAction = { label: string; message: string };

const GENERAL_ACTIONS: QuickAction[] = [
  { label: "What did I scan?", message: "What products did I scan recently?" },
  { label: "How do I report a product?", message: "How do I report a product to FSSAI?" },
  { label: "Compare product", message: "Compare this product with another" },
];

const PRODUCT_ACTIONS: QuickAction[] = [
  { label: "Why this concern?", message: "Why does this product have this concern level?" },
  { label: "Explain ingredients", message: "Explain the ingredients in this product" },
  { label: "Generate Report", message: "Generate a report for this product" },
  { label: "How do I report this?", message: "How do I report this product to FSSAI?" },
];

type QuickActionsProps = {
  disabled: boolean;
  hasProduct: boolean;
  onPick: (message: string) => void;
};

export function QuickActions({ disabled, hasProduct, onPick }: QuickActionsProps) {
  const actions = hasProduct ? PRODUCT_ACTIONS : GENERAL_ACTIONS;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 pt-1" aria-label="Quick questions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(action.message)}
          className="shrink-0 rounded-full border border-primary/20 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-light hover:text-primary-dark disabled:opacity-40"
          data-testid={`quick-action-${action.label}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}