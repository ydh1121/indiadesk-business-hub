# India Business Partner Hub - Cloudflare Pages 배포

## 1. 구성

- 정적 UI: `public/`
- Cloudflare Pages Functions API: `functions/`
- 운영 DB: Google Sheets `인도진출_플랫폼_운영DB`
- 게스트 제한: PC 1대 + 모바일 1대
- Admin: 기기 제한 없음
- 접속기록: IP, 국가, 도시, Cloudflare colo, 디바이스, OS, 브라우저, 로그인 성공·실패 사유
- 문서 다운로드: 로그인 세션을 검증하는 `/downloads/*` Pages Function을 거쳐 PDF·DOCX 제공

## 2. 비밀번호 처리

비밀번호는 암호화 후 복호화하지 않습니다. `PBKDF2-SHA256 + 개별 Salt + 120,000 iterations`로 해시를 저장하고 로그인 시 같은 방식으로 계산해 비교합니다. 복호화 가능한 비밀번호 저장보다 안전한 구조입니다. 세션은 HMAC 서명 쿠키로 검증합니다.

## 3. Google Cloud 준비

1. Google Cloud 프로젝트에서 Google Sheets API를 활성화합니다.
2. 서비스 계정을 만들고 JSON 키를 발급합니다.
3. 운영 스프레드시트를 서비스 계정 이메일에 `편집자`로 공유합니다.
4. JSON 키의 `client_email`과 `private_key`를 Cloudflare Secret으로 등록합니다.

## 4. Cloudflare Pages 배포

### Git 연동

1. 이 폴더를 GitHub 저장소에 업로드합니다.
2. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git을 선택합니다.
3. Build command는 비워두고, Build output directory는 `public`으로 설정합니다.
4. Pages Functions는 저장소의 `/functions` 폴더를 자동 인식합니다.

### Direct Upload / Wrangler

```bash
npm install
npx wrangler login
npm run deploy
```

## 5. 환경변수와 Secret

Cloudflare Pages > Settings > Variables and Secrets에 다음을 등록합니다.

- `GOOGLE_SHEET_ID` = `1gSQkpcyP5BQwhdFqAhQEJoSEStywDnyGByb6Xy6jJso`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` = 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY` = JSON 키의 private_key 전체
- `SESSION_SECRET` = 32바이트 이상의 무작위 문자열
- `BOOTSTRAP_SECRET` = 최초 Admin 설정용 긴 무작위 문자열
- `SESSION_TTL_SECONDS` = `43200`

`GOOGLE_PRIVATE_KEY`, `SESSION_SECRET`, `BOOTSTRAP_SECRET`는 반드시 Secret으로 등록합니다.

## 6. 최초 설정

1. 배포된 사이트 로그인 화면에서 `관리자 최초 설정`을 선택합니다.
2. Cloudflare에 등록한 `BOOTSTRAP_SECRET`과 Admin 비밀번호를 입력합니다.
3. Admin으로 로그인합니다.
4. 관리자 > 계정에서 `kimjinseong`, `edward`, `moon`, `indiabizs`, `turmeric`, `kwon`의 비밀번호를 설정합니다.
5. 사업계획서 화면에서 `기본 내용 시트에 초기화`를 실행합니다.

## 7. 디바이스 정책

- `BLOCK`: PC 또는 모바일 등록 한도를 초과하면 로그인 차단
- `REPLACE`: 같은 분류의 기존 활성기기를 해제하고 새 기기 허용
- `ALLOW`: 제한을 초과해도 허용

기본 게스트 정책은 PC 1대, 모바일 1대, `BLOCK`입니다. Admin은 제한이 없습니다. 등록 기기는 서버가 발급하고 서명한 HttpOnly 기기 쿠키로 식별합니다. 브라우저 쿠키를 삭제하거나 별도 브라우저 프로필을 사용하면 새 기기로 인식되므로 Admin이 기존 기기를 해제하거나 `REPLACE`를 임시 적용합니다.

## 8. Google Sheets의 운영 한계

관계자 소수 사용에는 적합하지만 대규모 동시접속·복잡한 검색·대량 감사로그에는 적합하지 않습니다. 계정 또는 기업 데이터가 늘어나면 인증·세션·프로젝트 DB는 Cloudflare D1 또는 Supabase로 이전하고, Google Sheets는 운영자가 보는 관리·내보내기 용도로 유지합니다.

## 9. 다운로드 보호

`/downloads/*` 요청은 로그인 세션을 확인한 뒤 Pages의 정적 자산을 반환합니다. Admin과 Guest만 다운로드할 수 있으며, 캐시는 비활성화됩니다. 파일명 자체가 외부에 알려져도 유효한 세션이 없으면 내려받을 수 없습니다.

## 10. 보안 운영

- Sheets와 서비스 계정 키는 외부에 공개하지 않습니다.
- 주기적으로 Accounts·Devices·AccessLogs·Content·Documents·AuditLogs를 백업합니다.
- Admin 계정은 강한 비밀번호를 사용하고 공유하지 않습니다.
- 서비스 계정 키와 세션 Secret은 저장소에 넣지 않고 Cloudflare Secret으로만 관리합니다.
- 민감도가 더 높아지면 PDF/DOCX 원본은 Cloudflare R2 비공개 버킷으로 이전하고 짧은 만료시간의 서명 URL을 적용합니다.
