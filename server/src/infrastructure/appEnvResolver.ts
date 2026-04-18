/** Resolves effective `process.env` (optionally merged with `app-runtime-config.json`). */
export type AppEnvResolver = () => NodeJS.ProcessEnv;
