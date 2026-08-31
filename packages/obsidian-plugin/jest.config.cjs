// tsconfig.test.json 이 그대로 테스트 컴파일 설정의 정본이다.
// 여기서 더하는 것은 `jsx` 한 줄뿐 — 테스트가 React 컴포넌트(.tsx)를 import 하면
// tsconfig.test.json 에 jsx 가 없어 TS6142 ("--jsx is not set") 로 죽는다.
// ts-jest 의 `tsconfig` 옵션은 «파일 경로» 또는 «옵션 객체» 중 하나만 받으므로,
// 경로를 주면서 한 줄만 더할 수가 없다. 그래서 정본 파일을 읽어 그대로 펴고
// jsx 만 얹는다. tsconfig.test.json 을 고치면 여기에도 그대로 반영된다.
const { compilerOptions: testCompilerOptions } = require("./tsconfig.test.json");

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
        tsconfig: { ...testCompilerOptions, jsx: "react-jsx" },
        useESM: false,
      },
    ],
  },
};
