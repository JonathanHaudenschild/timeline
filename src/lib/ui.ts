export const uiSurface =
  "rounded-[3px] border border-[rgba(36,34,29,0.22)] bg-[var(--panel)] shadow-[0_10px_28px_rgba(36,34,29,0.08),0_1px_0_rgba(36,34,29,0.16)]";

export const uiSectionShell =
  `${uiSurface} min-w-0 max-w-full overflow-x-clip p-3.5 max-sm:overflow-visible max-sm:p-2.5`;

export const uiSectionHeader =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-sm:gap-2 max-[420px]:grid-cols-1 max-[420px]:items-start";

export const uiSectionTitle =
  "m-0 truncate text-lg font-black leading-none text-[var(--text)] uppercase max-sm:text-base";

export const uiChip =
  "inline-flex min-h-[30px] min-w-[30px] items-center justify-center whitespace-nowrap rounded-[2px] border border-[rgba(36,34,29,0.18)] bg-[#fffef8] px-2 text-center text-[12px] leading-none font-black text-[var(--muted)] shadow-none max-sm:min-h-7 max-sm:px-1.5 max-sm:text-xs";

export const uiControl =
  "h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-full min-w-0 rounded-[2px] border border-[rgba(36,34,29,0.22)] bg-[#fffef8] px-2 py-0 text-xs font-extrabold text-[var(--text)] shadow-none outline-none placeholder:text-[rgba(103,95,82,0.72)] focus:border-[var(--text)] focus:bg-[#fffef8] focus:outline-2 focus:outline-[rgba(221,248,90,0.48)]";

export const uiIconButton =
  "icon-button inline-grid place-items-center rounded-[2px] border border-[rgba(36,34,29,0.28)] p-0 leading-none shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)]";

export const uiCard =
  "rounded-[2px] border border-[rgba(36,34,29,0.18)] bg-[#fffdf8] shadow-[0_1px_0_rgba(36,34,29,0.14),0_6px_14px_rgba(36,34,29,0.06)]";
