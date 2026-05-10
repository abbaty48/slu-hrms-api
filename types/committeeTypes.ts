import type { TPagination } from "./types.ts";

export type TCommittee = {
  id: string;
  name: string;
  isActive: boolean;
  abbre: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TCommitteesList = {
  data: TCommittee[];
  pagination: TPagination | null;
};

export type TCreateCommitteeRequest = {
  name: string;
  abbre?: string;
  description?: string;
};
