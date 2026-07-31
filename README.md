# Indiadesk 계정 관리 수정 패키지

## 수정 내용

1. 비밀번호 변경 실패 수정
   - PBKDF2 반복 횟수를 Cloudflare Workers 지원 범위인 100,000으로 고정
   - 기존/신규 계정 비밀번호 변경 시 동일 기준 적용

2. Google Sheets 빈 행 대응
   - Accounts 탭에 빈 행이 있어도 실제 행 번호를 유지
   - 신규 유저를 추가했다가 셀을 비우거나 행을 남겨둔 경우에도 다른 계정 행을 잘못 수정하지 않음

3. 관리자 신규 유저 추가
   - 관리자 화면 상단에 `신규 유저 추가` 버튼 추가
   - 계정명, 표시명, 초기 비밀번호, 상태, 기기 정책, PC/모바일 제한 설정
   - 신규 계정은 guest로 생성
   - 생성 직후 공개 범위 설정창 자동 표시
   - 공개 범위를 지정하기 전에는 모든 메뉴 비공개

4. 오류 표시 개선
   - 계정 생성과 비밀번호 변경 실패 시 브라우저 경고창으로 서버 오류 메시지 표시

## 교체 파일

- `functions/_shared/crypto.ts`
- `functions/_shared/data.ts`
- `functions/api/admin/accounts.ts`
- `public/assets/app.js`

## 이전 메모 기능 패키지를 아직 반영하지 않은 경우

이번 ZIP에는 아래 파일도 포함되어 있다.

- `public/index.html`
- `public/assets/notes.css`
- `functions/api/notes.ts`
- `functions/api/admin/notes.ts`

전체 ZIP의 폴더 구조를 유지해서 프로젝트 루트에 덮어쓰면 된다.

## 배포 후 확인

1. 관리자 로그인
2. 기존 계정의 비밀번호 변경
3. 해당 계정으로 로그인 확인
4. 관리자 → 신규 유저 추가
5. 신규 유저 생성 후 공개 범위 저장
6. 신규 유저 로그인 확인

Google Sheets에서 계정 행을 직접 추가하거나 셀만 비우는 방식은 앞으로 사용하지 않고 관리자 기능으로 처리하는 편이 안전하다.
