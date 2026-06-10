"use client";

import type {
  ChangeEventHandler,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { uiControl } from "@/lib/ui";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
  hideLabel?: boolean;
  children: ReactNode;
};

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  hideLabel?: boolean;
};

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  textareaClassName?: string;
  hideLabel?: boolean;
};

type InlineTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

type InlineTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

type InlineSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

const fieldShellClass =
  "group grid min-w-0";
const stackedFieldShellClass =
  "group grid min-w-0 gap-1";
const stackedLabelClass =
  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none font-black text-[var(--muted)] uppercase";
const controlClass = uiControl;

export function SearchInput({
  label = "Search",
  value,
  onValueChange,
  className = "",
  ...props
}: SearchInputProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <label className={cn(fieldShellClass, "w-full max-w-[380px]", className)}>
      <span className="sr-only">{label}</span>
      <span className="relative block h-[var(--icon-button-size)] min-w-0">
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          {...props}
          className={`${controlClass} !pl-8 !pr-2`}
          value={value}
          onChange={handleChange}
        />
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onValueChange,
  className = "",
  inputClassName = "",
  hideLabel = false,
  ...props
}: TextFieldProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <label className={cn(stackedFieldShellClass, className)}>
      <span className={hideLabel ? "sr-only" : stackedLabelClass}>{label}</span>
      <input
        {...props}
        className={cn(controlClass, "!px-2", inputClassName)}
        value={value}
        onChange={handleChange}
      />
    </label>
  );
}

export function TextareaField({
  label,
  value,
  onValueChange,
  className = "",
  textareaClassName = "",
  hideLabel = false,
  ...props
}: TextareaFieldProps) {
  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <label className={cn(stackedFieldShellClass, className)}>
      <span className={hideLabel ? "sr-only" : stackedLabelClass}>{label}</span>
      <textarea
        {...props}
        className={cn(
          controlClass,
          "min-h-[104px] resize-y py-2 leading-snug",
          textareaClassName,
        )}
        value={value}
        onChange={handleChange}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  className = "",
  selectClassName = "",
  hideLabel = false,
  children,
  ...props
}: SelectFieldProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onValueChange(event.target.value);
  };

  if (hideLabel) {
    return (
      <label className={cn(fieldShellClass, "w-full max-w-[220px] ", className)}>
        <span className="sr-only">{label}</span>
        <span className="relative block h-[var(--icon-button-size)] min-w-0">
          <select
            {...props}
            className={cn(controlClass, "cursor-pointer appearance-none !pr-10 !pl-2", selectClassName)}
            value={value}
            onChange={handleChange}
          >
            {children}
          </select>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
        </span>
      </label>
    );
  }

  return (
    <label className={cn(fieldShellClass, "w-full max-w-[220px] items-end", className)}>
      <span className="flex h-[var(--icon-button-size)] min-w-0 overflow-hidden rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none focus-within:border-[var(--text)] focus-within:outline-2 focus-within:outline-[color-mix(in_srgb,var(--primary)_48%,transparent)]">
        <span className="inline-flex w-[72px] max-w-[36%] flex-none items-center border-r border-[color-mix(in_srgb,var(--line)_16%,transparent)] bg-[var(--surface)] px-2 text-[10px] leading-none font-black text-[var(--muted)] uppercase max-sm:w-[58px] max-sm:max-w-[32%] max-sm:px-1.5 max-sm:text-[9px]">
          <span className="min-w-0 truncate">{label}</span>
        </span>
        <span className="relative min-w-0 flex-1">
          <select
            {...props}
            className={cn(
              "h-full min-h-0 w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent py-0 pr-9 pl-2 text-xs font-extrabold text-[var(--text)] shadow-none outline-none",
              selectClassName,
            )}
            value={value}
            onChange={handleChange}
          >
            {children}
          </select>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
        </span>
      </span>
    </label>
  );
}

export function InlineTextInput({
  value,
  onValueChange,
  className = "",
  ...props
}: InlineTextInputProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <input
      {...props}
      className={cn(controlClass, "h-8 min-h-8 px-1.5 text-[11px]", className)}
      value={value}
      onChange={handleChange}
    />
  );
}

export function InlineTextarea({
  value,
  onValueChange,
  className = "",
  ...props
}: InlineTextareaProps) {
  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <textarea
      {...props}
      className={cn(controlClass, "min-h-8 resize-y px-1.5 py-1 text-[11px] leading-snug", className)}
      value={value}
      onChange={handleChange}
    />
  );
}

export function InlineSelect({
  value,
  onValueChange,
  className = "",
  children,
  ...props
}: InlineSelectProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onValueChange(event.target.value);
  };

  return (
    <span className="relative block h-8 min-w-0">
      <select
        {...props}
        className={cn(controlClass, "h-8 min-h-8 cursor-pointer appearance-none !pr-7 !pl-1.5 text-[11px]", className)}
        value={value}
        onChange={handleChange}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </span>
  );
}
