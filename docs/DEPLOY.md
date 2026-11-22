# 배포만 모아보기

AIC를 Cloudflare에 올릴 때 필요한 것만 순서대로 정리했습니다. 로컬 데모 설정은 포함하지 않습니다.

## 1. 준비

- Cloudflare 계정
- 이 프로젝트의 `wrangler.jsonc`
- D1 데이터베이스 1개
- HTTPS가 붙는 Cloudflare 도메인(또는 `*.workers.dev` 주소)
- 학생 화면 공유를 다른 네트워크에서도 쓸 경우 TURN 서버(선택)

R2 버킷은 만들지 않습니다. 파일 업로드용 저장소도 필요 없습니다.

## 2. 최초 1회

```bash
bunx wrangler login
bunx wrangler d1 create aic-db
```

출력된 `database_id`를 `wrangler.jsonc`의 placeholder와 교체합니다.

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "aic-db",
    "database_id": "실제-database-id",
    "migrations_dir": "database/migrations"
  }
]
```

원격 스키마를 적용합니다.

```bash
bun run db:remote
```

`0001` → `0002` → `0003` 순서로 적용되며, `0003`에서 선생님 소유자가 `tch_owner`로 정리됩니다.

### Cloudflare secret

```bash
bunx wrangler secret put TEACHER_PASSWORD   # 8자 이상
bunx wrangler secret put SESSION_SECRET     # 16자 이상
# 선택: 화면에 표시할 이름
bunx wrangler secret put TEACHER_NAME
```

- `TEACHER_PASSWORD`: 선생님이 `/login`에 입력하는 유일한 비밀번호
- `SESSION_SECRET`: 로그인 세션 쿠키 서명 키
- `.dev.vars`는 로컬 전용이며 배포되지 않습니다.

## 3. 매 배포

```bash
bun run deploy
```

내부 순서는 `typecheck` → `vite build` → `wrangler deploy`입니다.
코드만 먼저 확인하려면:

```bash
bun run build
bunx wrangler deploy
```

## 4. 배포 후 확인

1. `https://배포주소/login`에서 `TEACHER_PASSWORD`로 입장되는지 확인합니다.
2. 새 수업을 만들고 학생 기기(폰/태블릿)에서 참가 코드로 입장합니다.
3. **학습지·문제** 탭에서 문항 2개(정답 포함)를 만들고 배포 → 학생이 제출 → 점수가 보이는지 확인합니다.
4. **게임** 탭에서 세트를 고르고 클래식/스피드/골든벨/팀전을 각각 한 문제씩 시작해 응답·순위표를 확인합니다.
5. **띄우기·타이머** 탭에서 안내문을 띄우고 50분 타이머를 시작해 학생 화면에 동시에 보이는지 확인합니다.
6. **패들렛** 탭에서 공개 `padlet.com` 주소를 가져온 뒤 **학생에게 띄우기**를 확인합니다.
7. **화면 공유**: 선생님 화면 공유 → 학생 화면 맨 위에 크게 표시되는지,
   학생 **화면 요청 → 허용 → 크게 보기 → 전체화면**까지 확인합니다(반드시 https 주소).
8. 수업 종료 후 참가자·응답·보드·입력 미리보기가 사라지는지,
   대시보드 **수업 삭제**로 수업 행까지 지워지는지 확인합니다.

## 5. 선택 설정

### TURN

다른 네트워크의 학생과 화면 공유를 하려면 빌드 시 TURN 값을 넣습니다.

```bash
VITE_TURN_URL=turn:... \
VITE_TURN_USERNAME=... \
VITE_TURN_CREDENTIAL=... \
bun run build
```

값은 브라우저 번들에 포함되는 공개 값이므로 장기 비밀번호 대신 짧은 만료 시간의 임시 자격 증명을 권장합니다.

### Cron

`wrangler.jsonc`의 일일 Cron(`17 3 * * *`)은 비정상 종료로 남은 참가자 행을 정리하는 안전망입니다.
수업을 정상 종료하면 그 자리에서 즉시 삭제됩니다.

## 6. 이번 변경에서 추가로 배포되는 것

