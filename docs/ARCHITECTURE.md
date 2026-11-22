# 아키텍처

## 한 장 요약

```
브라우저(React)                          Worker (Hono)                    Durable Object
 ├─ /api/v1/* ────────────────────────►  비밀번호 게이트·D1·자산    ┌─ ClassroomHub (수업 1개당 1개)
 │                                        ├─ D1: classrooms          │   ├─ live / events
 │                                        │      participants        │   ├─ quiz / quiz_answers
 │                                        │      teachers(소유자 1행) │   ├─ worksheet / submissions
 │                                        └─ WebSocket 인증          │   ├─ board / board_cards
 └─ /api/v1/realtime/:id (WS) ─────────►  역할 헤더로 DO 전달 ──────►│   ├─ config / input_previews
                                                                      │   └─ 파일·RTC 중계 (저장 없음)
                                                                      └─ WebSocket Hibernation

선생님 브라우저 IndexedDB: 활동 보드, 학습지 PDF
선생님 ↔ 학생: WebRTC P2P (화면), 소켓 중계 (PDF 조각·시그널링)
```

- **D1**: 수업·임시 참가자와 단일 소유자 행만. 선생님 비밀번호는 D1이 아니라 Cloudflare secret에 있습니다.
  실시간 상태와 파일은 저장하지 않습니다.
- **Durable Object(`CLASSROOM_HUB`)**: 수업 하나당 하나. `idFromName(classroom.id)`로 REST와 WS가 같은 인스턴스를 봅니다.
- **IndexedDB**: 보드 정의와 PDF 원본. 선생님 컴퓨터에만 존재합니다.
- **R2/객체 저장소 없음**: 미디어 업로드·보관 파이프라인이 제거되었습니다.

## 요청 흐름

1. **선생님 입장** — `POST /api/v1/auth/login`에 비밀번호 하나를 보냅니다. 서버는 `TEACHER_PASSWORD`와
   상수 시간 비교 후 `tch_owner` 세션 쿠키(14일, HMAC 서명)를 발급합니다. 계정 가입은 없습니다.
2. **수업 생성** — D1 `classrooms` 행 + 6자리 `join_code`.
3. **학생 입장** — `POST /join/:code` → 임시 `participants` 행과 참가 토큰. D1에는 SHA-256 해시만 저장.
4. **실시간 연결** — 쿼리 `token`이 있으면 학생, 없으면 선생님 쿠키로 인증. Worker가 역할 헤더를 붙여 DO로 전달.
5. **활동** — `shared/protocol.ts`의 메시지. 학생은 자기 관측 이벤트·퀴즈 응답·학습지 답변·보드 카드만 보낼 수 있습니다.

## Durable Object SQLite

| 테이블 | 역할 |
| --- | --- |
| `live` | 참가자별 온라인, 전체화면(`1/0/NULL`), 가시성, 마지막 활동, 화면 공유 여부 |
| `events` | 관측 이벤트. 7일·최대 1500행, 동일 이벤트 25초 억제 |
| `quiz`, `quiz_answers` | 진행 중 퀴즈 1개, 학생별 응답 |
| `worksheet`, `worksheet_submissions` | 학습지 안내 + PDF 메타데이터, 학생별 제출 답변 |
| `board`, `board_cards` | **현재 공유 중인 보드의 임시 사본**. 콘솔을 닫으면 삭제 |
| `config` | 입력 관찰 on/off 같은 수업 중 설정 |
| `input_previews` | 관찰 중인 학생의 활동 입력 최신값(참가자·필드별 1행) |

소켓이 끊겨도 `serializeAttachment()`의 역할/참가자 정보로 presence를 복구합니다.

## 활동 보드 수명주기

1. 선생님이 **활동 보드** 페이지에서 보드를 만들고 `IndexedDB.boards`에 저장합니다.
2. 수업 콘솔 → 활동 보드 탭에서 **열기** → `board_share` 메시지로 전체 보드를 DO에 전송합니다.
3. DO가 `board`/`board_cards`에 임시 저장하고 학생에게 브로드캐스트합니다.
4. 학생이 카드를 추가하면(`board_add`, 허용된 경우) DO가 저장하고 양쪽에 다시 브로드캐스트합니다.
5. `board_close`, 마지막 선생님 소켓 종료, 수업 종료 중 하나라도 발생하면 DO가 보드를 삭제하고
   학생에게 `board: null`을 보냅니다.

