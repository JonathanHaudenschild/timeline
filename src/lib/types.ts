export type TimelineMode = 'view' | 'edit';

export type TodoStatus = string;

export type TimelineComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  what: string;
  who: string;
  type: string;
  category?: string;
  color?: string;
  showOnTimeline?: boolean;
  note: string;
};

export type TimelineTodo = {
  id: string;
  boardId?: string;
  protocolId?: string;
  protocolItemId?: string;
  title: string;
  who: string;
  body: string;
  status: TodoStatus;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  comments?: TimelineComment[];
  showOnTimeline: boolean;
  order?: number;
  importance?: number;
};

export type TimelineTodoBoard = {
  id: string;
  name: string;
  todos: TimelineTodo[];
  statuses?: TodoStatus[];
  completedTodoStatus?: TodoStatus;
  pinHash?: string;
};

export type StickyLink = {
  id: string;
  icon: string;
  label: string;
  url: string;
};

export type ProtocolCustomSection = {
  id: string;
  name: string;
  color?: string;
  items: MeetingProtocolItem[];
};

export type MeetingProtocol = {
  id: string;
  title: string;
  date: string;
  time: string;
  durationSeconds: number;
  timerStartedAt?: string;
  moderation: string;
  protocolWriter: string;
  todoOwner: string;
  updates: MeetingProtocolItem[];
  topics: MeetingProtocolItem[];
  todos: MeetingProtocolItem[];
  sectionNames?: { updates?: string; topics?: string; todos?: string };
  sectionColors?: { updates?: string; topics?: string; todos?: string };
  customSections?: ProtocolCustomSection[];
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingProtocolItem = {
  id: string;
  title: string;
  owner: string;
  body: string;
  convertedTodoId?: string;
  convertedEventId?: string;
  recurring?: boolean;
  recurringSourceId?: string;
  comments?: TimelineComment[];
  createdAt: string;
  updatedAt: string;
};

export type TimelineProject = {
  version: 1;
  revision?: number;
  hash: string;
  name: string;
  startDate: string;
  endDate: string;
  infoMarkdown: string;
  protocolInstructionTemplate: string;
  events: TimelineEvent[];
  todos: TimelineTodo[];
  todoBoards?: TimelineTodoBoard[];
  meetingProtocols?: MeetingProtocol[];
  settings: {
    mode: TimelineMode;
    showTodosOnTimeline: boolean;
    typeColors: Record<string, string>;
    editPinHash?: string;
    viewPinHash?: string;
    backgroundColor?: string;
    todoStatuses?: TodoStatus[];
    completedTodoStatus?: TodoStatus;
    activeTodoBoardId?: string;
    stickyLinks?: StickyLink[];
    sectionOrder?: string[];
    sectionNames?: Partial<Record<string, string>>;
  };
};

export type TimelineRange = {
  startDate: string;
  endDate: string;
};
