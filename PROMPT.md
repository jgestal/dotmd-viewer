# Prompt: SimpleDotMD

## Contexto

En `../dotMD` está **DotMD**, mi editor Markdown (Tauri 2 + Rust + Svelte 5 + TypeScript, Clean Architecture
documentada en `../dotMD/ARCHITECTURE.md`). Quiero crear en esta carpeta (`dotMDViewer`) una aplicación
hermana, **SimpleDotMD**: un visor/editor Markdown multiplataforma (macOS, Windows, Linux) mucho más simple.
Es una versión recortada: pocas opciones, bien hechas. Ante la duda, menos.

Antes de escribir código, lee `ARCHITECTURE.md`, `package.json`, `src-tauri/tauri.conf.json` y la estructura
de `src/lib` de DotMD. Puedes reutilizar módulos puros de DotMD (render, toc, stats, paginate, slides) si
encajan, copiándolos y simplificándolos; no crees dependencias entre los dos repositorios.

## Stack

El mismo que DotMD: Tauri 2, Rust, Svelte 5, TypeScript, Vite, Vitest. Markdown → HTML con comrak (Rust),
como DotMD; KaTeX para LaTeX, Mermaid para diagramas, highlight.js para código, DOMPurify para sanear el
HTML. Editor de código con CodeMirror 6; edición visual (WYSIWYG) con Milkdown.

## Funcionalidades (alcance cerrado)

### Barra lateral izquierda (plegable, con tres pestañas)

1. **Explorador**: árbol de la carpeta abierta, solo `.md`/`.markdown`/`.txt`.
2. **Favoritos**: archivos y carpetas marcados, persistentes entre sesiones.
3. **Índice**: encabezados del documento actual; clic para navegar y resaltado de la sección visible.

### Viewport

- **Es un visor primero**: los documentos se abren en Vista previa de solo lectura. Un botón/pestaña
  **«Editar»** en la cabecera del viewport (⌘/Ctrl+E) activa la edición y muestra los modos de abajo.
- **Modo de edición** (con «Editar» activo): Vista previa editable (WYSIWYG) · Código · Dividida (scroll sincronizado). Atajos ⌘/Ctrl+1, 2, 3.
- **Disposición de lectura**: Continua · Páginas (A4/Carta) · Diapositivas (separadas por `---`,
  pantalla completa, navegación con flechas).
- Se puede **editar tanto en código como en la vista previa** (WYSIWYG); ambos quedan sincronizados.
- Soporte: GFM (tablas, listas de tareas, notas al pie), LaTeX en línea y en bloque (`$…$`, `$$…$$`),
  Mermaid, resaltado de sintaxis, front matter YAML (oculto en la vista previa).

### Barra de estado

Palabras, caracteres (con y sin espacios), líneas, tiempo de lectura, posición del cursor, modo actual
y codificación/fin de línea.

### Exportación

Exportar a **PDF** (respetando la disposición elegida) e **imprimir**.

### Integración con el sistema operativo

- Asociación de archivos `.md`/`.markdown` y aparición en «Abrir con…» en los tres sistemas.
- Abrir archivos al hacer doble clic, arrastrándolos a la ventana o al icono del Dock/barra de tareas,
  y desde la línea de comandos (`simpledotmd archivo.md`).
- Instancia única: abrir un segundo archivo lo envía a la ventana existente.
- Archivos recientes (menú del sistema y Dock/Jump List).
- Recarga automática si el archivo cambia en disco, avisando si hay cambios sin guardar.
- Tema claro/oscuro según el sistema.

### Arrastrar y soltar e integración de escritorio

- Soltar archivos o carpetas en la ventana: un `.md` se abre y una carpeta se carga en el Explorador.
- Soltar imágenes en el editor: se copian junto al documento (`assets/`) y se inserta el enlace Markdown.
- Arrastrar dentro del Explorador para mover archivos, y del Explorador a Favoritos para marcarlos.
- Arrastrar un archivo del Explorador **hacia fuera** (Finder/Explorer, otras apps) y desde el icono
  del documento en la barra de título (proxy icon de macOS).
- Indicador visual de la zona de soltado y rechazo claro de los tipos no admitidos.
- Aspecto nativo: barra de título y atajos propios de cada sistema (⌘ en macOS, Ctrl en Windows/Linux),
  menú contextual en el Explorador (Mostrar en Finder/Explorador, Copiar ruta, Renombrar, Papelera).
- La ventana recuerda tamaño, posición, carpeta abierta y último archivo.
- Indicador de cambios sin guardar (punto en el botón de cerrar en macOS, `*` en el título en el resto)
  y confirmación al cerrar.

### Menús nativos

