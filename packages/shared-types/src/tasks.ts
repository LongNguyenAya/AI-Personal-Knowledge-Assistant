export interface TaskListItem {
  id: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// Real output of the listTasks tool, success returns tasks/count, malformed from/to returns an error.
export type ListTasksOutput = { error: string } | { tasks: TaskListItem[]; count: number };
