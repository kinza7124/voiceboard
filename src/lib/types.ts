export type Priority = "high" | "medium" | "low";
export type ListKey = "todo" | "doing" | "done";

export type Task = {
  title: string;
  owner: string | null;
  due: string | null; // YYYY-MM-DD
  priority: Priority;
  notes: string;
  list: ListKey; // which Trello column the card belongs in
};

/** What the model returns for one dictation. */
export type Extraction = {
  summary: string;
  decisions: string[];
  tasks: Task[];
};

export type CreatedCard = Task & {
  id?: string;
  url?: string;
  error?: string;
  assigned?: boolean; // owner matched a real Trello board member
  duplicate?: boolean; // an equivalent open card already existed, so nothing was created
};

/** Anything a ticket card can render; cards read back from Trello may have no priority. */
export type Ticket = Omit<Task, "priority" | "list"> & {
  priority: Priority | null;
  list?: string;
  url?: string;
  error?: string;
  assigned?: boolean;
  duplicate?: boolean;
};

export type BoardList = { id: string; name: string; cards: (Ticket & { id: string })[] };
export type BoardData = { name: string; url: string; lists: BoardList[] };
