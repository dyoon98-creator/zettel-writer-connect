// ambient.d.ts — esbuild raw-loader 로 들어오는 .md?raw 모듈을 TS 에 알린다.

declare module "*.md?raw" {
  const content: string;
  export default content;
}
