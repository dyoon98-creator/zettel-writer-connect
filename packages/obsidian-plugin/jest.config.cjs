/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^obsidian$": "<rootDir>/tests/__mocks__/obsidian.ts",
    "^@ai-manuscript-studio/core/browser$":
      "<rootDir>/../core/src/browser.ts",
    "^@ai-manuscript-studio/core/adapters$":
      "<rootDir>/../core/src/adapters/index.ts",
    "^@ai-manuscript-studio/core$": "<rootDir>/../core/src/browser.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        useESM: false,
      },
    ],
  },
};
