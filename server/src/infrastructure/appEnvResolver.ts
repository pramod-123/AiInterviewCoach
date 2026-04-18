/** Resolves effective `process.env` (optionally merged with `server/.app-runtime-config.json`). */
export type AppEnvResolver = () => NodeJS.ProcessEnv;
