const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = [
  ...expoConfig,
  {
    files: ["jest.setup.js"],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".expo/**"],
  },
];
