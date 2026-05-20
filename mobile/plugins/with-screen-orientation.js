const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/** Allow portrait + landscape (follows device auto-rotate). */
function withScreenOrientation(config) {
  return withAndroidManifest(config, (mod) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    mainActivity.$["android:screenOrientation"] = "fullUser";
    return mod;
  });
}

module.exports = withScreenOrientation;
