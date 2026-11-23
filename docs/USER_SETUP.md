# Vercel Render Supabase 설정 안내

이 문서는 **Vercel에 화면을 배포하고, Render에 API를 배포하며, Supabase를 DB와 인증으로 사용하는 경우**의 설정 순서입니다. PC에서 개발 서버를 켜는 과정은 필수가 아닙니다.

**Vercel의 `VITE_API_URL`에는 연결할 Render 서비스의 실제 HTTPS 주소를 넣습니다.** 테스트 배포도 실제 테스트 Render 주소를 사용합니다. `localhost`와 `127.0.0.1`은 이 문서의 클라우드 설정값으로 사용하지 않습니다.

내 컴퓨터에서만 프론트엔드와 백엔드를 실행하려면 별도 문서인 [PC 로컬 실행 안내](LOCAL_DEVELOPMENT.md)를 보세요. 저장소의 `.env.example`은 PC 실행용 양식이며, 클라우드 설정은 아래 서비스별 표를 사용합니다.

## 1 현재 운영 연결 확인과 백업

기준 작업 폴더는 `C:\Word(English)Program`, 작업 브랜치는 `codex/account-login-foundation`입니다. 내부 `word_Emglish_Program`은 별도 복제 폴더이므로 이번 변경은 최상위 폴더에서 관리합니다.

### 현재 배포 설정 기록

| 확인할 곳 | 기록할 내용 |
| --- | --- |
| Vercel 프로젝트 Settings | 연결 저장소, Production Branch, Root Directory `frontend` |
| Vercel Environment Variables | 현재 운영 `VITE_API_URL`과 Production 또는 Preview 적용 범위 |
| Render 서비스 Settings | 연결 저장소, 브랜치, Root Directory `backend`, Auto Deploy 설정 |
| Render 서비스 Environment | `DATABASE_URL`이 실제 어느 Supabase 프로젝트를 가리키는지 |

GitHub Desktop에서는 File → Add local repository에서 기준 작업 폴더를 선택합니다. 실제 운영 사이트 주소와 계정 설정은 사용자가 확인합니다.

### 기존 데이터 백업

1. 현재 운영 사이트의 설정 → 데이터 백업 → 백업 내려받기로 JSON 파일을 보관합니다.
2. 단어 개수와 최근 학습 기록을 메모합니다.
3. Supabase에서 기존 `app_state` 테이블 전체 행을 내보내고, 사용 가능한 프로젝트 DB 백업도 확인합니다.

화면에서 받은 JSON은 현재 화면에 있는 학습 데이터입니다. DB 스키마, 전체 인증 사용자, 파일 저장소까지 포함한 전체 프로젝트 백업은 아닙니다.

