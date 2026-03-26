import type { TPagination } from "./types.ts";

export type TCommittee = {
  id: string;
  name: string;
  chairman: string | null;
  members: string[]; // Array of staff IDs
  purpose: string | null;
  isActive: boolean;
  description: string | null;
  meetingSchedule: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TCommitteesList = {
  data: TCommittee[];
  pagination: TPagination | null;
};

export type TCreateCommitteeRequest = {
  name: string;
  description?: string;
  chairman?: string;
  members?: string[];
  purpose?: string;
  meetingSchedule?: string;
};