- **macOS — SimpleDotMD**: Acerca de, Ajustes…, Servicios, Ocultar, Salir.
- **Archivo**: Nuevo, Abrir…, Abrir carpeta…, Abrir reciente ▸, Guardar, Guardar como…, Exportar a PDF…,
  Imprimir…, Cerrar.
- **Edición**: Deshacer, Rehacer, Cortar, Copiar, Pegar, Seleccionar todo, Buscar…, Buscar y reemplazar…
- **Visualización**: Vista previa / Código / Dividida; Continua / Páginas / Diapositivas; Mostrar barra
  lateral; Explorador / Favoritos / Índice; Aumentar/Reducir/Restablecer zoom; Pantalla completa.
- **Ventana** (macOS): Minimizar, Zoom, traer todo al frente.
- **Ayuda**: Atajos de teclado, Sitio web, Créditos/Acerca de.
- En Windows/Linux, «Ajustes» y «Acerca de» van en Archivo y Ayuda respectivamente.

### Idiomas

Interfaz en **español e inglés** (i18n desde el primer día, sin textos fijos en los componentes).
Sigue el idioma del sistema y se puede cambiar en Ajustes.

### Créditos

Diálogo «Acerca de» y sección en el README: **Juan Gestal** — juan@gestal.es — https://www.gestal.es

## Icono

Parte de `../dotMD/assets/icon.svg` y crea una variante reconocible como hermana pero distinta
(p. ej. otro color de fondo y un detalle de «visor»). Genera con `tauri icon` todos los formatos:
`.icns` (macOS, rejilla de Apple con margen), `.ico` multirresolución (Windows), PNG 32–1024 (Linux)
y favicon. Incluye un script reproducible como `scripts/render-icon.mjs` de DotMD.

## Arquitectura y calidad

- Clean Architecture como DotMD: `domain` (puro) → `application` (casos de uso) → `ports` (interfaces)
  → `infrastructure` (Tauri y dobles en memoria) → `presentation` (Svelte), con un único `container.ts`.
- Test de arquitectura que impida dependencias hacia fuera.
- Clean Code: funciones pequeñas, nombres claros, sin duplicación, sin código muerto, TypeScript `strict`,
  ESLint + Prettier, `cargo clippy -D warnings` y `cargo fmt`.
- **Tests unitarios**: Vitest (frontend) y `cargo test` (Rust). Cobertura ≥ 90 % en domain/application.
- **Mutation testing**: StrykerJS para TypeScript y `cargo-mutants` para Rust. Objetivo: mutation score
  ≥ 85 % en domain/application; cada mutante superviviente se mata con un test o se justifica por escrito.
- **CI** en GitHub Actions: lint, typecheck, tests y build de los tres sistemas. Workflow de release que
  genere instaladores (`.dmg`, `.msi`/`.exe`, `.AppImage`/`.deb`) **sin firmar** por ahora (no hay
  certificados); deja la firma preparada como paso opcional y explica en el README cómo abrir la app
  sin firmar en macOS y Windows.
- La **mutación** no va en CI en cada PR: se ejecuta en local al terminar todo, antes de entregar la app
  para probarla (y queda un workflow manual `workflow_dispatch` para repetirla).

## Repositorio

- `git init`, repositorio **público** en GitHub `jgestal/simpledotmd` con `gh repo create`, licencia **MIT**.
- README (capturas, funciones, atajos, instalación, compilación, tests, créditos), LICENSE MIT,
  CHANGELOG, ARCHITECTURE.md, CONTRIBUTING.md, `.gitignore`, `.editorconfig`.
- Conventional Commits; una rama y un PR por ticket.

## Forma de trabajo

1. **Plan**: escribe `PLAN.md` con épicas y tickets pequeños (cada uno ≤ ~½ día, con criterios de
   aceptación verificables y dependencias). Pásamelo para aprobarlo antes de empezar.
2. **Tickets**: créalos como GitHub Issues con etiquetas y un milestone por épica.
3. **Delegación**: tú (Opus) orquestas y revisas; encarga cada ticket a un subagente con un modelo más
   pequeño (Sonnet para lógica y UI, Haiku para tareas mecánicas: configuración, documentación, iconos).
   Cada subagente recibe el ticket completo, los archivos relevantes y la definición de «hecho».
4. **Definición de hecho**: tests en verde, lint limpio, mutantes del módulo muertos, revisión tuya del diff,
   CHANGELOG actualizado.
5. Pregúntame solo lo que bloquee de verdad; para lo demás, elige lo razonable y anótalo en el PLAN.

## Fuera de alcance

Temas de hoja, sonidos, modo zen, pestañas múltiples, búsqueda global, exportación HTML/DOCX,
actualizador automático, sincronización en la nube, plugins.