추가한 `npm run backup` 명령은 PC에서 원격 Supabase에 연결해 `app_state`와 `user_state` 행을 읽기 전용 트랜잭션으로 JSON에 보관합니다. 이 방법을 사용할 때만 [PC 안내의 백업 절](LOCAL_DEVELOPMENT.md#원격-db의-앱-데이터-백업)을 따릅니다. 운영 백업에 사용한 DB 주소를 테스트 환경 설정에 그대로 재사용하지 마세요.

## 2 테스트용 Supabase 준비

이 문서에서 테스트 환경은 **Vercel Preview + 별도 Render 테스트 서비스 + 별도 Supabase 테스트 프로젝트**를 뜻합니다. 테스트도 인터넷에 배포된 서비스끼리 연결합니다.

1. 테스트용 Supabase 프로젝트를 준비합니다. 새 리소스를 만들 때는 표시되는 요금과 한도를 확인합니다.
2. 테스트 프로젝트의 SQL Editor에 `backend/migrations/001_user_state.sql` 내용을 붙여 넣고 실행합니다.
3. Table Editor에서 `user_state`가 만들어졌는지 확인합니다.
4. Authentication에서 이메일·비밀번호 로그인과 이메일 확인을 켜고, 비밀번호 최소 길이를 8자 이상으로 설정합니다.
5. 다음 세 값을 해당 테스트 프로젝트에서 확인합니다.

| 이 문서에서 부르는 이름 | 복사할 곳과 의미 |
| --- | --- |
| Supabase 프로젝트 URL | 프로젝트의 Connect 또는 API 연결 안내에 표시되는 HTTPS 프로젝트 URL |
| Supabase 공개용 키 | Settings → API Keys의 Publishable key `sb_publishable_...` |
| Supabase DB 연결 문자열 | Connect의 PostgreSQL 연결 문자열에 해당 프로젝트 DB 비밀번호를 반영한 값 |

프로젝트 URL과 DB 연결 문자열은 서로 다릅니다. 프로젝트 URL은 인증 API 주소이고, DB 연결 문자열은 `postgresql://` 등으로 시작하는 서버용 DB 접속 정보입니다.

DB 접속 호스트와 사용자명은 Connect 화면에서 그대로 복사합니다. 직접 연결이 IPv6 문제로 실패하면 해당 프로젝트가 제공하는 Session pooler 연결을 확인합니다. 호스트를 프로젝트 이름으로 임의로 조합하지 않습니다. [Supabase DB 연결 문서](https://supabase.com/docs/guides/database/connecting-to-postgres)

새 테이블은 사용자별 저장용이며 기존 `app_state`는 변경하지 않습니다. 브라우저 직접 접근용 RLS 정책은 만들지 않습니다. Render가 로그인 토큰과 사용자 소유권을 검사하고 DB에 접근하므로, 서버 DB 연결은 테이블 소유자 등 이 구조에 맞는 신뢰된 계정을 사용해야 합니다.

## 3 테스트 화면과 Render 주소 확보

### 작업 브랜치 업로드

1. GitHub Desktop에서 `codex/account-login-foundation` 브랜치인지 확인합니다.
2. 변경 파일을 검토한 뒤 해당 브랜치에 Commit하고 Publish branch 또는 Push origin을 누릅니다.
3. 이 단계에서는 운영 브랜치 `main`에 병합하지 않습니다.

### Vercel 테스트 화면 주소 확보

1. Vercel에서 저장소의 작업 브랜치 Preview 배포를 확인합니다.
2. Root Directory `frontend`, Build Command `npm run build`, Output Directory `dist`를 확인합니다.
3. Preview의 Visit 또는 배포 주소를 열고, 실제 사용할 화면의 HTTPS 주소를 기록합니다.

인증 설정이 비어 있으면 최초 Preview는 게스트 화면으로 표시됩니다. 아래 환경변수를 입력하고 새로 배포하면 로그인을 연결할 수 있습니다.

### 새 Render 테스트 서비스 설정

기존 운영 서비스와 구분되는 테스트 Web Service를 준비합니다. 다음은 새 서비스의 설정값입니다.

| Render 설정 항목 | 넣을 값 |
| --- | --- |
| Repository | `greenbee02/word_Emglish_Program` |
| Branch | `codex/account-login-foundation` |
| Root Directory | `backend` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Auto Deploy | 최초 설정 중에는 `Off` |

Render의 Environment에 아래 값을 각각 등록합니다. **이 표는 Render 전용이며 PC용 `.env` 표를 복사하지 않습니다.**

| 환경변수 이름 | Render에 넣을 값 |
| --- | --- |
| `DATABASE_URL` | 2절에서 확인한 **테스트 Supabase DB 연결 문자열** |
| `SUPABASE_URL` | 같은 테스트 프로젝트의 **HTTPS 프로젝트 URL** |
| `SUPABASE_PUBLISHABLE_KEY` | 같은 테스트 프로젝트의 **공개용 키** |
| `FRONTEND_ORIGIN` | 방금 확보한 **Vercel 테스트 화면의 실제 HTTPS origin** |
| `DB_SSL` | `true` |
| `AUTO_MIGRATE` | `false` — 2절에서 SQL을 먼저 실행한 상태 |
| `NODE_VERSION` | `22` |

`FRONTEND_ORIGIN`에는 화면 주소의 `https://`와 도메인까지만 넣습니다. 경로, 마지막 `/`, `/api/state`는 넣지 않습니다. 여러 주소를 허용해야 하면 정확한 origin들을 쉼표로 구분합니다.

`PORT`는 별도로 추가할 필요가 없습니다. 이 서버는 Render가 제공하는 `PORT`를 읽습니다. PC 실행용 포트 값을 배포 표에서 가져오지 않습니다. 인증서 확인에 별도 CA가 필요한 경우에만 해당 DB의 PEM 인증서를 `DB_SSL_CA`에 설정합니다. 코드가 줄바꿈 문자 `\n`도 처리합니다. [Render 포트 문서](https://render.com/docs/web-services#port-binding)

환경변수를 등록한 뒤 배포를 실행합니다. 변수를 나중에 수정하면 Save and deploy 또는 Save, rebuild, and deploy로 적용합니다. Save only는 다음 배포 전까지 실행 중 서비스에 적용되지 않습니다. [Render 환경변수 문서](https://render.com/docs/configure-environment-variables)

배포 성공 후 Render 서비스에 표시된 공개 HTTPS 주소를 복사합니다. 그 주소 뒤에 `/health`를 붙여 열었을 때 `status`가 `ok`인지 확인합니다. 환경변수에 넣는 API 기본 주소에는 `/health`를 붙이지 않습니다.

`deploy/render.supabase.yaml`은 새 테스트 서비스의 참고 설정입니다. 루트의 기존 `render.yaml`은 Render 자체 DB를 생성하는 이전 설정이므로 그대로 다시 적용하지 않습니다.

## 4 Vercel과 Supabase 로그인 연결

### Vercel에 넣을 환경변수

Vercel의 해당 프로젝트 → Settings → Environment Variables에서 아래 세 변수를 추가합니다. 이번에는 **Preview 환경에 적용**합니다. 다른 Preview와 구분할 필요가 있으면 대상 브랜치 범위도 확인합니다.

| 환경변수 이름 | Vercel Preview에 넣을 값 |
| --- | --- |
| `VITE_API_URL` | 3절에서 복사한 **테스트 Render 서비스의 실제 HTTPS 기본 주소** |
| `VITE_SUPABASE_URL` | Render의 `SUPABASE_URL`과 **동일한 테스트 프로젝트 URL** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Render의 `SUPABASE_PUBLISHABLE_KEY`와 **동일한 공개용 키** |

`VITE_API_URL`은 화면 주소나 Supabase 주소가 아니라 Render API 주소입니다. 주소 끝에 `/api/state`나 `/health`를 붙이지 않습니다. `VITE_` 값은 브라우저 코드에 포함되므로 DB 연결 문자열과 Secret 또는 service_role 키를 넣지 않습니다. [Supabase 키 문서](https://supabase.com/docs/guides/api/api-keys)

변수를 저장한 뒤 해당 작업 브랜치의 Preview를 **재배포**합니다. 기존 배포에는 새 환경변수가 반영되지 않습니다. [Vercel 환경변수 문서](https://vercel.com/docs/environment-variables)

### Supabase에서 로그인 후 돌아올 주소 설정

새 Preview 배포에서 실제로 열리는 화면 주소를 확인한 다음, 테스트 Supabase 프로젝트 → Authentication → URL Configuration에서 아래 항목을 설정합니다.

| Supabase 설정 항목 | 넣을 값 |
| --- | --- |
| Site URL | **Vercel 테스트 화면 주소** — Render API 주소가 아닙니다 |
| Redirect URLs 첫 항목 | 실제 Vercel 테스트 화면의 루트 URL — 끝에 `/` 포함 |
| Redirect URLs 둘째 항목 | 위 루트 URL 뒤에 `?recovery=1`을 붙인 전체 URL |

예를 들어 주소창에서 복사한 화면 주소의 끝에 이미 `/`가 있으면 두 번째 항목에는 그 뒤로 `?recovery=1`만 붙입니다. URL Configuration은 Supabase 대시보드 설정이며, Vercel 환경변수 이름으로 추가하는 항목이 아닙니다. [Supabase 리다이렉트 문서](https://supabase.com/docs/guides/auth/redirect-urls)

재배포 후 화면 주소가 달라졌다면 Render의 `FRONTEND_ORIGIN`과 Supabase의 허용 주소도 새 화면 주소로 맞춥니다. Render 값은 변경 후 재배포하고, Supabase 주소는 저장합니다. 같은 주소를 계속 쓰려면 실제 사용하는 고정 테스트 주소를 기준으로 등록합니다.

### 이메일 인증 확인

1. 테스트 화면에서 계정 A와 B를 직접 가입합니다.
2. 인증 메일의 링크를 열어 로그인 가능한지 확인합니다.
3. 비밀번호 재설정 메일도 요청하고 새 비밀번호로 로그인해 봅니다.

메일이 오지 않으면 이메일 발송 설정, 스팸함, 발송 제한과 Custom SMTP를 확인합니다. 현재 PKCE 흐름은 요청한 브라우저의 인증 상태를 사용하므로 우선 같은 브라우저에서 링크를 여는 방식으로 확인합니다. 다른 기기에서 이메일 링크를 여는 흐름까지 지원하려면 이메일 템플릿과 토큰 교환을 별도로 검토해야 합니다.

## 5 직접 확인할 테스트

| 순서 | 조작 | 정상 결과 |
| --- | --- | --- |
| 1 | 게스트로 단어 추가 후 새로고침 | 같은 기기에 단어 유지 |
| 2 | A 가입 후 이메일 인증과 로그인 | A의 데이터만 표시 |
| 3 | 빈 A 계정에서 기기 데이터 가져오기 선택 | 확인한 뒤에만 계정으로 복사 |
| 4 | A에서 저장 후 새로고침 | A의 내용 유지와 계정 저장 완료 표시 |
| 5 | A 로그아웃 후 B 로그인 | A의 단어와 기록이 보이지 않음 |
| 6 | A로 재로그인 | A의 데이터 복원 |
| 7 | 비밀번호 재설정 이메일의 링크 열기 | 새 비밀번호 설정 후 로그인 가능 |
| 8 | 같은 계정을 두 브라우저에서 수정 | 오래된 쪽에 충돌 안내와 덮어쓰기 중단 |
| 9 | 인터넷을 끊고 수정한 뒤 다시 연결 | 기기 보관 후 재시도 또는 충돌 안내 |
| 10 | PDF 분석 도중 로그아웃 | 이전 결과가 새 계정에 표시되지 않음 |
| 11 | 계정 변경 시 인증 창과 진행 중 저장 확인 | 이전 창 닫힘과 계정 경계 유지 |
| 12 | 휴대폰으로 등록과 타이핑 학습 | 입력창과 버튼이 화면 밖으로 넘치지 않음 |

충돌이 나면 먼저 설정에서 현재 데이터 백업을 내려받고 서버 데이터 불러오기를 선택합니다. 자동 병합은 하지 않습니다. 백업 복원은 현재 단어장 전체를 교체하므로 복원할 계정과 현재 데이터 백업을 먼저 확인합니다.

브라우저의 계정별 캐시는 암호화된 개인 보관함이 아닙니다. 공용 PC에서 캐시를 남기지 않는 정책이 필요하면 별도로 결정해야 합니다.

GitHub Actions의 프론트엔드 테스트·빌드와 백엔드 테스트도 확인합니다. 이 자동 테스트는 실제 인증 메일 수신과 운영 연결 확인을 대신하지 않습니다.

## 6 운영 전환

테스트 확인이 끝난 뒤 운영 프로젝트의 값으로 전환합니다. Vercel **Production**에 넣는 API 주소는 운영 Render 주소이고, Supabase URL과 공개용 키는 운영 프로젝트의 값입니다. 테스트 DB 연결 정보를 운영 설정에 섞지 않습니다.

기존 프론트엔드는 인증 토큰 없이 공통 API를 사용합니다. 새 백엔드만 기존 운영 주소에 먼저 배포하면 구버전 화면의 서버 저장이 실패합니다. 두 서비스가 동시에 자동 전환되는 구조가 아니므로 전환 시간을 정합니다.

1. 운영 데이터를 다시 백업하고 기존 프론트·백엔드 배포 버전을 기록합니다. 전환 중에는 데이터 수정을 멈춥니다.
2. 운영 Supabase에서 이메일 인증과 `001_user_state.sql`을 준비합니다. 기존 `app_state`는 보존합니다.
3. 새 인증용 Render 서비스를 운영 DB에 연결해 준비한다면, 3절의 표를 **운영 DB·운영 Supabase·운영 Vercel origin**으로 채웁니다. 새 서비스의 코드 브랜치 또는 커밋이 검증한 버전인지 확인합니다.
4. 기존 Render 서비스가 main 변경을 자동 배포한다면, 전환 전에 해당 서비스의 Auto Deploy 동작도 확인해 구버전 운영 서비스가 예상 밖에 바뀌지 않도록 합니다.
5. Vercel Production 환경변수에는 **운영 Render 실제 HTTPS 주소 + 운영 Supabase 프로젝트 URL + 운영 공개용 키**를 설정합니다. 검증한 새 코드와 이 환경변수를 함께 사용해 운영 배포를 만듭니다. 구버전 코드에 새 API 주소만 먼저 적용해 재배포하지 않습니다.
6. 운영 Supabase Site URL과 Redirect URLs는 운영 Vercel 화면 주소로, 운영 Render의 `FRONTEND_ORIGIN`은 운영 화면 origin으로 맞춥니다.
7. 계정 두 개로 로그인·분리 저장·재설정을 확인하고 구버전 화면을 새로고침합니다. 새 API로 전환한 뒤 기존 인증 없는 공통 API는 정지하거나 접근을 차단합니다.

기존 Render 서비스를 그대로 재사용한다면 전환 시간에 그 서비스의 환경변수와 새 코드를 적용하고, 이어서 새 프론트엔드를 배포해야 합니다. 전환 중에는 구버전 화면의 서버 저장이 일시적으로 실패할 수 있습니다.

기존 공통 데이터는 첫 로그인 사용자에게 자동 배정하지 않습니다. 소유자가 기존 화면 백업을 확인하고 자신의 계정에서 설정 → 백업 복원으로 가져옵니다.

루트의 기존 Blueprint에 DB 리소스가 포함되어 있다면, 이를 제거하는 설정 변경은 실제 연결과 백업을 확인한 뒤 따로 검토합니다. 코드를 롤백해도 DB나 새 계정 데이터는 자동으로 되돌아가지 않습니다. `user_state`를 보존하고 원인을 확인합니다.

## 7 오류별 확인 위치

| 증상 | 확인할 내용 |
| --- | --- |
| Vercel 화면에서 API 연결 실패 | `VITE_API_URL`이 실제 Render HTTPS 주소인지 확인하고 Vercel 재배포 |
| CORS 오류 | Render `FRONTEND_ORIGIN`이 실제 화면 origin과 일치하는지 확인 후 Render 재배포 |
| 401 인증 오류 | 프론트·백엔드가 같은 Supabase 프로젝트 URL과 공개용 키를 사용하는지 확인 |
| 백엔드 시작 실패 | 필수 환경변수, DB 연결·SSL, `user_state` 테이블 생성 여부 확인 |
| 이메일 링크가 다른 사이트로 이동 | Supabase Site URL·Redirect URLs·사용 중인 이메일 템플릿 확인 |
| Vercel 환경변수가 반영되지 않음 | 올바른 Preview 또는 Production 범위에 저장했는지 확인 후 새 배포 생성 |
| Render 환경변수가 반영되지 않음 | Save only로 끝내지 않고 새 값이 적용되는 배포 실행 |
| 저장 충돌 | 현재 데이터 백업 후 서버 데이터 불러오기 |

## 공식 문서

- [Vercel 환경변수](https://vercel.com/docs/environment-variables)
- [Render 환경변수](https://render.com/docs/configure-environment-variables)
- [Render Web Service와 포트](https://render.com/docs/web-services)
- [Supabase DB 연결](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase API 키](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
