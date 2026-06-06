'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Globe,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  Settings,
  Sheet,
  Star,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { SelectField, TextField } from './FormControls';
import { cn } from '@/lib/cn';
import type { StickyLink } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

type StickyLinksProps = {
  links: StickyLink[];
  canEdit: boolean;
  onChange: (links: StickyLink[]) => void;
};

const emptyLink = (): StickyLink => ({
  id: crypto.randomUUID(),
  icon: 'link',
  label: 'New link',
  url: 'https://',
});

const linkIcons = {
  link: Link,
  globe: Globe,
  calendar: CalendarDays,
  file: FileText,
  sheet: Sheet,
  folder: Folder,
  users: Users,
  map: MapPin,
  ticket: Ticket,
  message: MessageCircle,
  mail: Mail,
  phone: Phone,
  star: Star,
  wrench: Wrench,
  settings: Settings,
  music: Music,
} as const;

type LinkIconName = keyof typeof linkIcons;

const iconOptions: Array<{ value: LinkIconName; label: string }> = [
  { value: 'link', label: 'Link' },
  { value: 'globe', label: 'Web' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'file', label: 'File' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'folder', label: 'Folder' },
  { value: 'users', label: 'People' },
  { value: 'map', label: 'Map' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'message', label: 'Chat' },
  { value: 'mail', label: 'Mail' },
  { value: 'phone', label: 'Phone' },
  { value: 'star', label: 'Star' },
  { value: 'wrench', label: 'Tools' },
  { value: 'settings', label: 'Settings' },
  { value: 'music', label: 'Music' },
];

export function StickyLinks({ links, canEdit, onChange }: StickyLinksProps) {
  const appDialog = useAppDialog();
  const [draftLink, setDraftLink] = useState<StickyLink | null>(null);
  const [isCollapsed, setIsCollapsed] = usePersistentState('timeline:ui:sticky-links-collapsed', true);

  function saveLink() {
    if (!draftLink) return;
    const exists = links.some((link) => link.id === draftLink.id);
    onChange(exists ? links.map((link) => (link.id === draftLink.id ? draftLink : link)) : [...links, draftLink]);
    setDraftLink(null);
  }

  return (
    <>
      <aside
        className={cn(
          'fixed bottom-[18px] left-3.5 z-[34] inline-grid items-end gap-1.5 max-sm:bottom-[72px] max-sm:left-2',
          isCollapsed ? 'grid-cols-1 gap-0' : 'grid-cols-[auto_auto]',
        )}
        aria-label="Project links"
      >
        {isCollapsed ? null : (
          <div className="grid gap-2">
            {links.map((link) => (
              <div className="grid grid-cols-[auto_auto] items-stretch gap-1" key={link.id}>
                <a
                  className="grid min-w-[52px] max-w-[132px] justify-items-center gap-[3px] rounded-[2px] border border-[rgba(36,34,29,0.28)] bg-[var(--primary)] px-[7px] py-1.5 text-[var(--text)] no-underline uppercase max-sm:min-w-[38px] max-sm:p-1.5"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.label}
                >
                  <StickyLinkIcon icon={link.icon} />
                  <b className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-[1.1] max-sm:hidden">{link.label}</b>
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    className="min-h-full min-w-[26px] rounded-[2px] border border-[rgba(36,34,29,0.22)] bg-[#fffef8] px-[4px] text-[9px] text-[var(--muted)] [writing-mode:vertical-rl] max-sm:hidden"
                    onClick={() => setDraftLink(link)}
                    aria-label={`Edit ${link.label}`}
                  >
                    edit
                  </button>
                ) : null}
              </div>
            ))}
            {canEdit ? (
              <button
                type="button"
                className="grid w-full min-w-[52px] max-w-[132px] justify-items-center gap-[3px] rounded-[2px] border border-[rgba(36,34,29,0.28)] bg-[var(--primary)] px-[7px] py-1.5 text-[var(--text)] uppercase max-sm:min-w-[38px] max-sm:p-1.5"
                onClick={() => setDraftLink(emptyLink())}
              >
                <span className="text-lg font-black leading-none" aria-hidden="true">+</span>
                <b className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-[1.1] max-sm:hidden">Add</b>
              </button>
            ) : null}
          </div>
        )}
        <button
          type="button"
          className="icon-button tertiary inline-grid min-h-[52px] min-w-9 place-items-center rounded-[2px] p-0"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-label={isCollapsed ? 'Expand project links' : 'Collapse project links'}
          title={isCollapsed ? 'Expand links' : 'Collapse links'}
        >
          {isCollapsed ? <ChevronRight size={18} strokeWidth={3} /> : <ChevronLeft size={18} strokeWidth={3} />}
        </button>
      </aside>

      {draftLink ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit sticky link">
          <form
            className="editor-panel modal-panel grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveLink();
            }}
          >
            <div className="panel-title">Sticky link</div>
            <div className="form-grid">
              <SelectField
                label="Icon"
                value={draftLink.icon}
                onValueChange={(icon) => setDraftLink({ ...draftLink, icon })}
                required
                className="max-w-none"
              >
                  {iconOptions.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
              </SelectField>
              <TextField
                label="Label"
                value={draftLink.label}
                onValueChange={(label) => setDraftLink({ ...draftLink, label })}
                required
              />
            </div>
            <TextField
              label="URL"
              type="url"
              value={draftLink.url}
              onValueChange={(url) => setDraftLink({ ...draftLink, url })}
              required
            />
            <div className="action-row">
              <button type="submit">Save link</button>
              <button type="button" className="tertiary" onClick={() => setDraftLink(null)}>
                Cancel
              </button>
              {links.some((link) => link.id === draftLink.id) ? (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    void appDialog
                      .confirm({
                        title: 'Delete link?',
                        message: `Delete "${draftLink.label}" link?`,
                        confirmLabel: 'Delete link',
                        tone: 'danger',
                      })
                      .then((confirmed) => {
                        if (!confirmed) return;
                        onChange(links.filter((link) => link.id !== draftLink.id));
                        setDraftLink(null);
                      });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
      {appDialog.dialog}
    </>
  );
}

function StickyLinkIcon({ icon }: { icon: string }) {
  const Icon = linkIcons[icon as LinkIconName];
  if (!Icon) return <span>{icon}</span>;

  return (
    <span className="text-lg font-black leading-none" aria-hidden="true">
      <Icon size={20} strokeWidth={3} />
    </span>
  );
}
