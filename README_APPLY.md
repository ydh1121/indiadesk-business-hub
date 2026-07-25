# 계정별 메뉴·콘텐츠 공개 범위 적용

## 반영 범위

Admin 계정은 제한하지 않는다.

Admin을 제외한 계정별로 다음 항목을 체크박스로 공개하거나 숨길 수 있다.

- 상위 메뉴: 사업계획서, 통합 아키텍처, 문서 다운로드
- 사업계획서 하위 탭: Version 1, Version 2, Version 3 및 향후 추가 버전
- 사업계획서 세부 카드: Content 탭의 page_key + section_key 단위
- 통합 아키텍처 단계: Architecture 탭의 각 단계
- 문서 다운로드 카드와 실제 `/downloads/...` 파일 접근

화면에서만 숨기는 방식이 아니다.

- `/api/content`에서 허용된 사업계획서 본문만 반환
- `/api/documents`에서 허용된 문서만 반환
- `/api/architecture`에서 허용된 단계만 반환
- `/downloads/...` 요청에서도 문서 권한을 다시 확인

## Google Sheets

현재 운영 시트에는 다음 탭을 추가했다.

### Permissions

| 열 | 값 |
| --- | --- |
| A | username |
| B | resource_type |
| C | resource_key |
| D | allowed |
| E | updated_at |
| F | updated_by |

계정별 공개 범위를 Admin 화면에서 저장하면 자동으로 기록된다.

### Architecture

| 열 | 값 |
| --- | --- |
| A | resource_key |
| B | step_number |
| C | title |
| D | description |
| E | sort_order |

기존에 `app.js`에 하드코딩돼 있던 통합 아키텍처 내용을 시트로 옮긴 구조다.

## 기존 계정 잠금 방지

공개 범위를 한 번도 저장하지 않은 기존 Guest 계정은 배포 직후 기존처럼 전체 항목을 볼 수 있다.

Admin이 해당 계정의 `공개 범위`를 한 번 저장한 시점부터 체크된 항목만 공개된다.

공개 범위가 설정된 계정에서는 이후 새로 추가되는 사업계획서 섹션, 문서, 아키텍처 항목이 기본 비공개다. Admin이 다시 체크해야 공개된다.

## 적용 방법 1: 파일 덮어쓰기

압축파일을 저장소 루트에 풀어 `functions`, `public` 폴더를 덮어쓴다.

```powershell
git pull --rebase origin main

# 압축을 별도 폴더에 풀었다면
Copy-Item -Recurse -Force .\Indiadesk_Account_Access_Control\functions .\
Copy-Item -Recurse -Force .\Indiadesk_Account_Access_Control\public .\

npm run check

git add functions public
git commit -m "Add per-account content access control"
git push origin main
```

## 적용 방법 2: 패치 적용

```powershell
git pull --rebase origin main

git apply --check .\indiadesk-account-access-control.patch
git apply .\indiadesk-account-access-control.patch

npm run check

git add functions public
git commit -m "Add per-account content access control"
git push origin main
```

## 사용 방법

1. Admin 로그인
2. 왼쪽 `관리자`
3. 계정 표에서 Guest 계정의 `공개 범위`
4. 메뉴, 버전, 세부 내용, 아키텍처, 문서를 체크
5. `공개 범위 저장`
6. 대상 사용자는 새로고침 또는 재로그인

하위 항목을 선택하면 상위 메뉴와 버전이 자동으로 선택된다.
상위 항목을 해제하면 그 아래 항목도 함께 해제된다.

## 주의사항

- 외부 Google Drive URL 등 `/downloads/...`가 아닌 외부 링크는 이 서버의 다운로드 권한 검사를 거치지 않는다. 민감한 문서는 로컬 `/downloads/영문파일명.pdf` 경로 또는 별도 비공개 저장소를 사용해야 한다.
- GitHub 저장소가 Public이면 저장소 코드 자체는 누구나 볼 수 있다. 이번 구조에서는 사업계획서 본문과 아키텍처 설명을 Google Sheets에서 불러오므로 코드에 민감한 본문을 새로 하드코딩하지 않는다.
- 권한 변경은 서버 API에서 즉시 적용된다. 대상 사용자의 메뉴 표시까지 바로 갱신하려면 새로고침 또는 재로그인이 필요하다.
