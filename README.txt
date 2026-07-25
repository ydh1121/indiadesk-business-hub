적용 경로
public/assets/markdown.js

기존 파일을 이 파일로 완전히 교체합니다.

검사
node --check public/assets/markdown.js

커밋
git add public/assets/markdown.js
git commit -m "Fix Google Docs markdown rendering in Version 3"
git push origin main

수정 내용
- Google Docs 내보내기 이스케이프 제거: \\[, \\], \\., \\_, \\+, \\~ 등
- 1\\. 형식 번호 목록 정상 인식
- 줄바꿈된 Markdown 표 행 자동 병합
- 빈 제목 행(## 등) 제거
- 연속 빈 줄 과도한 간격 축약
