export interface TaskListItem {
  id: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// Output thật của tool listTasks, thành công trả tasks/count, from/to sai định dạng trả error.
export type ListTasksOutput = { error: string } | { tasks: TaskListItem[]; count: number };
