; NSIS installer hooks (bundle.windows.nsis.installerHooks): right-click verbs on Markdown files
; in File Explorer — "Open with SimpleDotMD", "Export to PDF with SimpleDotMD" and "Print with
; SimpleDotMD" — backed by the app's command line (src-tauri/src/open_requests.rs).
;
; They live under SystemFileAssociations, so they show whichever app is the default for .md, and
; in HKCU, as the installer is per user. The registry holds one label per verb, so the labels are
; written in the installer's language (English or Spanish, picked from the Windows display
; language at install time). On Windows 11 they appear under "Show more options".

!define SIMPLEDOTMD_LANG_SPANISH 1034

; One verb for one extension: label, icon and the command it runs on the clicked file.
!macro SIMPLEDOTMD_WRITE_VERB EXT VERB LABEL ARGS
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.${VERB}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.${VERB}" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.${VERB}\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" ${ARGS}$\"%1$\""
!macroend

!macro SIMPLEDOTMD_WRITE_VERBS EXT
  ${If} $LANGUAGE == ${SIMPLEDOTMD_LANG_SPANISH}
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "Open" "Abrir con SimpleDotMD" ""
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "ExportPdf" "Exportar a PDF con SimpleDotMD" "--export-pdf "
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "Print" "Imprimir con SimpleDotMD" "--print "
  ${Else}
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "Open" "Open with SimpleDotMD" ""
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "ExportPdf" "Export to PDF with SimpleDotMD" "--export-pdf "
    !insertmacro SIMPLEDOTMD_WRITE_VERB "${EXT}" "Print" "Print with SimpleDotMD" "--print "
  ${EndIf}
!macroend

!macro SIMPLEDOTMD_DELETE_VERBS EXT
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.Open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.ExportPdf"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\SimpleDotMD.Print"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro SIMPLEDOTMD_WRITE_VERBS ".md"
  !insertmacro SIMPLEDOTMD_WRITE_VERBS ".markdown"
  ; Tell Explorer the context menus changed (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro SIMPLEDOTMD_DELETE_VERBS ".md"
  !insertmacro SIMPLEDOTMD_DELETE_VERBS ".markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
