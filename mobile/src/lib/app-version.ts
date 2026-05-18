import Constants from "expo-constants";

/** User-facing semver from app.json / native build (e.g. 0.6). */
export const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";
