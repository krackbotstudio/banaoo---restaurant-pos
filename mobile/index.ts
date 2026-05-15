// First import only: see `formdata-polyfill.ts` — hoisted imports run before this file's body.
import "./formdata-polyfill";
// Wire RN globals (FormData, fetch, WebSocket, …) before `./App` / Supabase load.
import "react-native/Libraries/Core/InitializeCore";

import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";

void SplashScreen.preventAutoHideAsync().catch(() => {});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
