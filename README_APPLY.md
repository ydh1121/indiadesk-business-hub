# IndiaDesk Business Hub · Version 3 탭 적용

GitHub 저장소: `ydh1121/indiadesk-business-hub`
대상 브랜치: `main`

## 변경 파일

- `public/assets/app.js`
  - Google Sheets `Content`의 `pageKey`를 기준으로 사업계획서 탭을 동적으로 생성
  - `Settings.business_plan_tabs`의 JSON 순서와 표시명을 사용
  - 설정 API가 실패해도 Content에 `v3`가 존재하면 기본 탭 정의로 표시
- `functions/api/settings.ts`
  - 로그인 사용자에게 `Settings` 시트 값을 읽어주는 GET API 추가

## 적용 방법 A · 파일 교체

압축파일 안의 두 파일을 저장소의 같은 경로에 덮어쓴 뒤 아래 명령을 실행한다.

```powershell
cd C:\Users\Administrator\Downloads\indiadesk-business-hub

git pull --rebase origin main
git add public/assets/app.js functions/api/settings.ts
git commit -m "Add dynamic Version 3 business plan tab"
git push origin main
```

## 적용 방법 B · 패치 적용

`indiadesk-v3-tabs.patch`를 저장소 루트에 복사한 뒤 실행한다.

```powershell
cd C:\Users\Administrator\Downloads\indiadesk-business-hub

git pull --rebase origin main
git apply --check .\indiadesk-v3-tabs.patch
git apply .\indiadesk-v3-tabs.patch
npm run check
git add public/assets/app.js functions/api/settings.ts
git commit -m "Add dynamic Version 3 business plan tab"
git push origin main
```

## 배포 후 확인

Cloudflare Pages가 GitHub `main` 자동배포를 완료한 뒤 강력 새로고침한다.

- Windows Chrome: `Ctrl + Shift + R`
- 사업계획서 탭 순서:
  1. Version 1 · 기본사업
  2. Version 2 · 통합사업
  3. Version 3 · 실행 오더 데스크

Google Sheets `Settings` 탭의 `business_plan_tabs` 값을 바꾸면 다음 새로고침부터 탭 순서와 명칭이 반영된다.
