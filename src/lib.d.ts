export interface LibModule extends EmscriptenModule {
    _qnt_extract(ptr: number): number;
}

declare const createModule: EmscriptenModuleFactory<LibModule>;
export default createModule;
