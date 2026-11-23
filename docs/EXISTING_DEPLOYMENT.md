# 이미 연동된 서비스 업데이트 안내

현재 사용 중인 Vercel 화면, Render API, Supabase 프로젝트를 그대로 사용해 새 로그인 기능과 디자인을 반영하는 순서입니다. 기존 서비스 주소와 DB 연결을 확인하고, 이번 코드에서 추가로 요구하는 설정을 준비합니다.

## 1 현재 상태 준비

1. Supabase가 일시 중지 상태라면 `Resume project`를 눌러 재개를 완료합니다.
2. 사이트에서 내려받은 학습 데이터 JSON을 보관합니다. 개인 단어장과 기록 보관 목적이면 이 파일로 진행할 수 있으며 터미널 백업은 필수가 아닙니다. 기존 DB 데이터는 복원 확인 전까지 보존합니다.
3. GitHub에 업로드한 수정 브랜치 이름을 확인합니다. 현재 작업 폴더의 브랜치는 `account-login-foundation`입니다. GitHub Desktop과 Render에서 실제 업로드한 이름이 일치해야 합니다.
4. 현재 Vercel과 Render가 어느 브랜치를 배포하는지 기록합니다. 아래 순서는 아직 새 코드를 main에 병합하지 않은 경우를 기준으로 합니다.

## 2 기존 Supabase에 새 저장 테이블 준비

1. 기존 Supabase 프로젝트의 SQL Editor를 엽니다.
2. 저장소의 `backend/migrations/001_user_state.sql` 내용을 복사해 새 쿼리로 실행합니다.
3. `user_state` 테이블이 만들어졌는지 확인합니다.

이 SQL은 사용자별 저장 테이블을 추가하고 RLS를 켭니다. 기존 공통 `app_state`는 삭제하거나 옮기지 않습니다. 처음 로그인한 계정은 빈 데이터로 시작하며, 기존 JSON은 나중에 본인 계정으로 복원합니다.

새 백엔드는 시작할 때 `user_state`의 존재를 확인하므로 SQL을 먼저 적용해야 합니다. Render의 기존 `DATABASE_URL`이 이 Supabase 프로젝트를 가리키는지도 확인합니다.

## 3 기존 Supabase에서 이메일 로그인 설정

- Authentication에서 이메일·비밀번호 로그인, 이메일 확인, 8자 이상의 비밀번호 정책을 확인합니다.
- URL Configuration의 Site URL에는 실제 운영 Vercel 화면 주소를 넣습니다.
- Redirect URLs에는 화면의 루트 URL과 그 뒤에 `?recovery=1`을 붙인 URL을 각각 등록합니다. 루트 URL 끝에는 `/`가 들어갑니다.
- 프로젝트의 HTTPS URL과 Settings → API Keys의 Publishable key를 확인합니다.

Site URL과 Redirect URLs는 로그인 후 돌아올 **화면 주소**입니다. Render API 주소를 넣지 않습니다. 프론트엔드와 백엔드의 인증 설정은 모두 이 기존 Supabase 프로젝트의 값을 사용합니다.

## 4 기존 Render 환경변수 확인과 추가

현재 사용 중인 Render API 서비스의 Environment에서 아래 값을 확인합니다.

| 변수 | 기존 서비스에서 할 일 |
| --- | --- |
| `DATABASE_URL` | 기존 연결 문자열이 위 Supabase DB를 가리키면 유지 |
| `FRONTEND_ORIGIN` | 현재 운영 Vercel 화면의 HTTPS origin이면 유지 경로와 마지막 슬래시는 제외 |
| `SUPABASE_URL` | 없으면 추가 같은 기존 Supabase 프로젝트의 HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | 없으면 추가 같은 프로젝트의 Publishable key |
| `DB_SSL` | Supabase 연결은 `true`로 확인 |
| `DB_SSL_CA` | 인증서 검증에 해당 프로젝트 CA가 필요한 경우에만 설정 |
| `AUTO_MIGRATE` | SQL을 먼저 실행했으므로 `false` |
| `NODE_VERSION` | `22` 또는 코드 요구사항인 Node 22.12 이상을 만족하는 설정 |

새 코드는 DB SSL 인증서를 검증합니다. 기존에 인증서 검증을 끈 연결로만 동작했다면 해당 프로젝트의 CA 설정도 확인해야 합니다.

