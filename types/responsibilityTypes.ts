export type TCreateResponsibilityRequest = {
    title: string;
    description: string;
    department?: string;
    assignedTo?: string[];
    priority?: "low" | "medium" | "high";
}


export type TResponsibility = {
    id: string;
    title: string;
    description: string;
    department?: string;
    assignedTo?: string[]; // Array of staff IDs
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    priority: "low" | "medium" | "high";
}


export type TResponsibilitiesListResponse = {
    data: TResponsibility[];
    total: number;
}
