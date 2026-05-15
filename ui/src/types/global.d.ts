// Injected by webpack DefinePlugin — see webpack.config.cjs.
declare const __API_BASE_URL__: string;

// CSS Modules — typed as opaque class maps so TS-aware imports work.
declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}
