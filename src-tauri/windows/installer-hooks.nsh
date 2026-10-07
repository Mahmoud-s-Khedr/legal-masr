; This marker distinguishes an NSIS installation from a portable executable.
!macro NSIS_HOOK_POSTINSTALL
  Push $0
  FileOpen $0 "$INSTDIR\.legal-masr-installed" w
  FileWrite $0 "installed"
  FileClose $0
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\.legal-masr-installed"
!macroend
