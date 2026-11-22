# 인터넷에서 준비할 것

AIC v4는 **Cloudflare 계정 하나**면 배포할 수 있습니다. R2 버킷, 파일 저장 서비스, 별도 데이터베이스 계정은
필요 없습니다. 선생님은 계정 대신 **비밀번호 하나**로 입장하며, 그 비밀번호는 Cloudflare secret에만 둡니다.
아래 순서대로 진행하세요.

## 0. 먼저 교실 네트워크에서 테스트

배포 전에 같은 Wi-Fi/Tailscale의 폰·태블릿으로 확인할 때는 **HTTPS 주소**를 쓰세요.
브라우저는 `http://`(localhost 제외)에서 `crypto.subtle`, `navigator.clipboard`, `getDisplayMedia`를 숨기기 때문에
평문 HTTP로 열면 화면 공유가 막히고 PDF·복사도 제한됩니다.

```bash
bun run dev:lan                 # Worker(8787) + Vite(0.0.0.0:8000)
bash scripts/make-lan-cert.sh   # SAN에 이 PC의 IP가 들어간 자체 서명 인증서 (.certs/는 gitignore)
bun run dev:https               # https://<이 PC IP>:8443
```

1. 폰/태블릿에서 `https://<이 PC IP>:8443/login` 을 엽니다.
2. 인증서 경고가 나오면 **고급 → 계속**으로 한 번만 넘깁니다(자체 서명 인증서).
3. 주소창이 자물쇠(또는 경고 후 계속) 상태이면 화면 공유·복사·PDF가 모두 동작합니다.

> 경고 없이 쓰고 싶다면 Tailscale Serve를 켭니다. (tailnet 관리자 1회 승인 필요)
>
> ```bash
> tailscale serve --bg 8000
> ```
>
> 그러면 `https://<기기이름>.<tailnet>.ts.net` 주소가 생기고 인증서 경고가 없습니다.
> 공인 인터넷에 공개하려면 `tailscale funnel` 또는 Cloudflare 배포(5장)를 사용하세요.

- IP가 바뀌면(다른 Wi-Fi) `bash scripts/make-lan-cert.sh`를 다시 실행하세요.
- iPhone/iPad Safari는 `getDisplayMedia`를 지원하지 않습니다. 학생 화면 공유는 노트북/Android Chrome에서 확인하세요.
- `http://…:8000` 으로 열면 PDF 배포·복사는 대체 경로로 동작하고, 화면 공유만 막힙니다(앱이 안내 배너를 띄웁니다).

## 1. 필요한 계정

| 준비물 | 용도 | 필수 |
| --- | --- | --- |
| Cloudflare 계정 | Worker·D1·Durable Object·HTTPS·도메인 | 필수 |
| 도메인(선택) | `class.example.com` 같은 주소 | 선택 |
| TURN 서버(선택) | 서로 다른 네트워크의 화면 공유 | 조건부 |

> 학교/기관 Wi-Fi에서 학생이 접속한다면 보통 같은 네트워크라 STUN만으로 연결됩니다.
> 학생이 LTE/집에서 접속하거나 학교 방화벽이 UDP를 막으면 TURN이 필요합니다.

## 2. Cloudflare 로그인

프로젝트 폴더에서:

```bash
bunx wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 승인합니다. (Git Bash/PowerShell 모두 동일)

## 3. D1 데이터베이스 만들기

```bash
bunx wrangler d1 create aic-db
```

출력에 나오는 `database_id`를 복사해 `wrangler.jsonc`의 placeholder를 교체합니다.

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "aic-db",
    "database_id": "여기에-복사한-ID",
    "migrations_dir": "database/migrations"
  }
]
```

그다음 원격 스키마를 적용합니다.

```bash
bunx wrangler d1 migrations apply DB --remote
```

`0001_init.sql`, `0002_drop_recordings.sql`, `0003_single_teacher_password.sql`이 순서대로 적용됩니다.
`0003`은 기존 계정과 수업을 단일 소유자(`tch_owner`)로 합칩니다.

## 4. 비밀번호와 세션 비밀키 넣기

```bash
bunx wrangler secret put TEACHER_PASSWORD
bunx wrangler secret put SESSION_SECRET
```

- `TEACHER_PASSWORD`: 선생님이 `/login`에 입력할 비밀번호입니다. **8자 이상**이어야 하며, 앱 코드·D1·브라우저에 저장되지 않습니다.
- `SESSION_SECRET`: 16자 이상의 임의 문자열입니다. 로그인 후 세션 쿠키 서명에 사용합니다.
- 선택: `bunx wrangler secret put TEACHER_NAME` — 화면에 표시할 선생님 이름(기본 “선생님”).

