"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiIconButton } from "@/lib/ui";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "danger";
  size?: "sm" | "md";
};

export function IconButton({
  children,
  tone = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const toneClass =
    tone === "danger"
      ? "danger"
      : tone === "secondary"
        ? "secondary"
        : tone === "tertiary"
          ? "tertiary"
        : "";
  const sizeClass =
    size === "sm"
      ? "h-8 min-h-8 w-8 min-w-8"
      : "h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)]";

  return (
    <button
      {...props}
      type={type}
      className={cn(
        uiIconButton,
        sizeClass,
        toneClass,
        className,
      )}
    >
      {children}
    </button>
  );
}
