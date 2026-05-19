const { withAppBuildGradle } = require("@expo/config-plugins");

/** APK filename + exclude duplicate BouncyCastle jars (tcp-socket vs other deps). */
function withAndroidRelease(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    const version = config.version || "0.0.0";
    const parts = version.split(".");
    const label =
      parts.length >= 3 ? `0.${parts[1]}${parts[2]}` : version.replace(/\./g, "");
    const apkName = `banaoo-app-V.${label}.apk`;

    if (!contents.includes("bcprov-jdk15on")) {
      contents = contents.replace(
        "\ndependencies {",
        `
configurations.configureEach {
    exclude group: "org.bouncycastle", module: "bcprov-jdk15on"
    exclude group: "org.bouncycastle", module: "bcutil-jdk15on"
}

dependencies {`
      );
    }

    contents = contents.replace(
      /outputFileName = "banaoo-app-[^"]+"/g,
      `outputFileName = "${apkName}"`
    );

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withAndroidRelease;
