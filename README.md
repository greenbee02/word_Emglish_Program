# Word Garden

영단어 학습 웹 앱입니다. Vite 프론트엔드, Node.js API, PostgreSQL 데이터베이스로 구성됩니다.

## 프로젝트 구조

```text
frontend/   Vite 웹 앱 (Vercel)
backend/    Node.js REST API (Render)
render.yaml Render Web Service + PostgreSQL Blueprint
```

## 로컬 실행

### 백엔드

```powershell
cd backend
npm install
$env:DATABASE_URL='postgresql://user:password@localhost:5432/word_garden'
$env:FRONTEND_ORIGIN='http://localhost:5173'
npm start
```

서버 시작 시 `app_state` 테이블이 자동 생성됩니다.

### 프론트엔드

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

`VITE_API_URL`은 백엔드 주소를 가리켜야 합니다. API 서버에 연결할 수 없으면 브라우저 `localStorage`를 임시 저장소로 계속 사용합니다.

## 배포

### Render

저장소 루트의 `render.yaml`로 Blueprint를 생성합니다. 배포 후 `FRONTEND_ORIGIN`을 실제 Vercel 주소로 지정합니다.

### Vercel

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_API_URL=https://<render-service>.onrender.com`

## 테스트

```powershell
cd frontend
npm test
npm run build

cd ..\backend
npm test
```
