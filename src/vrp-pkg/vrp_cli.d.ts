/* tslint:disable */
/* eslint-disable */

/**
 * Converts `problem` from format specified by `format` to `pragmatic` format.
 */
export function convert_to_pragmatic(format: string, inputs: any): any;

/**
 * Returns a list of unique locations which can be used to request a routing matrix.
 * A `problem` should be passed in `pragmatic` format.
 */
export function get_routing_locations(problem: any): any;

/**
 * Solves Vehicle Routing Problem passed in `pragmatic` format.
 */
export function solve_pragmatic(problem: any, matrices: any, config: any): any;

/**
 * Validates Vehicle Routing Problem passed in `pragmatic` format.
 */
export function validate_pragmatic(problem: any, matrices: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly convert_to_pragmatic: (a: number, b: number, c: any) => [number, number, number];
    readonly get_routing_locations: (a: any) => [number, number, number];
    readonly solve_pragmatic: (a: any, b: any, c: any) => [number, number, number];
    readonly validate_pragmatic: (a: any, b: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
