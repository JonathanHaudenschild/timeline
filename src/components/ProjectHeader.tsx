"use client";

import Image from "next/image";
import {
  FilePlus2,
  FileUp,
  History,
  KeyRound,
  LogOut,
  Pencil,
  Palette,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { TextField } from "./FormControls";
import { cn } from "@/lib/cn";
import { defaultProjectBackgroundColor, normalizeProjectBackgroundColor } from "@/lib/project";
import type { TimelineMode, TimelineProject } from "@/lib/types";

type ProjectHeaderProps = {
  project: TimelineProject;
  saveState: string;
  syncState: string;
  syncLabel: string;
  onChange: (project: TimelineProject) => void;
  onModeChange: (mode: TimelineMode) => void;
  onProjectPinChange: () => void;
  onProjectPinRemove: () => void;
  onEditPinChange: () => void;
  onRestoreRevision: () => void;
  onImport: (file: File) => void;
  onOpenProject: () => void;
  onLockProject: () => void;
};

const headerClass =
  "relative grid grid-cols-[minmax(260px,1fr)_auto] items-end gap-4 rounded-[3px] border border-[rgba(36,34,29,0.22)] bg-[var(--panel)] p-4 shadow-[var(--shadow)] before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:bg-[repeating-linear-gradient(180deg,var(--hot)_0_12px,var(--primary)_12px_24px,var(--cyan)_24px_36px)] before:content-[''] max-[980px]:grid-cols-1 max-sm:gap-3 max-sm:p-3";
const titleInputClass =
  "!h-auto !min-h-0 !border-0 !border-b-2 !border-[var(--line)] !bg-transparent !px-0 !pt-0.5 !pb-1.5 !text-[28px] !font-black uppercase max-sm:!text-xl";
const hashLineClass =
  "flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]";
const headerControlsClass =
  "flex flex-wrap items-end justify-end gap-2.5 max-[980px]:justify-start max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:items-stretch max-[420px]:grid-cols-1";
const statusClusterClass =
  "inline-flex min-w-0 flex-[1_0_100%] items-center justify-end gap-1.5 max-sm:col-span-full max-[420px]:justify-start";
const dateControlClass =
  "grid min-w-[150px] grid-cols-1 items-stretch gap-1 border-0 bg-transparent p-0 shadow-none max-sm:w-full max-sm:min-w-0 [&>span]:block [&>span]:border-0 [&>span]:bg-transparent [&>span]:p-0 [&>span]:text-[10px] [&>span]:font-black [&>span]:leading-none [&>span]:text-[var(--muted)] [&>span]:uppercase";
const dateInputClass =
  "!min-h-[var(--icon-button-size)] !border !border-[rgba(36,34,29,0.22)] !bg-[#fffef8] !px-[7px] !py-1 !text-xs !font-black disabled:!bg-[#f0eee6] disabled:!text-[var(--muted)] disabled:!opacity-100";
const backgroundColorControlClass =
  "grid min-w-[112px] grid-cols-[minmax(0,1fr)_var(--icon-button-size)] items-end gap-1.5 max-sm:w-full max-sm:min-w-0";
const backgroundColorInputClass =
  "!min-h-[var(--icon-button-size)] !h-[var(--icon-button-size)] !border !border-[rgba(36,34,29,0.22)] !bg-[#fffef8] !p-1";
const projectToolButtonClass =
  "icon-button h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0";
const statusChipBaseClass =
  "inline-flex min-h-7 items-center justify-center overflow-hidden whitespace-nowrap rounded-[3px] border border-[rgba(36,34,29,0.22)] bg-[#fffef8] px-[9px] py-[3px] text-center text-xs leading-none font-black text-[var(--text)] uppercase tabular-nums";
const saveStatusBaseClass = `${statusChipBaseClass} w-[72px]`;
const syncStatusBaseClass = `${statusChipBaseClass} w-[138px] max-[420px]:w-[min(138px,calc(100vw_-_132px))]`;
const importingButtonClass =
  "relative inline-flex min-h-[var(--icon-button-size)] cursor-pointer items-center justify-center gap-2 rounded-[2px] border border-[rgba(36,34,29,0.32)] bg-[var(--primary)] px-3 text-[11px] font-black uppercase text-[var(--text)] shadow-none hover:border-[rgba(36,34,29,0.42)] hover:bg-[var(--primary-strong)] focus-within:border-[var(--primary)]";
const iconImportButtonClass =
  `icon-button ${importingButtonClass} h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0`;

function statusToneClass(status: string) {
  if (status === "saving" || status === "loading" || status === "checking") {
    return "border-[#e7d2bc] bg-[#fff8ef] text-[#915930]";
  }
  if (status === "saved" || status === "updated" || status === "idle") {
    return "border-[#c9dfcf] bg-[#f1f8f2] text-[#315c3a]";
  }
  if (status === "error" || status === "offline") {
    return "border-[#f0cbc8] bg-[#fff6f5] text-[var(--danger)]";
  }
  if (status === "conflict" || status === "merged") {
    return "border-[var(--line)] bg-[var(--hot)] text-[var(--text)]";
  }
  return "";
}

export function ProjectHeader({
  project,
  saveState,
  syncState,
  syncLabel,
  onChange,
  onModeChange,
  onProjectPinChange,
  onProjectPinRemove,
  onEditPinChange,
  onRestoreRevision,
  onImport,
  onOpenProject,
  onLockProject,
}: ProjectHeaderProps) {
  const isSyncing = syncState === "checking" || saveState === "saving" || saveState === "loading";
  const projectBackgroundColor = normalizeProjectBackgroundColor(project.settings.backgroundColor);

  function changeBackgroundColor(backgroundColor: string) {
    onChange({
      ...project,
      settings: {
        ...project.settings,
        backgroundColor: normalizeProjectBackgroundColor(backgroundColor),
      },
    });
  }

  return (
    <>
      <div className="relative grid min-h-[74px] overflow-hidden py-1">
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-[29px] h-0.5 w-[120vw] -translate-x-1/2 overflow-hidden bg-[rgba(36,34,29,0.16)]"
        >
          <span
            className={cn(
              "block h-full bg-[var(--hot)] shadow-[0_0_0_1px_var(--primary)]",
              !isSyncing
                ? "w-1/3 animate-[yuzza-timeline_3.8s_linear_infinite]"
                : "w-0",
            )}
          />
        </span>
        <div className="relative z-[1] grid justify-items-center gap-1">
          <Image
            className={cn(
              "block h-12 w-12 bg-[var(--bg)] max-sm:h-10 max-sm:w-10 animate-[yuzza-float_3.6s_ease-in-out_infinite]",
            )}
            src="/icon.svg"
            alt=""
            width={48}
            height={48}
            aria-hidden="true"
            priority
          />
          <span
            className={cn(
              "bg-[var(--bg)] px-1 text-sm font-black uppercase leading-none text-[var(--text)] max-sm:text-xs animate-[yuzza-wordmark_3.6s_ease-in-out_infinite]",
            )}
          >
            YUZZA
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes yuzza-timeline {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }

        @keyframes yuzza-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes yuzza-wordmark {
          0%, 100% { opacity: 0.72; }
          50% { opacity: 1; }
        }
      `}</style>
      <header className={headerClass}>
      <div className="relative z-[1] min-w-0">
        <div className="flex min-w-0 items-end gap-3 max-sm:items-center max-[420px]:gap-2">
          <TextField
            label="Project"
            value={project.name}
            disabled={project.settings.mode !== "edit"}
            onValueChange={(name) => onChange({ ...project, name })}
            aria-label="Project name"
            className="min-w-0 max-w-[560px] flex-1"
            inputClassName={titleInputClass}
          />
        </div>

        <div className={hashLineClass}>
          Share hash <code>#{project.hash}</code>
        </div>
      </div>

      <div className={cn(headerControlsClass, "relative z-[1]")}>

        <div
          className={statusClusterClass}
          aria-label="Project save and sync status"
        >
          <span className={cn(saveStatusBaseClass, statusToneClass(saveState))}>{saveState}</span>
          <span className={cn(syncStatusBaseClass, statusToneClass(syncState))}>{syncLabel}</span>

          <button
            type="button"
            className={projectToolButtonClass}
            onClick={onOpenProject}
            aria-label="Open or create project"
            title="Open or create project"
          >
            <FilePlus2 size={18} aria-hidden="true" />
          </button>
          {project.settings.viewPinHash ? (
            <button
              type="button"
              className={cn(projectToolButtonClass, "tertiary")}
              onClick={onLockProject}
              aria-label="Lock project"
              title="Lock project"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <TextField
          label="Start"
          type="date"
          value={project.startDate}
          disabled={project.settings.mode !== "edit"}
          onValueChange={(startDate) => onChange({ ...project, startDate })}
          className={dateControlClass}
          inputClassName={dateInputClass}
        />
        <TextField
          label="End"
          type="date"
          value={project.endDate}
          disabled={project.settings.mode !== "edit"}
          onValueChange={(endDate) => onChange({ ...project, endDate })}
          className={dateControlClass}
          inputClassName={dateInputClass}
        />
        <div className="segmented" aria-label="Timeline mode">
          <button
            type="button"
            className={project.settings.mode === "view" ? "active" : ""}
            onClick={() => onModeChange("view")}
          >
            View
          </button>
          <button
            type="button"
            className={project.settings.mode === "edit" ? "active" : ""}
            onClick={() => onModeChange("edit")}
          >
            Edit
          </button>
        </div>
        <details className="mobile-control-menu">
          <summary>Project tools</summary>
          <div className="mobile-control-panel">
            {project.settings.mode === "edit" ? (
              <>
                <BackgroundColorControl
                  value={projectBackgroundColor}
                  onChange={changeBackgroundColor}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={onProjectPinChange}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  <span>Project PIN</span>
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={onEditPinChange}
                >
                  <Pencil size={16} aria-hidden="true" />
                  <span>Edit PIN</span>
                </button>
                {project.settings.viewPinHash ? (
                  <button
                    type="button"
                    className="tertiary"
                    onClick={onProjectPinRemove}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Remove PIN</span>
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="secondary"
              onClick={onRestoreRevision}
            >
              <History size={16} aria-hidden="true" />
              <span>Restore</span>
            </button>
            <button type="button" className="secondary" onClick={onOpenProject}>
              <FilePlus2 size={16} aria-hidden="true" />
              <span>New project</span>
            </button>
            {project.settings.viewPinHash ? (
              <button
                type="button"
                className="tertiary"
                onClick={onLockProject}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Lock</span>
              </button>
            ) : null}
            {project.settings.mode === "edit" ? (
              <ImportButton onImport={onImport} />
            ) : null}
          </div>
        </details>
        {project.settings.mode === "edit" ? (
          <div className="desktop-control-group">
            <BackgroundColorControl
              value={projectBackgroundColor}
              onChange={changeBackgroundColor}
            />
            <button
              type="button"
              className={cn(projectToolButtonClass, "secondary")}
              onClick={onProjectPinChange}
              aria-label={
                project.settings.viewPinHash
                  ? "Change project PIN"
                  : "Add project PIN"
              }
              title={
                project.settings.viewPinHash
                  ? "Change project PIN"
                  : "Add project PIN"
              }
            >
              <KeyRound size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn(projectToolButtonClass, "secondary")}
              onClick={onEditPinChange}
              aria-label={
                project.settings.editPinHash
                  ? "Change edit PIN"
                  : "Add edit PIN"
              }
              title={
                project.settings.editPinHash
                  ? "Change edit PIN"
                  : "Add edit PIN"
              }
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
            {project.settings.viewPinHash ? (
              <button
                type="button"
                className={cn(projectToolButtonClass, "tertiary")}
                onClick={onProjectPinRemove}
                aria-label="Remove project PIN"
                title="Remove project PIN"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={cn(projectToolButtonClass, "secondary")}
              onClick={onRestoreRevision}
              aria-label="Restore revision"
              title="Restore revision"
            >
              <History size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {project.settings.mode === "edit" ? (
          <ImportButton onImport={onImport} desktopOnly />
        ) : null}
      </div>
      </header>
    </>
  );
}

function BackgroundColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (backgroundColor: string) => void;
}) {
  return (
    <div className={backgroundColorControlClass}>
      <TextField
        label="Bg"
        type="color"
        value={value}
        onValueChange={onChange}
        inputClassName={backgroundColorInputClass}
      />
      <button
        type="button"
        className={cn(projectToolButtonClass, value === defaultProjectBackgroundColor ? "tertiary" : "secondary")}
        onClick={() => onChange(defaultProjectBackgroundColor)}
        aria-label="Reset background color"
        title="Reset background color"
        disabled={value === defaultProjectBackgroundColor}
      >
        {value === defaultProjectBackgroundColor ? (
          <Palette size={17} aria-hidden="true" />
        ) : (
          <RotateCcw size={17} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function ImportButton({
  onImport,
  desktopOnly = false,
}: {
  onImport: (file: File) => void;
  desktopOnly?: boolean;
}) {
  const labelClassName = desktopOnly
    ? cn(iconImportButtonClass, "desktop-only-control")
    : cn(importingButtonClass, "w-full");

  return (
    <label
      className={labelClassName}
      aria-label="Import project or Excel"
      title="Import project or Excel"
    >
      <FileUp size={18} aria-hidden="true" />
      <span className={desktopOnly ? "absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]" : ""}>
        Import
      </span>
      <input
        className="hidden"
        type="file"
        accept=".xlsx,.json,application/json"
        aria-label="Import project or Excel"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