두 값 모두 코드/저장소에 커밋하지 마세요. 로컬은 `.dev.vars`(gitignore)의 값으로 동작합니다.
기본 로컬 비밀번호는 `aic-class-2026`입니다.

## 5. 배포

```bash
bun run deploy
```

`typecheck → vite build → wrangler deploy`가 순서대로 실행됩니다.
배포가 끝나면 `https://aic.<계정>.workers.dev` 주소가 나옵니다.

### 커스텀 도메인 (선택)

Cloudflare 대시보드 → **Workers & Pages → aic → Settings → Domains & Routes → Add custom domain**.
도메인이 같은 Cloudflare 계정에 있으면 DNS가 자동으로 설정됩니다. HTTPS는 자동 발급됩니다.
화면 공유(`getDisplayMedia`)는 HTTPS 또는 `localhost`에서만 동작합니다.

## 6. 화면 공유용 TURN (조건부)

기본 설정은 공개 STUN만 사용합니다. 서로 다른 네트워크에서 화면이 연결되지 않으면 TURN을 추가하세요.
TURN은 직접 운영(`coturn`)하거나 학교/기관에서 제공하는 서버를 사용할 수 있습니다.

빌드 시 아래 환경 변수를 넣습니다.

```bash
VITE_TURN_URL="turn:turn.example.com:3478?transport=udp,turn:turn.example.com:443?transport=tcp" \
VITE_TURN_USERNAME="aic" \
VITE_TURN_CREDENTIAL="임시-비밀번호" \
bun run build
bunx wrangler deploy
```

- `VITE_*` 값은 **브라우저 번들에 포함되는 공개 값**입니다. 장기 비밀번호 대신 짧은 만료 시간의
  TURN 자격 증명을 발급하는 구성을 권장합니다.
- TURN 서버가 443/TCP(TLS)도 열어 두면 학교 방화벽 환경에서 성공률이 높습니다.
- TURN을 쓰지 않으면 통화/화면이 연결되지 않을 수 있으며, 앱은 이를 “연결 실패”로 표시합니다.

## 7. 배포 후 실제 확인

1. 교사 PC에서 로그인 → 수업 생성 → 콘솔을 엽니다.
2. 학생 기기(다른 네트워크도 시도)에서 참가 코드로 입장합니다.
3. **활동 보드**를 열고 학생 카드가 보이는지 확인합니다.
4. **PDF 학습지**를 배포하고 학생이 받기 → 제출까지 확인합니다.
5. **게임**에서 영단어·OX·스펠링 세트를 띄우고 학생 응답·정답 공개를 확인합니다.
6. **패들렛**에 embed 주소를 저장해 앱 안에서 표시되는지 확인합니다(보드에 따라 새 창 필요).
7. **화면 공유**에서 선생님 화면 공유, 학생 화면 요청/허용, 입장 시 자동 시작을 확인합니다.
8. **입력 관찰**을 켜고 학생 화면에 고지가 뜨는지, 학습지 입력이 교사에게 보이는지 확인합니다.
9. 콘솔 탭을 닫은 뒤 학생 화면에서 보드·PDF가 사라지는지 확인합니다.
10. **수업 종료** 후 참가자·응답·이벤트가 즉시 사라지는지 확인합니다.

## 8. 운영 시 주의

- 보드/PDF는 **선생님 브라우저에만** 있습니다. PC를 바꾸면 보드함이 비어 있습니다.
  필요하면 활동 보드 페이지에서 JSON으로 내보내 다른 PC에서 가져오세요.
- 수업 콘솔 탭을 닫거나 PC가 절전되면 학생은 PDF를 더 받을 수 없고 보드도 사라집니다.
  수업 중에는 콘솔 탭을 유지하세요.
- **수업 종료는 즉시 파기**입니다. 참가자·퀴즈·게임·학습지 제출·보드 사본·이벤트가 삭제되며 되돌릴 수 없습니다.
  보드 원본과 PDF는 선생님 컴퓨터에 남습니다.
- 입력 관찰은 AIC 안의 활동 입력만 봅니다. 브라우저는 다른 앱이나 비밀번호 필드의 키 입력을 제공하지 않습니다.
- Padlet이 iframe 표시를 막는 보드는 **새 창으로 열기**를 사용하세요.
- 사파리/iOS는 PDF 인라인 표시와 화면 공유 지원이 제한적입니다. 학생에게는 “저장” 버튼을 안내하세요.
- Cloudflare 무료/유료 플랜의 Durable Objects·D1 할당량은 시점에 따라 다를 수 있으니
  대시보드의 사용량 정책을 확인하세요.
- 개인정보 처리 방침, 학부모 동의, 미성년자 데이터 보호는 학교/기관 정책에 맞게 별도 검토해야 합니다.
