# Word Garden

영단어 학습 웹 앱입니다. Vite 프론트엔드는 Vercel, Node.js API는 Render, PostgreSQL과 이메일 인증은 Supabase를 사용합니다. 로그인하지 않으면 기기에만 저장하고, 로그인하면 검증된 사용자별로 서버에 저장합니다.

**로그인 도입 작업 중입니다. 운영 적용 전 [사용자 설정 안내](docs/USER_SETUP.md)와 [단계별 진행 현황](PROJECT_STATUS.md)을 먼저 확인하세요.** 기존 공통 API와 새 인증 API는 호환되지 않으므로 바로 main에 병합하지 않고 별도 환경에서 테스트합니다.

## 프로젝트 구조

```text
frontend/   Vite 웹 앱 (Vercel)
backend/    Node.js REST API (Render)
render.yaml Render Web Service + PostgreSQL Blueprint
deploy/     Supabase를 사용하는 새 테스트 Render 서비스 설정
docs/       백업·인증·테스트·배포 사용자 안내
```

## 배포

이미 연동된 Vercel·Render·Supabase를 그대로 업데이트할 때는 [기존 서비스 업데이트 안내](docs/EXISTING_DEPLOYMENT.md)를 따릅니다.

Vercel·Render·Supabase 설정은 [클라우드 설정 안내](docs/USER_SETUP.md)의 서비스별 표를 따릅니다. Vercel의 `VITE_API_URL`은 실제 Render HTTPS 주소입니다. 저장소의 `.env.example`은 PC 실행용이며 클라우드 대시보드에 그대로 복사하지 않습니다.

### Render

기존 `render.yaml`은 Render 자체 DB를 만들던 이전 설정입니다. Supabase를 쓰는 새 테스트 서비스는 `deploy/render.supabase.yaml`을 참고하고, 운영 Blueprint에는 그대로 적용하지 마세요. Root Directory는 `backend`, 빌드는 `npm ci --omit=dev`, 시작은 `npm start`입니다. DB 연결·인증·허용 주소 설정과 테이블 준비가 필요합니다.

### Vercel

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_API_URL=https://<render-service>.onrender.com`
- Environment Variables: 같은 Supabase 프로젝트의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Preview는 테스트 API·테스트 DB에, Production은 운영 API·운영 DB에 연결합니다.

## PC에서 개발 서버를 실행하는 경우

[PC 로컬 실행 안내](docs/LOCAL_DEVELOPMENT.md)를 따릅니다. 백엔드도 같은 PC에서 실행할 때에만 API 주소로 로컬 주소를 사용합니다. 화면만 PC에서 실행하고 백엔드는 Render를 사용하면 실제 Render 주소를 넣습니다.

## 테스트

```powershell
cd frontend
npm test
npm run build

cd ..\backend
npm test
```

백엔드 DB 테스트는 PGlite의 독립 PostgreSQL 엔진에서 실행하며 운영 DB 연결이 필요하지 않습니다. GitHub Actions도 같은 테스트와 프론트엔드 빌드를 실행합니다.

## 코드 역할

- `frontend/src/layout.js`: 메뉴와 계정 상태를 포함한 공통 화면
- `frontend/src/account-view.js`: 가입·로그인·비밀번호 재설정 화면
- `frontend/src/auth.js`: Supabase 세션 관리
- `frontend/src/sync.js`: 사용자별 캐시·저장 순서·버전 충돌·계정 전환 취소
- `frontend/src/main.js`: 단어장과 학습 화면
- `frontend/src/theme.css`: 밝은 녹색·보라색 테마와 모바일 배치
- `backend/src/auth.js`: Supabase Auth 서버를 통한 토큰 검증
- `backend/src/database.js`: 사용자 ID로 제한한 조회·버전 일치 시에만 저장
- `backend/scripts/backup.js`: 앱 데이터 테이블의 읽기 전용 JSON 백업

## 데이터 이전

기존 기기 데이터는 로그인 후 빈 계정에서 명시적으로 가져옵니다. 서버의 공통 `app_state`는 자동으로 특정 사용자에게 배정하지 않습니다. 소유자가 백업을 확인하고 자신의 계정으로 복원해야 합니다. 백업과 비밀 환경변수는 GitHub에 업로드하지 않습니다.
