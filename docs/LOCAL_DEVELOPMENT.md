# PC 로컬 실행 안내

이 문서는 내 컴퓨터에서 개발 서버를 실행할 때만 사용합니다. Vercel·Render 대시보드 설정은 [클라우드 설정 안내](USER_SETUP.md)를 사용하세요.

## 실행 위치에 따른 API 주소

| 화면 실행 위치 | 백엔드 실행 위치 | 프론트엔드의 VITE_API_URL |
| --- | --- | --- |
| Vercel | Render | 해당 Render 서비스의 실제 HTTPS 주소 |
| 내 PC | Render | 해당 Render 서비스의 실제 HTTPS 주소 |
| 내 PC | 같은 PC의 Node 서버 | 아래 로컬 예시의 `http://localhost:3000` |

프론트엔드만 PC에서 실행한다고 API 주소가 로컬 주소로 바뀌는 것은 아닙니다. `localhost`는 백엔드도 같은 PC에서 실행할 때 사용합니다. 이 문서의 Supabase는 인터넷에 있는 테스트 프로젝트를 사용합니다.

## 준비

- Node.js 22.12 이상을 사용합니다.
- 기준 폴더는 `C:\Word(English)Program`입니다.
- 테스트 Supabase의 프로젝트 URL·공개용 키·DB 연결 문자열을 준비합니다.
- 테스트 프로젝트에서 `backend/migrations/001_user_state.sql`을 먼저 적용합니다.
- 아래 명령은 PowerShell에서 한 줄씩 실행합니다. `.env`가 이미 있으면 복사하지 않고 기존 파일을 편집합니다.

## 백엔드를 PC에서 실행

```powershell
Set-Location -LiteralPath 'C:\Word(English)Program\backend'
npm ci
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

`backend\.env`에 아래 값을 입력합니다. **이 표의 주소와 포트는 PC 실행용입니다. Render에 복사하지 않습니다.**

| 환경변수 이름 | PC 백엔드에 넣을 값 |
| --- | --- |
| `DATABASE_URL` | 테스트 Supabase의 실제 PostgreSQL 연결 문자열 |
| `SUPABASE_URL` | 같은 테스트 프로젝트의 실제 HTTPS 프로젝트 URL |
| `SUPABASE_PUBLISHABLE_KEY` | 같은 테스트 프로젝트의 공개용 키 |
| `FRONTEND_ORIGIN` | PC 프론트엔드의 `http://localhost:5173` |
| `DB_SSL` | 원격 Supabase 연결이므로 `true` |
| `DB_SSL_CA` | 해당 DB의 CA 인증서가 필요한 경우에만 설정 |
| `AUTO_MIGRATE` | SQL을 먼저 적용했다면 `false` |
| `PORT` | 이 PC 예시에서는 `3000` |

```powershell
npm run dev
```

백엔드가 실행 중인 PowerShell 창을 그대로 둡니다. 이 명령은 코드 변경 시 Node 서버를 다시 시작합니다. SQL을 아직 적용하지 않았다면 테스트 DB를 가리키는지 확인하고 `npm run migrate`를 먼저 실행할 수 있습니다.

## 프론트엔드를 PC에서 실행

새 PowerShell 창에서 실행합니다.

```powershell
Set-Location -LiteralPath 'C:\Word(English)Program\frontend'
npm ci
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

`frontend\.env`에 아래 값을 입력합니다.

| 환경변수 이름 | PC 프론트엔드에 넣을 값 |
| --- | --- |
| `VITE_API_URL` | 위에서 같은 PC의 백엔드를 실행했을 때만 `http://localhost:3000` |
| `VITE_SUPABASE_URL` | 백엔드와 같은 테스트 Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 같은 테스트 프로젝트의 공개용 키 |

PC 백엔드를 실행하지 않고 Render 테스트 API에 연결할 계획이라면 `VITE_API_URL`에 그 Render 서비스의 실제 HTTPS 주소를 넣습니다. 이 경우 Render의 `FRONTEND_ORIGIN`에도 현재 PC 화면의 origin을 허용하고 Render를 재배포해야 합니다.

```powershell
npm run dev
```

터미널에 표시된 화면 주소를 브라우저에서 엽니다. 위 기본 실행 명령의 화면은 `http://localhost:5173`이며, 백엔드는 별도의 `3000` 포트입니다.

## 로컬 이메일 인증의 복귀 주소

테스트 Supabase의 Authentication → URL Configuration → Redirect URLs에 PC에서 실제 쓰는 두 주소를 등록합니다.

```text
http://localhost:5173/
http://localhost:5173/?recovery=1
```

주소창에서 `127.0.0.1`을 쓰거나 포트를 바꿨다면 실제 화면 주소로 바꾸고, 백엔드의 `FRONTEND_ORIGIN`도 맞춥니다. Site URL은 같은 테스트 프로젝트에 연결된 클라우드 테스트 화면을 유지해도 되며, 로컬에서 요청하는 복귀 주소는 Redirect URLs로 별도 허용합니다.

`.env` 변경 후 프론트엔드와 백엔드 개발 서버를 다시 시작합니다. 프론트엔드 인증 설정이 비어 있으면 게스트 모드로 실행하고 서버로 학습 데이터를 보내지 않습니다.

## 자동 테스트

자동 테스트에는 운영 DB 주소나 실제 계정이 필요하지 않습니다. 각 폴더에서 실행합니다.

```powershell
Set-Location -LiteralPath 'C:\Word(English)Program\frontend'
npm test
npm run build
Set-Location -LiteralPath 'C:\Word(English)Program\backend'
npm test
```

## 원격 DB의 앱 데이터 백업

이 절은 PC에서 백업 명령만 실행하는 선택 사항입니다. 프론트엔드나 PC API 서버를 켤 필요는 없습니다.

1. `backend` 폴더에서 `npm ci`를 실행합니다.
2. `backend\.env.backup`이라는 별도 파일을 메모장으로 만듭니다. 테스트 실행용 `.env`를 운영 DB 값으로 덮어쓰지 않습니다.
3. 다음 항목을 넣고, `DATABASE_URL`의 빈칸에는 **백업할 Supabase DB의 실제 연결 문자열**을 입력합니다.

```env
DATABASE_URL=
DB_SSL=true
DB_SSL_CA=
```

프로젝트의 DB 비밀번호가 반영된 연결 문자열을 사용합니다. 비밀번호의 특수문자는 연결 문자열에서 URL 인코딩이 필요할 수 있습니다. SSL 인증서 검증 오류가 나면 해당 DB의 CA 인증서를 확인해 `DB_SSL_CA`에 넣습니다. PEM 줄바꿈을 `\n`으로 작성할 수 있습니다.

4. 아래 명령을 실행합니다. 별도 백업 파일을 읽도록 `npm run backup` 대신 파일 경로를 명시한 Node 명령을 사용합니다.

```powershell
Set-Location -LiteralPath 'C:\Word(English)Program\backend'
node --env-file=.env.backup scripts/backup.js
```

5. 완료 메시지와 테이블별 행 개수를 확인합니다. 기준 폴더의 `.backups`에 만들어진 JSON을 별도의 안전한 위치에도 보관합니다.

이 명령은 앱 데이터 테이블을 읽기 전용으로 백업합니다. 테이블 생성·데이터 수정은 하지 않으며, 스키마·Supabase 인증 사용자·파일 저장소를 포함한 전체 프로젝트 백업은 아닙니다. `.env.backup`, `.env`, `.backups`는 Git 업로드 대상에서 제외됩니다.