- `shared/protocol.ts` — 학습지 문항, 게임 점수/모둠/생존, 띄우기(stage), 타이머, 손들기 메시지 타입
- `worker/src/do/ClassroomHub.ts` — 문항 자동 채점, 스피드·골든벨·팀전 점수, 순위표, 띄우기, 타이머, 손들기, 알림
- `worker/src/api/classrooms.ts` — `DELETE /api/v1/classrooms/:id` (수업 완전 삭제)
- `src/features/teacher/ToolsTab.tsx` — 학습지 문항 만들기·자동 채점·CSV
- `src/features/teacher/PresentTab.tsx` — 전원 화면 띄우기·50분 타이머·손들기·전체 알림
- `src/features/teacher/GameTab.tsx` — 클래식·스피드·골든벨·팀전, 제한 시간, 순위표
- `src/features/teacher/ScreenShareTab.tsx` — 학생 화면 크게 보기·전체화면, 모두에게 요청
- `src/pages/StudentRoom.tsx` — 학습지 문항 입력, 선생님 화면 상단 크게 보기, 띄우기 오버레이, 타이머
- `src/pages/Dashboard.tsx` — 수업 삭제 UI

**새 D1 마이그레이션은 없습니다.** 수업 내부 데이터(퀴즈·학습지·점수·보드·타이머)는
Durable Object의 SQLite가 소유하며, 배포 후 첫 연결에서 새 열을 스스로 추가합니다.
R2 버킷과 새 secret도 필요 없습니다. 기존 배포에 그대로 덮어쓰면 됩니다.

> 이미 배포된 사이트가 있다면 `bun run build && bunx wrangler deploy`만 다시 실행하면 됩니다.
> 수업 중이었다면 새 코드 반영을 위해 수업을 한 번 종료했다가 다시 시작하는 편이 안전합니다.

## 7. 선생님이 직접 설정할 것

| 항목 | 필수 | 방법 |
| --- | --- | --- |
| Cloudflare 계정 | ✅ | https://dash.cloudflare.com 가입 |
| `wrangler login` | ✅ | `bunx wrangler login` (브라우저 승인 1회) |
| D1 `database_id` | ✅ | `bunx wrangler d1 create aic-db` → `wrangler.jsonc` 교체 |
| `TEACHER_PASSWORD` | ✅ | `bunx wrangler secret put TEACHER_PASSWORD` (8자 이상) |
| `SESSION_SECRET` | ✅ | `bunx wrangler secret put SESSION_SECRET` (16자 이상) |
| `TEACHER_NAME` | 선택 | 화면에 표시할 선생님 이름 |
| 원격 마이그레이션 | ✅ | `bun run db:remote` (최초 1회, 이후 스키마 변경 시) |
| `VITE_TURN_URL` 등 | 선택 | 다른 네트워크 학생과 화면 공유할 때 (빌드 시) |
| HTTPS 도메인 | ✅ | `*.workers.dev`는 기본 HTTPS. 학교 도메인을 쓰려면 Workers Custom Domain |
| Tailscale Serve | 선택 | 로컬 서버를 인증서 경고 없이 열 때 (`tailscale serve --bg 8000`) |

### 로컬에서 다른 기기로 테스트할 때

- `bash scripts/make-lan-cert.sh` → `bun run dev:https` → `https://<이 PC IP>:8443`
- 인증서 경고는 **고급 → 계속**으로 한 번만 넘깁니다. IP가 바뀌면 스크립트를 다시 실행하세요.
- 화면 공유·클립보드·PDF 해시는 **https 또는 localhost**에서만 정상 동작합니다.
- 같은 Wi-Fi가 아니면 Tailscale(tailnet)로 기기를 묶는 것이 가장 간단합니다.

## 8. 자주 막히는 곳

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 화면 공유 버튼이 아무 반응 없음 | `http://` 주소 | `https://` 또는 localhost로 접속 |
| 학생 화면이 자동으로 전체화면이 안 됨 | 브라우저 사용자 제스처 정책 | 학생이 화면의 **전체화면** 버튼을 한 번 누름 |
| Padlet이 빈 화면 | 비공개/로그인 필요 보드, iframe 차단 | 공개 보드의 embed 주소 사용, 또는 **새 창**으로 열기 |
| 다른 네트워크 학생과 화면 공유 실패 | NAT/방화벽 | TURN 서버 설정 후 재빌드 |
| `database_id` 오류 | placeholder 그대로 | `wrangler d1 create` 결과로 교체 |
| 로그인이 계속 실패 | secret 미설정 | `wrangler secret put TEACHER_PASSWORD` 후 재배포 |

## 배포하지 않는 것

- `.dev.vars`, `.env` — 로컬 비밀값
- `node_modules`, `.wrangler` — 로컬 의존성/상태
- `dist`는 `wrangler deploy`가 정적 자산으로 업로드하는 빌드 산출물이므로 저장소에는 커밋하지 않습니다.
- `.tools` — 이 컴퓨터의 테스트 도구
- 선생님 PC의 보드·PDF·게임 세트 — 브라우저 로컬 데이터
