const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // Check if notarization credentials are provided
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.log('Skipping notarization - APPLE_ID and APPLE_ID_PASSWORD environment variables not set');
    return;
  }

  try {
    await notarize({
      appBundleId: 'com.apiworkspace.app',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    
    console.log('Notarization successful!');
  } catch (error) {
    console.error('Notarization failed:', error);
    // Don't throw error to allow build to continue
  }
}; 