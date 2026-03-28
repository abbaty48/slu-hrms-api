import type { TPagination } from "./types.ts";

export type TCreateRankRequest = {
  name: string;
  level: number;
  title: string | null;
  // salaryGrade?: string;
  // requirements?: string;
  // category: "Academic" | "Non-Academic" | "Administrative";
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
  level: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
