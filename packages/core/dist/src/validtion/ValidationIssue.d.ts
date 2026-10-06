export type ValidationSeverity = "error" | "warning" | "info";
export interface ValidationIssue {
    readonly code: string;
    readonly severity: ValidationSeverity;
    readonly objectId: string;
    readonly relatedObjectId?: string;
    readonly boundaryId?: string;
    readonly message: string;
}
