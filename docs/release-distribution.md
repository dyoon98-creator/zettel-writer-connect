# 배포·서명 가이드 (작성자용)

이 문서는 **작가님(futurewave)이 직접 진행해야 하는 외부 자원 단계**를 모은 출시 가이드입니다. 코드는 모두 준비되어 있고, 외부 계정/인증서/결제 시스템만 연결하면 정식 출시가 가능합니다.

---

## 0. 현재 상태 (2026-04-28)

코드/빌드 상태:
- ✅ macOS arm64 `.dmg` (2.2 MB), `.app` (4.6 MB) 빌드 성공
- ✅ URL scheme `ai-manuscript-studio://` 시스템 등록 검증 완료
- ✅ 옵시디언 인덱서 (22 KB main.js) 볼트 배포 완료
- ✅ 282 tests 통과
- ⚠ 코드 사이닝 미완 — 첫 실행 시 사용자가 macOS Gatekeeper 우회 필요
- ⚠ Notarization 미완
- ⚠ Windows / Linux / Intel Mac 빌드 미완 — CI 또는 별도 머신 필요
- ⚠ 자동 업데이트 미완 — Tauri updater 매니페스트 호스팅 필요
- ⚠ 라이선스 키 발급 자동화 미완 — Lemon Squeezy/Stripe 연동 필요

---

## 1. macOS 코드 사이닝 + Notarization

### 비용
- Apple Developer Program: **$99/년**

### 절차
1. https://developer.apple.com 가입 후 Developer ID Application 인증서 발급
2. Keychain Access에 자동 등록됨
3. `~/projects/ai-manuscript-studio/apps/desktop/src-tauri/tauri.conf.json` 의 `bundle` 섹션에 추가:
   ```json
   "macOS": {
     "signingIdentity": "Developer ID Application: 작가 이름 (TEAMID)",
     "providerShortName": "TEAMID",
     "entitlements": null,
     "exceptionDomain": null
   }
   ```
4. 환경변수 설정 후 빌드:
   ```bash
   export APPLE_ID="<your-apple-id>"
   export APPLE_PASSWORD="<app-specific-password>"  # https://appleid.apple.com에서 생성
   export APPLE_TEAM_ID="<team-id>"
   pnpm --filter @ai-manuscript-studio/desktop tauri:build
   ```
5. Tauri가 자동으로 사이닝 + notarization staple 진행. 완료에 5–15분.

### 검증
```bash
codesign -dvv "/Applications/AI 원고실.app"   # Developer ID 표시되어야 함
spctl -a -vv "/Applications/AI 원고실.app"     # accepted: source=Notarized Developer ID
```

---

## 2. Windows 빌드 + 사이닝

### 비용
- Windows EV Code Signing Certificate: **$200–400/년** (DigiCert/Sectigo 등)
  - EV 없이 일반 OV(Organization Validation) 인증서로도 가능하지만, SmartScreen 평판 빌딩이 느림
- 빌드용 Windows 머신 (또는 GitHub Actions windows-latest)

### 절차
1. EV 인증서 발급 (HSM USB 토큰 형태로 배송)
2. Windows 머신에 토큰 연결
3. `tauri.conf.json` 에 추가:
   ```json
   "windows": {
     "certificateThumbprint": "<thumbprint>",
     "digestAlgorithm": "sha256",
     "timestampUrl": "http://timestamp.digicert.com"
   }
   ```
4. 해당 머신에서 `pnpm tauri:build --target x86_64-pc-windows-msvc`
5. 산출: `.msi` (Wix) + `.exe` (NSIS)

### CI 자동화 (권장)
GitHub Actions 워크플로 (`.github/workflows/release.yml`):
```yaml
strategy:
  matrix:
    include:
      - os: macos-14         # arm64
      - os: macos-13         # x86_64
      - os: windows-latest
      - os: ubuntu-22.04
```
환경 변수로 인증서 secrets 주입.

---

## 3. Linux 빌드 (.AppImage / .deb)

### 비용
무료 — 코드 사이닝 별도 없음 (.AppImage는 GPG 서명 권장 정도).

