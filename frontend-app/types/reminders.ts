export type Reminder = {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  source: string;
  createdAt: string;
};

export type RemindersResponse = {
  reminders: Reminder[];
  total: number;
  page: number;
  pageSize: number;
};
