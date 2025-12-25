; Custom installer script for API Workspace
; This file is included in the NSIS installer

; Define custom install messages
!define MUI_WELCOMEPAGE_TEXT "Welcome to the API Workspace Setup Wizard.$\r$\n$\r$\nThis wizard will guide you through the installation of API Workspace - The Ultimate Developer Toolkit for REST API Development.$\r$\n$\r$\nClick Next to continue."

; Custom finish page (don't redefine MUI_FINISHPAGE_RUN as electron-builder handles it)
!define MUI_FINISHPAGE_RUN_TEXT "Launch API Workspace"
!define MUI_FINISHPAGE_LINK "Visit the API Workspace website"  
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/avrhamo/api-workspace"

; Custom uninstaller
!macro customUnInstall
  ; Add custom uninstall logic here if needed
  Delete "$DESKTOP\API Workspace.lnk"
  Delete "$SMPROGRAMS\API Workspace.lnk"
!macroend 