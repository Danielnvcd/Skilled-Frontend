import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Configuración "flat" de ESLint 9.
//
// El objetivo NO es imponer un estilo (de eso se encarga Prettier), sino
// atrapar la clase de errores que en esta app se paga cara: dependencias
// faltantes en los 237 `useEffect`, hooks llamados condicionalmente, y
// variables muertas que quedan tras un refactor. Todo lo cosmético va apagado
// para que `npm run lint` sea señal y no ruido.
export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // No usamos PropTypes en el proyecto; validar props es trabajo de otra
      // herramienta (JSDoc/TS) si algún día se adopta.
      'react/prop-types': 'off',
      // Muchas pantallas escapan comillas y apóstrofes en texto en español.
      // Que un `¿Estás seguro?` obligue a `&aacute;` no aporta nada.
      'react/no-unescaped-entities': 'off',

      // La regla que justifica tener ESLint aquí. Se queda en `error` porque
      // sus violaciones no son cuestión de estilo: un hook bajo un `return`
      // anticipado hace que React aborte la pantalla en cuanto cambia el
      // conteo de hooks entre dos renders. Encontró exactamente eso en
      // HorasMovil (crash confirmado) e InventarioDashboard (latente).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── Reglas del React Compiler (eslint-plugin-react-hooks v7) ──────────
      // Son nuevas y bastante más estrictas que las clásicas: analizan pureza
      // del render, mutaciones e identidad de componentes. Sobre este código
      // levantan ~130 avisos, la mayoría patrones deliberados (un `Date.now()`
      // para calcular `isStale`, `window.location.href` para navegar). No son
      // falsos positivos exactamente —describen lo que el compilador necesita
      // para poder memoizar— pero limpiarlos es una campaña aparte, no un
      // requisito para mergear. En `warn` quedan visibles sin bloquear el CI.
      // Si algún día se adopta el React Compiler, subirlas a `error` es el
      // primer paso.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',

      // Cuestión de limpieza, no de corrección.
      'no-useless-assignment': 'warn',

      // Fast Refresh deja de funcionar si un archivo exporta componentes y
      // otras cosas mezcladas. Aviso, no error: hay archivos donde conviene.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // `catch {}` vacío es un patrón deliberado y frecuente en este código
      // (limpieza best-effort); lo demás sí debe usarse.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Tests: añaden los globals de Vitest.
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },

  // Archivos de configuración y scripts: corren en Node, no en el navegador.
  {
    files: ['*.config.js', 'vite.config.js', 'vitest.config.js', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