### 절차
Ubuntu 22.04 머신 또는 GitHub Actions ubuntu-latest:
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev
pnpm --filter @ai-manuscript-studio/desktop tauri:build
```

산출:
- `target/release/bundle/appimage/*.AppImage`
- `target/release/bundle/deb/*.deb`

GPG 서명 (선택):
```bash
gpg --detach-sign --armor "AI-원고실_0.0.1_amd64.AppImage"
```

---

## 4. 자동 업데이트 (Tauri Updater)

### 인프라
- HTTPS 호스팅 (예: GitHub Releases — 무료, 또는 Cloudflare R2)
- 매니페스트 JSON 파일: 최신 버전 정보, 다운로드 URL, 서명

### 절차
1. 업데이터 키 페어 생성:
   ```bash
   pnpm tauri signer generate -w ~/.tauri/myapp.key
   # public key가 출력됨 — tauri.conf.json에 박아 둠
   ```
2. `tauri.conf.json` 에 추가:
   ```json
   "plugins": {
     "updater": {
       "endpoints": ["https://github.com/futurewave/ai-manuscript-studio/releases/latest/download/latest.json"],
       "pubkey": "<base64 public key>"
     }
   }
   ```
3. `Cargo.toml` 에 `tauri-plugin-updater = "2"` 추가
4. `main.rs` 에 `.plugin(tauri_plugin_updater::Builder::new().build())` 추가
5. 빌드 시 환경변수 `TAURI_PRIVATE_KEY="$(cat ~/.tauri/myapp.key)"` 주입 → 매니페스트 자동 서명
6. GitHub Releases에 `latest.json` + 빌드 산출물 업로드

### 매니페스트 형식
```json
{
  "version": "0.0.2",
  "notes": "버그 수정",
  "pub_date": "2026-05-01T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<base64 sig>",
      "url": "https://github.com/.../AI 원고실_0.0.2_aarch64.dmg"
    },
    "darwin-x86_64": { ... },
    "windows-x86_64": { ... },
    "linux-x86_64": { ... }
  }
}
```

---

## 5. 라이선스 키 발급 자동화 (유료 스킬팩)

### 결제 플랫폼 옵션

| | Lemon Squeezy | Stripe |
|---|---|---|
| 시작 비용 | $0 | $0 |
| 거래 수수료 | 5%+50¢ (Merchant of Record — 부가세·환불 처리 대신 해줌) | 2.9%+30¢ (직접 부가세·환불 책임) |
| API | REST + webhooks | REST + webhooks |
| 한국에서 사용 | OK (US LLC도 OK) | 한국 사업자 등록 필요 |
| 권장 | ★ 작가/소규모 인디 | 큰 트래픽 + 정밀 통제 |

추천: **Lemon Squeezy** (개인 인디 작가에게 부담 적음).

### 발급 흐름 (Lemon Squeezy 기준)

1. lemonsqueezy.com 가입 → Store 생성 → Product "Writer Starter Pack" 등록 (가격 $39 등)
2. **Webhook URL** 설정: 결제 완료 이벤트(`order_created`)를 받을 엔드포인트
3. 작은 Cloudflare Workers 또는 Netlify Function 서버:
   ```ts
   // pseudo
   on POST /webhook (event):
     verify hmac signature
     if event.type == "order_created":
       userKey = generateRandomKey(16)
       checksum = HMAC-SHA256(userKey, "futurewave")  // ← LicenseChecker가 검증
       sendEmail(event.customer.email, key=userKey, downloadUrl="...")
       db.insert({ userKey, customerId, productId, issuedAt })
   ```
4. 사용자에게 메일로 키 + 스킬팩 zip 다운로드 링크 전송
5. 사용자는 zip을 `<vault>/_skillpacks/`에 풀고, 데스크톱 앱 설정에 키 입력

### 키 무효화/환불 처리
honor system이라 적극 무효화는 불가능. 대신:
- 신규 발급은 막을 수 있음
- 향후 메이저 버전(v0.1.0)에서 발급자 ID 변경 → 구버전 키 자동 만료 (회원에게 무료 재발급)

---

## 6. 옵시디언 커뮤니티 스토어 제출 (인덱서)

### 절차
1. GitHub에 별도 공개 저장소 (`futurewave/obsidian-ai-manuscript-studio` 같은 이름)
2. `packages/obsidian-plugin/` 의 산출물(`main.js`, `manifest.json`, `styles.css`) + `README.md` 만 푸시 (소스는 모노레포에 두고 산출물만 제출)
3. release 태그 생성 (`v0.0.2`)
4. https://github.com/obsidianmd/obsidian-releases 의 `community-plugins.json` 에 PR:
   ```json
   {
     "id": "ai-manuscript-studio",
     "name": "AI 원고실",
     "author": "futurewave",
     "description": "원고 프로젝트 인덱서. 깊은 작업은 별도 데스크톱 앱.",
     "repo": "futurewave/obsidian-ai-manuscript-studio"
   }
   ```
5. Obsidian 팀 리뷰 (보통 1–4주). 이번 인덱서는 `child_process` 미사용 + 외부 통신 없음이라 통과 가능성 높음.

---

## 7. 랜딩 페이지

추천: **Astro** 정적 사이트 + Cloudflare Pages 호스팅 (무료).

내용:
- 한 줄 카피: "AI가 대신 쓰지 않습니다. 작가가 끝까지 쓰게 만듭니다."
- 스크린샷: Scrivener 3-pane, 마법사 채팅, AI 액션 스트리밍
- 가격: 무료 (앱 + 인덱서) + 유료 스킬팩별
- 다운로드 링크: macOS / Windows / Linux
- 옵시디언 플러그인: "Community Plugins → AI 원고실"

---

## 8. 우선순위 권장 순서

1. **Apple Developer ID + macOS notarization** ($99/년) — 첫 실수 우회, 가장 효과 큼
2. **GitHub Releases 자동 업데이트 매니페스트** (무료) — 사용자 수 적을 때 미리 깔아두면 미래 업데이트 폭탄 없음
3. **옵시디언 커뮤니티 스토어 제출** (무료) — 인덱서가 등록되면 사람들이 자연스럽게 만남
4. **Lemon Squeezy + Writer Starter Pack 판매** — 첫 매출 사이클 검증
5. Windows EV cert ($200–400/년) — Windows 사용자 비중 보면서 결정
6. CI 자동화 — 빌드를 매번 수동으로 안 하려면 필수

---

## 부록: 현재 산출물 위치

```
~/projects/ai-manuscript-studio/dist/
├─ macos/
│  └─ AI 원고실_0.0.1_aarch64.dmg     (2.2 MB, sha256: e864ad28...)
└─ obsidian-plugin/
   ├─ manifest.json
   ├─ main.js                          (22 KB, sha256: f400c422...)
   └─ styles.css
```

이미 `<vault>/.obsidian/plugins/ai-manuscript-studio/` 에 인덱서가 배포되어 있고, `/Applications/AI 원고실.app` 에 데스크톱 앱이 설치되어 deep-link이 작동 중입니다.
