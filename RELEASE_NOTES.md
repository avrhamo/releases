# Release Notes - API Workspace v0.0.1

This release focuses on improving the application's appearance, optimizing the distribution size, and enhancing the OpenAPI Generator tool with YAML support.

## 🚀 Highlights

### 🎨 Custom Taskbar Icon
- **Fixed:** The application now correctly displays the custom API Workspace icon in the Windows taskbar, replacing the default Electron framework icon.

### 📦 Optimized Installer Size
- **Reduced Size:** We've significantly reduced the installer's memory footprint by optimizing how dependencies are packaged.
- **Improved Build Process:** Renderer-only dependencies are now excluded from the production bundle, resulting in a much leaner and faster installation experience.

### 🛠️ OpenAPI Generator Enhancements
- **YAML Support:** The OpenAPI Generator now supports both JSON and YAML formats.
- **Auto-Detection:** The tool automatically detects your input format, providing a seamless experience for documenting your APIs.
- **Swagger UI Integration:** Improved the rendering of your API specifications for better readability.

### 🐞 Bug Fixes & Improvements
- **Base64 Tool:** Fixed various bugs and added robust support for multi-format file uploads (Images, PDF, CSV, etc.).
- **Build Scripts:** Updated build configurations to ensure consistent and reliable application packaging across all platforms.

---
*For more information, please visit our [GitHub repository](https://github.com/avrhamo/api-workspace).*
