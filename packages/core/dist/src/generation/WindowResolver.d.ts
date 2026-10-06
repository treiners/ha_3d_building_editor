import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { ResolvedWindow } from "../model/ResolvedWindow.js";
import type { WindowOpening } from "../model/WindowOpening.js";
export interface WindowResolverOptions {
    readonly tolerance?: number;
    readonly defaultWidth?: number;
    readonly defaultHeight?: number;
    readonly defaultSillHeight?: number;
}
export declare function resolveWindows(windows: readonly WindowOpening[], floor: GeneratedFloor, options?: WindowResolverOptions): ResolvedWindow[];
