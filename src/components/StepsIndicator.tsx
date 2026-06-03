interface StepsIndicatorProps {
  currentStep: number; // 1, 2, or 3
}

const steps = [
  { num: 1, label: "Paste or Upload" },
  { num: 2, label: "Generate" },
  { num: 3, label: "Export" },
];

export function StepsIndicator({ currentStep }: StepsIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              currentStep >= step.num
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step.num}
          </div>
          <span
            className={`text-xs font-medium ${
              currentStep >= step.num ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-muted-foreground mx-1">›</span>
          )}
        </div>
      ))}
    </div>
  );
}
