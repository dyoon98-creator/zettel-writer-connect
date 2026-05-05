# AI 원고실 (Tauri 데스크톱 앱) — Claude 작업 규칙

## 1. 빌드 후 반드시 `/Applications/AI 원고실.app` 도 교체할 것 (HARD)

**옵시디언 플러그인 → deep link `ai-manuscript-studio://...` → LaunchServices → `/Applications/AI 원고실.app` 호출**

이 흐름이라 production .app 을 모노레포 안에서 빌드만 하고 끝내면 옵시디언 버튼은 **이전 버전 .app** 을 계속 호출한다. 사용자는 "수정 사항이 안 보인다"고 인식한다.

`pnpm tauri build` 후 *항상* 다음을 함께 실행:

```bash
osascript -e 'tell application "AI 원고실" to quit' 2>/dev/null
pkill -f "/Applications/AI 원고실.app" 2>/dev/null
rm -rf "/Applications/AI 원고실.app"
cp -R "apps/desktop/src-tauri/target/release/bundle/macos/AI 원고실.app" /Applications/
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "/Applications/AI 원고실.app"
```

이걸 한 단계라도 빠뜨리면 deep link 가 옛 앱을 호출해 모든 수정이 사용자에게 안 보인다. **빌드 = .app 생성 + /Applications 교체 + 재등록** 한 세트.

## 2. 빌드 후 사용자에게 보고할 때 반드시 명시

- 새 빌드된 시각 (`stat -f "%Sm" "/Applications/AI 원고실.app/Contents/MacOS/ai-manuscript-studio"`)
- 옛 위치 빌드 잔재 정리 여부 (`~/projects/...` 또는 다른 옛 빌드 폴더)
- LaunchServices 등록 갱신 결과 (`lsregister -f`)

이 셋이 모두 OK 표시되어야 "수정사항 반영" 이라고 말할 수 있다.

## 3. 옵시디언 플러그인 → deep link 흐름 검증 절차

옵시디언 "원고실 앱에서 열기" 버튼이 어느 .app 을 호출하는지 의심스러우면:

```bash
LSR=/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister
"$LSR" -dump 2>&1 | grep -B2 -A4 "claimed schemes:.*ai-manuscript-studio"
```

claim 한 .app 들의 path 와 빌드 시각을 비교해서 가장 우선시되는 게 최신인지 확인.

## 4. 디버그 진단

production `.app` 도 devtools 활성 (`tauri.conf.json` 의 `devtools: true`). `Cmd+Opt+I` 로 콘솔 열어 `[BinderPane drag]` / `[BinderPane drop]` 같은 로그 확인 가능.

## 5. 모노레포 위치

- 정식 위치: `/Users/futurewave/Documents/dev/ai-manuscript-studio/`
- 옛 위치 (사용 금지): `~/projects/ai-manuscript-studio/` (삭제됨)
- 옵시디언 플러그인 패키지: `packages/obsidian-plugin/` + `packages/zettel-connect/`
- 데스크톱 앱: `apps/desktop/`

옵시디언 볼트의 `.obsidian/plugins/ai-manuscript-studio` 와 `.../zettel-connect` 는 모두 모노레포 패키지를 가리키는 *symlink* — 코드는 한 곳(여기)에서만 편집한다.
