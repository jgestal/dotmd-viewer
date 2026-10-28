# DotMD Viewer — Plan

Visor Markdown multiplataforma con edición opcional. Hermano simplificado de DotMD (`../dotMD`).
Requisitos completos en [PROMPT.md](PROMPT.md).

## Decisiones

| Tema                  | Decisión                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Stack                 | Tauri 2 · Rust · Svelte 5 · TypeScript strict · Vite · Vitest (igual que DotMD)               |
| Markdown → HTML       | comrak (Rust) + KaTeX + Mermaid (carga diferida) + highlight.js + DOMPurify                   |
| Editores              | CodeMirror 6 (código) · Milkdown (vista previa editable, carga diferida)                      |
| Arrastrar hacia fuera | `tauri-plugin-drag` (como DotMD)                                                              |
| Plugins Tauri         | dialog, opener, single-instance, window-state, log, drag                                      |
| Arquitectura          | domain → application → ports → infrastructure (tauri / memory) → presentation, `container.ts` |
| Calidad               | ESLint + Prettier · clippy `-D warnings` · cobertura ≥ 90 % domain/application                |
| Mutación              | StrykerJS + cargo-mutants, score ≥ 85 %, en local al terminar y por `workflow_dispatch`       |
| Idiomas               | es / en, según el sistema, cambiable en Ajustes                                               |
| Repositorio           | `jgestal/dotmd-viewer`, público, MIT, Conventional Commits, una rama y un PR por ticket       |
| Release               | Instaladores sin firmar; firma preparada como paso opcional                                   |
| Identificador         | `es.gestal.dotmdviewer` · binario `dotmd-viewer`                                              |

## Delegación

- **Opus** (yo): plan, arquitectura, revisión de cada diff, integración y tickets delicados (★).
- **Sonnet**: lógica de dominio, casos de uso, comandos Rust y componentes de interfaz.
- **Haiku**: configuración, documentación, traducciones y tareas mecánicas.

Cada ticket se encarga con: descripción, archivos que debe tocar, criterios de aceptación y la
definición de hecho. Los tickets sin dependencias entre sí se lanzan en paralelo (worktrees aislados).

**Definición de hecho**: criterios cumplidos · tests nuevos en verde · lint y typecheck limpios ·
test de arquitectura en verde · diff revisado por Opus · CHANGELOG actualizado.

## Épicas y tickets

Formato: `ID · título · modelo · depende de`. Criterios de aceptación en cada Issue.

### E0 · Cimientos

- T01 · Scaffold Tauri 2 + SvelteKit estático + TS strict (configuración base de DotMD) · Sonnet · —
- T02 · ESLint, Prettier, `.editorconfig`, rustfmt, clippy · Haiku · T01
- T03 · Vitest + cobertura, `cargo test`, test de arquitectura por capas · Sonnet · T01
- T04 · StrykerJS y cargo-mutants configurados (scripts `test:mutation`) · Haiku · T03
- T05 · CI: lint, typecheck, tests, build en macOS/Windows/Linux · Haiku · T02, T03
- T06 · README inicial, LICENSE MIT, CHANGELOG, CONTRIBUTING, ARCHITECTURE · Haiku · T01

### E1 · Dominio (puro, sin dependencias)

- T07 · Entidad Documento: contenido, ruta, modificado, fin de línea, codificación · Sonnet · T03
- T08 · Estadísticas: palabras, caracteres (con/sin espacios), líneas, tiempo de lectura · Sonnet · T03
- T09 · Índice: extraer encabezados con slug y línea de origen · Sonnet · T03
- T10 · Diapositivas: dividir por `---` respetando bloques de código y front matter · Sonnet · T03
- T11 · Espacio de trabajo: carpeta, favoritos (añadir, quitar, reordenar, faltantes) · Sonnet · T03
- T12 · Recientes y preferencias (validación, valores por defecto) · Sonnet · T03

### E2 · Backend Rust

- T13 · Leer/escribir con codificación y guardado atómico · Sonnet · T01
- T14 · Listar carpeta filtrada (`.md`, `.markdown`, `.txt`) y por niveles · Sonnet · T01
- T15 · Render comrak (GFM, notas, front matter, líneas de origen) · Sonnet · T01
- T16 · Vigilar archivo (`notify`) y emitir eventos · Sonnet · T13
- T17 · Renombrar, mover, papelera, mostrar en Finder/Explorador · Sonnet · T14
- T18 ★ · CLI, instancia única y apertura desde el SO (macOS `RunEvent::Opened`) · Opus · T13

### E3 · Casos de uso y puertos

