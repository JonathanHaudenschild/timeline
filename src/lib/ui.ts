export const uiSurface =
  "rounded-[3px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--panel)] shadow-[var(--shadow)]";

export const uiSectionShell =
  `${uiSurface} min-w-0 max-w-full overflow-x-clip p-3.5 max-sm:overflow-visible max-sm:p-2.5`;

export const uiSectionHeader =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-sm:gap-2 max-[420px]:grid-cols-1 max-[420px]:items-start";

export const uiSectionTitle =
  "m-0 truncate text-lg font-black leading-none text-[var(--text)] uppercase max-sm:text-base";

export const uiChip =
  "inline-flex min-h-[30px] min-w-[30px] items-center justify-center whitespace-nowrap rounded-[2px] border border-[color-mix(in_srgb,var(--line)_18%,transparent)] bg-[var(--input-bg)] px-2 text-center text-[12px] leading-none font-black text-[var(--muted)] shadow-none max-sm:min-h-7 max-sm:px-1.5 max-sm:text-xs";

export const uiControl =
  "h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-full min-w-0 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] px-2 py-0 text-xs font-extrabold text-[var(--text)] shadow-none outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_72%,transparent)] focus:border-[var(--text)] focus:bg-[var(--input-bg)] focus:outline-2 focus:outline-[color-mix(in_srgb,var(--primary)_48%,transparent)]";

export const uiIconButton =
  "icon-button inline-grid place-items-center rounded-[2px] border border-[color-mix(in_srgb,var(--line)_28%,transparent)] p-0 leading-none shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)]";

export const uiCard =
  "rounded-[2px] border border-[color-mix(in_srgb,var(--line)_18%,transparent)] bg-[var(--card-bg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_16%,transparent),0_6px_14px_color-mix(in_srgb,var(--line)_6%,transparent)]";
