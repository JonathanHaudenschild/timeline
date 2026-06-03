export type TimelineMode = 'view' | 'edit';

export type TodoStatus = string;

export type TimelineEvent = {
  id: string;
  date: string;
  endDate?: string;
  time: string;
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
  title: string;
  who: string;
  body: string;
  status: TodoStatus;
  dueDate?: string;
  showOnTimeline: boolean;
  order?: number;
};

export type StickyLink = {
  id: string;
  icon: string;
  label: string;
  url: string;
};

export type TimelineProject = {
  version: 1;
  hash: string;
  name: string;
  startDate: string;
  endDate: string;
  infoMarkdown: string;
  events: TimelineEvent[];
  todos: TimelineTodo[];
  settings: {
    mode: TimelineMode;
    showTodosOnTimeline: boolean;
    typeColors: Record<string, string>;
    editPinHash?: string;
    viewPinHash?: string;
    todoStatuses?: TodoStatus[];
    completedTodoStatus?: TodoStatus;
    stickyLinks?: StickyLink[];
  };
};

export type TimelineRange = {
  startDate: string;
  endDate: string;
};
