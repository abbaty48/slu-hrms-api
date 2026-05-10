import type { TPagination } from "./types.ts";

export type TCreateRankRequest = {
  name: string;
  title: string | null;
};

export type TRanksList = {
  data: TRank[];
  pagination: TPagination | null;
};
/*
export type TRank = {
  id: string;
  title: string;
  level: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  salaryGrade: string | null;
  description: string | null;
  // requirements: string | null;
  // category: "Academic" | "Non-Academic" | "Administrative";
};
*/

export type TRank = {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
