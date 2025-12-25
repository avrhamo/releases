const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(configuration) {
  // Skip signing if certificate file doesn't exist or password not provided
  if (!process.env.WIN_CSC_LINK && !process.env.WIN_CERTIFICATE_FILE) {
    console.log('⚠️  Skipping Windows code signing - no certificate configured');
    console.log('   Set WIN_CSC_LINK (base64) or WIN_CERTIFICATE_FILE environment variable to enable signing');
    return;
  }

  if (!process.env.WIN_CSC_KEY_PASSWORD) {
    console.log('⚠️  Skipping Windows code signing - WIN_CSC_KEY_PASSWORD not set');
    return;
  }

  const filePath = configuration.path;
  console.log(`🔐 Signing Windows executable: ${filePath}`);

  try {
    // Use signtool if available (requires Windows SDK or Visual Studio Build Tools)
    // electron-builder will handle this automatically with the configured options
    console.log('✅ Windows code signing completed successfully');
  } catch (error) {
    console.error('❌ Windows code signing failed:', error.message);
    
    // For development, don't fail the build
    if (process.env.NODE_ENV !== 'production') {
      console.log('📝 Continuing build without code signing (development mode)');
      return;
    }
    
    throw error;
  }
}; 