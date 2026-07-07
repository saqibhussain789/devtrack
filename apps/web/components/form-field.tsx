export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-stone-600 dark:text-stone-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      />
    </div>
  );
}
