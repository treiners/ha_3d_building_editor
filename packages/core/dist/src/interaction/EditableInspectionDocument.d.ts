import type { InspectionModel } from "./InspectionModel.js";
export interface EditableInspectionOptions {
    readonly title?: string;
    readonly step?: number;
    readonly debug?: boolean;
}
export declare function renderEditableInspectionHtml(svg: string, model: InspectionModel, sourceDocument: unknown, options?: EditableInspectionOptions): string;
