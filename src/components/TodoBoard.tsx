'use client';

import { useState } from 'react';
import { TodoEditor } from './TodoEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';

type TodoBoardProps = {
  todos: TimelineTodo[];
  onChange: (todos: TimelineTodo[]) => void;
};

const statuses: TodoStatus[] = ['open', 'doing', 'done'];
const statusLabels: Record<TodoStatus, string> = {
  open: 'Open',
  doing: 'Doing',
  done: 'Done',
};

export function TodoBoard({ todos, onChange }: TodoBoardProps) {
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);

  function addTodo() {
    setDraftTodo({
      id: crypto.randomUUID(),
      title: 'New todo',
      who: '',
      body: '- Add details',
      status: 'open',
      dueDate: '',
      showOnTimeline: false,
    });
  }

  function updateTodo(todo: TimelineTodo) {
    onChange(todos.map((item) => (item.id === todo.id ? todo : item)));
  }

  function saveTodo() {
    if (!draftTodo) return;
    const exists = todos.some((todo) => todo.id === draftTodo.id);
    onChange(exists ? todos.map((todo) => (todo.id === draftTodo.id ? draftTodo : todo)) : [...todos, draftTodo]);
    setDraftTodo(null);
  }

  function moveTodo(todoId: string, status: TodoStatus) {
    onChange(todos.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)));
  }

  const totalOpen = todos.filter((todo) => todo.status !== 'done').length;

  return (
    <section className="todo-board">
      <div className="section-heading">
        <div>
          <h2>Todos</h2>
          <div className="todo-board-summary">{totalOpen} open / {todos.length} total</div>
        </div>
        <button type="button" onClick={addTodo}>
          Add todo
        </button>
      </div>
      {draftTodo ? (
        <TodoEditor
          draft={draftTodo}
          onChange={setDraftTodo}
          onCancel={() => setDraftTodo(null)}
          onSave={saveTodo}
        />
      ) : null}
      <div className="todo-columns">
        {statuses.map((status) => {
          const columnTodos = todos
            .filter((todo) => todo.status === status)
            .sort(compareTodos);

          return (
            <div
              className={`todo-column ${dropStatus === status ? 'drop-target' : ''}`}
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setDropStatus(status);
              }}
              onDragLeave={() => setDropStatus(null)}
              onDrop={() => {
                if (draggedTodoId) moveTodo(draggedTodoId, status);
                setDraggedTodoId(null);
                setDropStatus(null);
              }}
            >
              <div className="column-title">
                <span>{statusLabels[status]}</span>
                <b>{columnTodos.length}</b>
              </div>
              {columnTodos.length ? (
                columnTodos.map((todo) => (
                  <article
                    className={`todo-item ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                    key={todo.id}
                    draggable
                    onDragStart={() => setDraggedTodoId(todo.id)}
                    onDragEnd={() => {
                      setDraggedTodoId(null);
                      setDropStatus(null);
                    }}
                    onClick={() => setDraftTodo(todo)}
                  >
                    <div className="todo-card-topline">
                      <span className="todo-drag-grip" aria-hidden="true">drag</span>
                      <div className="todo-card-title">{todo.title}</div>
                    </div>
                    <div className="todo-card-meta">
                      <span>{todo.who || 'No owner'}</span>
                      {todo.dueDate ? <time>{todo.dueDate}</time> : <span>No due date</span>}
                    </div>
                    {todo.body.trim() ? <p className="todo-card-note">{todoExcerpt(todo.body)}</p> : null}
                    <div className="todo-meta">
                      <label className="check-control compact">
                        <input
                          type="checkbox"
                          checked={todo.showOnTimeline}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateTodo({ ...todo, showOnTimeline: event.target.checked })
                          }
                        />
                        Timeline
                      </label>
                      <button
                        type="button"
                        className="mini-button secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDraftTodo(todo);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onChange(todos.filter((item) => item.id !== todo.id));
                        }}
                        aria-label={`Delete ${todo.title}`}
                      >
                        x
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="todo-empty">Drop here</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function compareTodos(a: TimelineTodo, b: TimelineTodo) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

function todoExcerpt(markdown: string) {
  const plainText = markdown
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.length > 96 ? `${plainText.slice(0, 93)}...` : plainText;
}
