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
      <aside className={`sticky-links ${isCollapsed ? 'collapsed' : ''}`} aria-label="Project links">
        {isCollapsed ? null : (
          <div className="sticky-link-list">
            {links.map((link) => (
              <div className="sticky-link-row" key={link.id}>
                <a
                  className="sticky-link"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.label}
                >
                  <StickyLinkIcon icon={link.icon} />
                  <b>{link.label}</b>
                </a>
                {canEdit ? (
                  <button type="button" className="sticky-link-edit" onClick={() => setDraftLink(link)} aria-label={`Edit ${link.label}`}>
                    edit
                  </button>
                ) : null}
              </div>
            ))}
            {canEdit ? (
              <button type="button" className="sticky-link add-link" onClick={() => setDraftLink(emptyLink())}>
                <span aria-hidden="true">+</span>
                <b>Add</b>
              </button>
            ) : null}
          </div>
        )}
        <button
          type="button"
          className="sticky-link-collapse"
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
            className="editor-panel modal-panel sticky-link-editor"
            onSubmit={(event) => {
              event.preventDefault();
              saveLink();
            }}
          >
            <div className="panel-title">Sticky link</div>
            <div className="form-grid">
              <label>
                <span>Icon</span>
                <select
                  value={draftLink.icon}
                  onChange={(event) => setDraftLink({ ...draftLink, icon: event.target.value })}
                  required
                >
                  {iconOptions.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Label</span>
                <input
                  value={draftLink.label}
                  onChange={(event) => setDraftLink({ ...draftLink, label: event.target.value })}
                  required
                />
              </label>
            </div>
            <label>
              <span>URL</span>
              <input
                type="url"
                value={draftLink.url}
                onChange={(event) => setDraftLink({ ...draftLink, url: event.target.value })}
                required
              />
            </label>
            <div className="action-row">
              <button type="submit">Save link</button>
              <button type="button" className="secondary" onClick={() => setDraftLink(null)}>
                Cancel
              </button>
              {links.some((link) => link.id === draftLink.id) ? (
                <button
                  type="button"
                  className="secondary"
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
    <span aria-hidden="true">
      <Icon size={20} strokeWidth={3} />
    </span>
  );
}
