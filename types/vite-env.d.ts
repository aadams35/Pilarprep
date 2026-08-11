interface ImportMetaEnv {
  readonly VITE_PILLARPREP_STATIC_DEMO?: string;
  readonly VITE_PILLARPREP_BACKEND_URL?: string;
  readonly VITE_PILLARPREP_BACKEND_REGION?: string;
  readonly VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}