`PORT`는 Render가 제공하는 값을 사용합니다. PC 실행 예시의 포트를 새로 복사할 필요가 없습니다. 설정을 미리 준비하는 동안에는 **Save only**로 저장하고, 아래 순서에서 새 코드와 함께 배포합니다. [Render 환경변수 적용 방식](https://render.com/docs/configure-environment-variables)

## 5 기존 Vercel 환경변수 확인과 추가

현재 Vercel 프로젝트의 Settings → Environment Variables에서 **Production** 범위를 확인합니다.

| 변수 | 기존 프로젝트에서 할 일 |
| --- | --- |
| `VITE_API_URL` | 현재 Render API의 실제 HTTPS 기본 주소이면 유지 |
| `VITE_SUPABASE_URL` | 없으면 추가 Render의 `SUPABASE_URL`과 동일한 값 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 없으면 추가 Render의 `SUPABASE_PUBLISHABLE_KEY`와 동일한 공개용 키 |

API 기본 주소에 `/health`나 `/api/state`를 붙이지 않습니다. 환경변수를 저장한 뒤에는 새 코드로 생성하는 배포에 적용합니다. 이 단계에서 구버전 프론트엔드만 재배포할 필요는 없습니다. Vercel의 기존 배포는 환경변수 저장만으로 바뀌지 않습니다. [Vercel 환경변수 적용 방식](https://vercel.com/docs/environment-variables)

## 6 기존 서비스를 새 코드로 순서대로 배포

새 백엔드는 로그인 토큰을 요구하고, 구버전 백엔드는 사용자 구분 없이 공통 데이터를 제공합니다. **새 프론트엔드와 구버전 백엔드를 섞어 로그인·계정 분리를 테스트하지 않습니다.** 두 서비스 모두 새 코드가 적용되어야 합니다.

기존 서비스를 재사용하면 전환 중 구버전 화면의 서버 저장이 일시적으로 실패할 수 있습니다. 전환 동안 학습 데이터 수정을 멈추고 아래 순서로 진행합니다.

1. 기존 Render 서비스의 Auto Deploy를 잠시 `Off`로 두어 전환 순서를 제어합니다.
2. Render Settings의 배포 Branch를 실제 업로드한 수정 브랜치로 선택합니다. 현재 작업 브랜치 이름은 `account-login-foundation`입니다.
3. 환경변수와 SQL 준비를 확인하고 Render의 Manual Deploy → Deploy latest commit으로 **새 백엔드부터** 배포합니다. Root Directory는 기존 `backend`, Start Command는 `npm start`를 사용합니다. 기존 정상 빌드 명령이 `npm install`이었다면 계속 사용할 수 있으며, 잠금 파일 기준 명령은 `npm ci --omit=dev`입니다.
4. Render 배포 성공과 기존 API 주소의 `/health` 응답을 확인합니다. 이 시점부터 구버전 화면의 서버 저장은 인증 요구 때문에 실패할 수 있습니다.
5. GitHub에서 검증한 수정 브랜치를 기존 운영 브랜치에 병합합니다. 운영 브랜치가 main이라면 main에 병합합니다.
6. Vercel에서 **같은 새 코드와 5절의 Production 환경변수**로 운영 배포가 완료되는지 확인합니다. 자동 배포를 꺼 두었다면 수동으로 새 코드를 배포합니다.
7. Render의 Branch를 원래 운영 브랜치로 돌립니다. 그 브랜치에 새 코드가 들어왔는지 확인한 뒤 원래 Auto Deploy 설정을 복원합니다.
8. 사이트를 새로고침하고 가입·로그인·저장을 확인합니다.

이미 main에 병합하거나 일부 서비스에 배포했다면, 먼저 각 서비스가 실제 사용 중인 커밋과 환경변수를 확인해 새 코드끼리 맞춥니다. 브랜치 이름만 같다고 배포된 코드도 같은 것으로 간주하지 않습니다.

## 7 본인 계정에 기존 데이터 복원

1. 본인 이메일로 가입하고 인증 메일을 확인합니다.
2. 로그인한 계정이 맞는지 확인합니다.
3. 설정 → 백업 복원에서 기존 사이트에서 받은 JSON 파일을 선택합니다.
4. 단어 수·학습 기록·설정을 확인하고 계정 저장 완료 표시를 확인합니다.
5. 새로고침 후 데이터가 유지되는지 확인합니다.
6. 별도 계정으로 로그인했을 때 앞 계정의 단어가 보이지 않는지 확인합니다.

복원은 현재 계정의 학습 데이터를 교체합니다. 기존 DB의 공통 데이터는 이 확인을 마칠 때까지 보존합니다. 비밀번호 재설정 메일도 실제로 확인해야 전체 로그인 전환 검증을 마칠 수 있습니다.
