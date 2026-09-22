import { computed, ref } from "vue";
import type { Ref } from "vue";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface TableDesignerHistory<T> {
  current: Ref<T>;
  canUndo: Readonly<Ref<boolean>>;
  canRedo: Readonly<Ref<boolean>>;
  execute: (next: T) => T;
  undo: () => T | undefined;
  redo: () => T | undefined;
  sync: (next: T) => void;
  reset: (next: T) => void;
}

interface HistoryCommand<T> {
  before: T;
  after: T;
}

export function useTableDesignerHistory<T>(
  initialValue: T,
  maxSnapshots = 50,
): TableDesignerHistory<T> {
  const limit = Math.max(1, Math.floor(maxSnapshots));
  const current = ref(clone(initialValue)) as Ref<T>;
  const undoStack: Array<HistoryCommand<T>> = [];
  const redoStack: Array<HistoryCommand<T>> = [];
  const canUndo = computed(() => undoStack.length > 0);
  const canRedo = computed(() => redoStack.length > 0);

  function trimUndoStack() {
    while (undoStack.length > limit) undoStack.shift();
  }

  function execute(next: T) {
    undoStack.push({ before: clone(current.value), after: clone(next) });
    trimUndoStack();
    redoStack.splice(0);
    current.value = clone(next);
    return clone(current.value);
  }

  function undo() {
    const command = undoStack.pop();
    if (!command) return undefined;
    redoStack.push(command);
    current.value = clone(command.before);
    return clone(current.value);
  }

  function redo() {
    const command = redoStack.pop();
    if (!command) return undefined;
    undoStack.push(command);
    trimUndoStack();
    current.value = clone(command.after);
    return clone(current.value);
  }

  function reset(next: T) {
    undoStack.splice(0);
    redoStack.splice(0);
    current.value = clone(next);
  }

  function sync(next: T) {
    current.value = clone(next);
  }

  return { current, canUndo, canRedo, execute, undo, redo, sync, reset };
}
