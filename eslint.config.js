// Eslint configuration object for src
const configSrc = {
  files: [
    "src/*",
    "tests/*"
  ],
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
  rules: {
    "no-console": "warn",
    "eqeqeq": ["error", "always"],
    "no-const-assign": "error",
    "max-depth": ["warn", 4],
    "max-lines": ["warn", 500],
    "max-lines-per-function": ["warn", {"max": 100}],
    "no-else-return": ["error", {allowElseIf: false}],
    "no-plusplus": [
      "error",
      {
        "allowForLoopAfterthoughts": true
      }
    ],
    "array-callback-return": [
      "error",
      {
        "checkForEach": false
      }
    ],
    "no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "next"
      }
    ],
    "no-warning-comments": "off"
  }
};

// Eslint configuration object for globally ignoring .js files
// - ignore all files that start with a dot
// - ignore all files inside directories named 'dist'
const configIgnores = {
  ignores: [
    "**/.*",
    "**/dist/"
  ]
};

export default [
  configSrc,
  configIgnores
];