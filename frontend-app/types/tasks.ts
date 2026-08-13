export type Task = {
  id: string;
  title: string;
  isDone: boolean;
  reminderId: string | null;
  createdAt: string;
};

export type TasksResponse = {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
};
