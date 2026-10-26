import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-forest-900">{label}</p>
      <div className="flex rounded-full bg-cream-100 p-1" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                "h-11 flex-1 rounded-full px-3 text-sm font-medium transition-colors",
                selected ? "bg-forest-900 text-cream-50" : "text-charcoal-500 hover:text-forest-900",
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
