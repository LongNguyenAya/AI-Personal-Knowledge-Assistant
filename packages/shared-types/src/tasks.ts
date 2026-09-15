export interface TaskListItem {
  id: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// Real output of the listTasks tool, success returns tasks/count, malformed from/to returns an error.
// totalTaskCountIgnoringFilters is only present when count is 0, tells apart "no tasks at all" from "has tasks, none match the filter".
export type ListTasksOutput = { error: string } | { tasks: TaskListItem[]; count: number; totalTaskCountIgnoringFilters?: number };
