export type TimelineMode = 'view' | 'edit';

export type TodoStatus = 'open' | 'doing' | 'done';

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
  };
};

export type TimelineRange = {
  startDate: string;
  endDate: string;
};