보드 원본은 선생님 PC에 있으므로, 콘솔이 닫힌 뒤에는 학생이 다시 열 수 없습니다.

## PDF 학습지 중계

```
선생님: PDF 선택 → IndexedDB에 저장 + 메타데이터만 worksheet_set
학생:   worksheet 메시지에서 메타데이터 확인 → "받기" → file_request
선생님: IndexedDB에서 Blob 로드 → 144KB 조각을 base64로 file_chunk (to=학생)
DO:     내용을 저장하지 않고 대상 학생 소켓으로 그대로 전달
학생:   조각 재조립 → 크기 검증 → Blob URL로 미리보기/저장
```

- 한 조각은 base64 192K자 이하, 전체 96조각 이하로 제한합니다.
- 파일 최대 12MB. 서버 D1/DO에는 바이트가 남지 않습니다.
- 선생님 콘솔이 닫혀 있으면 학생의 요청은 처리되지 않습니다.

## 화면 공유 (WebRTC)

- 시그널링만 DO가 중계합니다: `offer`/`answer`/`candidate`/`request`/`stop`.
- 선생님 → 학생: 온라인 학생마다 별도 `RTCPeerConnection`을 만들어 선생님 화면 트랙을 전송합니다.
- 학생 → 선생님: 학생이 버튼을 눌러 `getDisplayMedia`로 허용한 뒤 offer를 보내고,
  선생님은 학생별 수신 피어를 만듭니다. 선생님의 “화면 요청”은 학생에게 배너만 띄웁니다.
- 미디어는 P2P(DTLS-SRTP)로만 흐르며 서버에 저장되지 않습니다.
- 기본 ICE는 공개 STUN. 다른 네트워크는 TURN이 필요할 수 있습니다(`docs/INTERNET_SETUP.md`).

## API 표면

| 메서드 | 경로 | 인증 |
| --- | --- | --- |
| POST | `/api/v1/auth/login`, `/logout` | 공개 / 쿠키 |
| GET | `/api/v1/auth/me` | 쿠키 |
| GET/POST | `/api/v1/classrooms` | 선생님 |
| GET/PATCH | `/api/v1/classrooms/:id` | 선생님(소유) |
| GET | `/api/v1/classrooms/:id/state` | 선생님(소유) |
| POST | `/api/v1/classrooms/:id/start`, `/end` | 선생님(소유) |
| GET | `/api/v1/classrooms/:id/events` | 선생님(소유) |
| GET/POST | `/api/v1/join/:code` | 공개 / 참가 |
| GET | `/api/v1/join/:code/state` | 참가 토큰 |
| POST | `/api/v1/join/:code/leave` | 참가 토큰 |
| POST | `/api/v1/padlet/resolve` | 선생님(소유자) — 공개 Padlet 주소 → embed 주소 |
| WS | `/api/v1/realtime/:classroomId` | 쿠키 또는 참가 토큰 |

## 보관과 정리

- **수업 종료 시 즉시 파기**: D1 참가자 삭제, DO의 live·events·quiz·quiz_answers·worksheet·
  worksheet_submissions·board·board_cards·input_previews·config 전체 삭제, 소켓 종료.
- 매일 03:17 UTC Cron은 비정상 종료로 남은 참가자 행을 지우는 안전망입니다.
- 선생님 PC의 보드/PDF/게임 세트는 선생님이 직접 삭제할 때까지 남습니다.
- 수업 요약 행(제목·참가 코드·시작/종료 시각)은 선생님 목록을 위해 D1에 남습니다.

## 클라이언트 구성

- `src/lib/realtime.ts` — 지수 백오프 재연결, 20초 ping, 소량 outbox.
- `src/lib/focus.ts` — 전체화면·가시성 관측.
- `src/lib/boardStore.ts` — IndexedDB 보드함, 템플릿, JSON 가져오기/내보내기.
- `src/lib/gameStore.ts` — localStorage 게임 세트(기본 16개: 영단어·과일·요일·수도·OX·수학·속담), JSON 가져오기/내보내기.
- `src/lib/materialStore.ts` — IndexedDB PDF 보관.
- `src/lib/fileTransfer.ts` — PDF 조각 인코딩/재조립.
- `src/lib/screenShare.ts` — WebRTC 피어, 역할별 시그널링 처리.
- `src/lib/studentStore.ts` — 수업 코드별 참가 토큰(localStorage).