- T19 · Puertos (`FileSystem`, `Dialogs`, `Renderer`, `Watcher`, `Exporter`…) y dobles en memoria · Sonnet · T07
- T20 · Abrir / guardar / guardar como / cerrar con cambios / recarga externa · Sonnet · T19, T13
- T21 · Carpetas, favoritos y recientes persistentes · Sonnet · T11, T12, T19
- T22 · Adaptadores Tauri y `container.ts` · Sonnet · T19, T13–T17

### E4 · Interfaz: estructura

- T23 · Layout: barra lateral plegable y redimensionable, viewport, barra de estado · Sonnet · T22
- T24 · Pestaña Explorador (árbol, carga perezosa, selección) · Sonnet · T23, T21
- T25 · Pestaña Favoritos · Sonnet · T23, T21
- T26 · Pestaña Índice con resaltado de la sección visible · Sonnet · T23, T09
- T27 · Barra de estado (estadísticas, cursor, modo, codificación/fin de línea) · Sonnet · T23, T08
- T28 · Tema claro/oscuro del sistema, estilos de lectura · Sonnet · T23

### E5 · Viewport

- T29 · Vista previa: KaTeX, Mermaid diferido, highlight.js, DOMPurify, enlaces y anclas · Sonnet · T15, T23
- T30 · Visor por defecto en solo lectura + botón «Editar» (⌘E) · Sonnet · T29
- T31 · Editor de código CodeMirror 6 + buscar y reemplazar · Sonnet · T30
- T32 · Vista dividida con scroll sincronizado · Sonnet · T31
- T33 ★ · Vista previa editable con Milkdown, sincronizada con el código · Opus · T31
- T34 · Disposición Páginas (A4/Carta, número de página) · Sonnet · T29
- T35 · Disposición Diapositivas (pantalla completa, flechas, contador) · Sonnet · T10, T29
- T36 · Zoom (aumentar, reducir, restablecer) · Haiku · T29

### E6 · Menús y atajos

- T37 · Registro de comandos (id, atajo por SO, acción, estado activo) · Sonnet · T22
- T38 ★ · Menú nativo macOS / Windows / Linux con recientes · Opus · T37
- T39 · Menú contextual del Explorador · Sonnet · T37, T24

### E7 · Escritorio y arrastrar y soltar

- T40 · Asociación `.md`/`.markdown`, «Abrir con…» en los tres SO · Sonnet · T18
- T41 · Soltar archivos/carpetas en la ventana con indicador de zona · Sonnet · T20, T23
- T42 · Soltar imágenes en el editor → `assets/` + enlace · Sonnet · T31
- T43 · Arrastrar dentro del Explorador (mover) y hacia Favoritos · Sonnet · T24, T25, T17
- T44 · Arrastrar hacia fuera y proxy icon de la barra de título · Sonnet · T24
- T45 · Estado de ventana, última carpeta y último archivo · Haiku · T21
- T46 · Indicador de cambios sin guardar y confirmación al cerrar/salir · Sonnet · T20
- T47 · Recientes del SO (Dock en macOS, Jump List en Windows) · Sonnet · T38

### E8 · Exportación

- T48 · Exportar a PDF respetando la disposición · Sonnet · T34
- T49 · Imprimir · Haiku · T48

### E9 · Idiomas

- T50 · Infraestructura i18n (detección, cambio en caliente, menús nativos traducidos) · Sonnet · T23
- T51 · Traducciones es/en completas y test de claves faltantes · Haiku · T50

### E10 · Icono y créditos

- T52 · Variante del icono de DotMD + `scripts/render-icon.mjs` · Sonnet · T01
- T53 · Generar `.icns`, `.ico`, PNG y favicon con `tauri icon` · Haiku · T52
- T54 · Diálogo «Acerca de» con créditos (Juan Gestal, juan@gestal.es, gestal.es) · Haiku · T38

### E11 · Entrega

- T55 · Workflow de release sin firmar (`.dmg`, `.msi`/`.exe`, `.AppImage`/`.deb`) · Haiku · T05, T53
- T56 · README final: capturas, atajos, instalación, cómo abrir sin firmar · Haiku · todo E4–E10
- T57 ★ · Pasada de mutación: matar mutantes supervivientes o justificarlos · Opus + Sonnet · todo
- T58 · Lista de pruebas manuales por SO y versión 0.1.0 · Opus · T57

## Orden de ejecución

1. E0 → E1 y E2 en paralelo → E3.
2. E4, E5 y E6 (en paralelo donde las dependencias lo permitan); E10 puede ir en cualquier momento tras T01.
3. E7, E8, E9.
4. E11: mutación al final, luego te aviso para que pruebes la app.
