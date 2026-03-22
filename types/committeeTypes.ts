import type { TPagination } from "./types";

export type TCommittee = {
  id: string;
  name: string;
  chairman?: string;
  members: string[]; // Array of staff IDs
  purpose?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  meetingSchedule?: string;
};

export type TCommitteesListResponse = {
  data: TCommittee[];
  pagination: TPagination;
};

export type TCreateCommitteeRequest = {
  name: string;
  description?: string;
  chairman?: string;
  members?: string[];
  purpose?: string;
  meetingSchedule?: string;
};
