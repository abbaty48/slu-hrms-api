import type { TPagination } from "./types.ts";

export type TCreateResponsibilityRequest = {
  title: string;
  description: string | null;
};

export type TResponsibility = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TResponsibilitiesList = {
  data: TResponsibility[];
  pagination: TPagination | null;
};
