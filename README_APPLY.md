# 통합 아키텍처 B형 레이아웃 적용

현재 `ydh1121/indiadesk-business-hub`의 `main` 브랜치를 기준으로 작성했습니다.

## 변경 내용

- 좌측: 세로형 계층 트리
- 우측: 선택 노드 상세 패널
- 모바일: 트리 위, 상세 아래 배치
- 기존 계정별 `architecture:<resource_key>` 공개 범위 유지
- Google Sheets `Architecture` 탭의 기존 5열 구조 유지
- 기존 최상위 키 `step-01`~`step-07` 유지
- 세부 노드는 `step-01/feed-press`와 같은 하위 키로 추가

## 적용

저장소 루트에 이 패치 파일과 `public` 폴더를 둔 뒤:

```powershell
git pull --rebase origin main

git apply --check .\indiadesk-architecture-b-layout.patch
git apply .\indiadesk-architecture-b-layout.patch

node --check .\public\assets\architecture-ui.js
node --check .\public\assets\app.js
npm run check

git add public
git commit -m "Add hierarchical integrated architecture workspace"
git push origin main
```

패치 적용 대신 다음 두 파일을 직접 업로드해도 됩니다.

- `public/assets/architecture-ui.js`
- `public/assets/architecture.css`

직접 업로드 방식에서는 `public/index.html`과 `public/assets/app.js`에 패치의 수정 부분을 별도로 반영해야 합니다.

## Google Sheets

`Architecture_Sheet_Data.tsv`는 운영 Google Sheets의 `Architecture!A1:E`에 반영하는 데이터입니다.

열 구조:

```text
resource_key | step_number | title | description | sort_order
```

기존 공개 범위를 저장한 Guest는 새 하위 노드가 기본 비공개입니다. Admin의 `공개 범위`에서 필요한 하위 노드를 체크하면 됩니다.
