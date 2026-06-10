'use client';

export function ColorSwatch({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={`relative icon-button secondary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] cursor-pointer overflow-hidden p-0${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
    >
      <span
        className="pointer-events-none absolute inset-[3px] rounded-[1px]"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
