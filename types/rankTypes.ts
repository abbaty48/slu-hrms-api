import type { TPagination } from "./types";

export type TCreateRankRequest = {
    name: string;
    level: number;
    salaryGrade?: string;
    requirements?: string;
    category: "Academic" | "Non-Academic" | "Administrative";
}

export type TRanksListResponse = {
    data: TRank[];
    pagination: TPagination
}

export type TRank = {
    id: string;
    title: string;
    level: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    salaryGrade?: string;
    description?: string;
    requirements?: string;
    category: "Academic" | "Non-Academic" | "Administrative";
}

// export type TRank = {
//     id: string;
//     title: string;
//     level: number;
//     description: string | null;
//     createdAt: string;
//     updatedAt: string;
//   }
