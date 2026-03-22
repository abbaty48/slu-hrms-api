export type TCreateAppointmentRequest = {
    name: string;
    description?: string;
    duration?: string;
    benefits?: string[];
}

// List Response Types

export type TAppointmentsListResponse = {
    data: TNatureOfAppointment[];
    total: number;
}

export type TNatureOfAppointment = {
    id: string;
    name: string;
    duration?: string; // e.g., "Permanent", "Contract", "Temporary"
    benefits?: string[];
    isActive: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
