> 이 문서는 사용자가 제공한 원본 `설계.txt`를 글자 그대로 보존한 사본입니다. AIC 2.1은 이 설계의 전체 10개 모듈 중 **Classroom · Interactive · Documents**를 중심으로, 여기에 **수업 집중 관리**와 **화면 녹화**를 독립 모듈로 더해 구현했습니다. 현재 구현 범위와 해석은 `docs/ARCHITECTURE.md`를 참고하세요.

좋아. 이제 \*\*All-in-One Class(AIC)\*\*를 정식 프로젝트로 설계하자.

이번에는 단순히 기능 목록을 나열하는 게 아니라, 실제 개발을 시작할 수 있도록 제품 기획, 전체 기능 명세, 시스템 아키텍처, 데이터베이스, 실시간 통신, 보안, 개발 로드맵까지 하나의 설계 문서로 정리할게.

내가 잡은 핵심 방향은 이거야.

# **AIC**

FULL PLATFORM

# **One Platform. Every Classroom.**

수업에 필요한 모든 기능을 하나의 공간에서 제공하는 통합 교육 플랫폼.

수업

협업

AI

**제품의 핵심 원칙**

- 선생님과 학생 모두를 위한 플랫폼
- 수업 도중 다른 사이트로 이동할 필요가 없음
- 기능 간 데이터와 작업 결과가 연결됨
- PC, 태블릿, 스마트폰 지원
- 기능을 독립적으로 확장할 수 있는 모듈 구조

# **1. 제품 전체 구조**

AIC는 크게 10개 영역으로 구성하자.

## **AIC Platform Architecture**

# **AIC Core**

인증 · 권한 · 사용자 · 데이터 · 실시간 이벤트

**Classroom**

실시간 수업

**Interactive**

퀴즈와 참여

**Workspace**

협업 작업 공간

**Documents**

문서와 학습지

**Presentation**

발표와 슬라이드

**Assessment**

평가와 시험

**Board**

화이트보드와 게시판

**Content**

콘텐츠 제작과 공유

**AI Studio**

AI 학습 도구

**Utilities**

수업 보조 도구

**Shared Services**

파일 · 알림 · 검색 · 템플릿 · 분석 · 저장소

여기서 중요한 건 10개 기능을 각각 별개의 서비스로 만드는 게 아니라, AIC Core 위에서 작동하는 하나의 플랫폼으로 만드는 거야.

# **2. 전체 기능 명세**

## **① Classroom — 실시간 수업 시스템**

핵심 모듈

[Engageli: Where Online Learning Happens](https://images.openai.com/static-rsc-4/B7GWA23zjZs_6uY5Tj650RRBJQEONv_SocryE7l2-6vd1LoQwuVanxoNCPlPlWv44jGB8N-Wlq4s3SrcxyrxN8bFA01wnE2w2C7JCc_LDuI0vOt-Q9Z38RbYx_mMrdgFwmSX-Ax5kaM9h7iwBGtKGx3bUv1CJwkySBzE6i15Dak?purpose=inline)

[Live Classroom > Bottom Panel > Present – Engageli Help Center](https://images.openai.com/static-rsc-4/EtZI7x9AVDMBvA5OICrM8TEsm8uUzxQFjVMszFRjZWMLUwYprCL4lYBvTuRLYI9Jc5wnnYillhhZOKkon8Ow-LHP9UlLDMics6BAaVisovhj42hVpXnRk5-3PnSOUUVCAOwUizCLY7EM1_fkmJdFahwJttrlwIgQuEPnbQQrFEA?purpose=inline)

[高等教育機関向けDXプラットフォーム「Schoo Swing」が、第19回 日本e-Learning大賞にて「EdTech特別部門賞」を受賞](https://images.openai.com/static-rsc-4/xqbR83yI7d9It3NJGJfu-1JtNA-LntbToSmcGbr63TbjeolUq9NDnr5i5CDPU3ID6nlA-Fb-08GGy-bKch9wIEj8onFTDz6pRkLpA_h8yL84gO1NZPWrIK4tFhgA5PEMYFzfCWhP26_w7jXTLXWbV0TJxNM8SfsEwH3lslR0nHQ?purpose=inline)

14

수업을 시작하고 학생들을 참여시키는 중심 공간이야.

**선생님 기능**

- 수업 공간 생성 및 종료
- 수업 참여 코드와 QR 생성
- 학생 입장 승인 및 퇴장
- 화면 공유
- 화면 고정 및 발표자 지정
- 전체 공지 전송
- 학생들의 활동 상태 확인
- 수업 중 퀴즈와 투표 실행
- 자료 및 문서 즉시 배포
- 수업 기록 저장

**학생 기능**

- 코드 또는 QR로 입장
- 선생님 화면 확인
- 발표 및 화면 공유 요청
- 질문과 손들기
- 실시간 채팅
- 자료 열기 및 제출
- 수업 활동 참여

**공통 기능**

- 실시간 참여자 목록
- 수업 타이머
- 알림
- 진행 중인 활동 표시
- 수업 내 자료와 결과물 통합 관리

## **② Interactive — 학생 참여 시스템**

[How to Host a Quiz – Wayground for Business](https://images.openai.com/static-rsc-4/i-Yb2Wg-ag74HYUnUgr8mK2kecKIUfSjr5IQ4FcLILFo81-hHklix5ixglrm8dIYA1yt8w8bqOYwnXKluByrcnp3mPgySNDgtS3cbnE0Ja98BPiC-AQ8Q-lsRQa-vnaUTqXd3woT567bTjROleqNsM2-j0UhimLVO0y4KPRUq5I?purpose=inline)

[Release Notes for Engageli Version 3.1.56-20260122 – Engageli Help Center](https://images.openai.com/static-rsc-4/J7qSTiNWmpz0VYEZkKrR-Mdk8EM2FqtaS978faM9hNKowyGB3JEOu8BtfPKI1LPoGTS2bNGXpC00Lrp75a2dSrdzpBSXJoOPMhFOqJgzyDwguintiFbVDE6QkYyiCV-tjHPyv-bkgVH-AHD4U2pcZ27gGUd0-8CZInfYlUH_wx0?purpose=inline)

[Create a Live Word Cloud in PowerPoint | ClassPoint](https://images.openai.com/static-rsc-4/2oQQMJklXFTz1Z4-G7l9LMg7ojVFjf2hWr7xom5cri-dv34SPgmGXqO81U-0dBS6cp8U0-eK4XLrt9oiRENOQQqi4xtTooHSFDVxjCw_X1qvoiOhbZZztr4bSoW50XXnJzBd1BxUa89t-WMQV1orppO8ubtHQHI-0bIvaC1zIPI?purpose=inline)

10

띵커벨과 같은 학생 참여 기능을 독자적으로 구현하는 영역이야.

| 기능     | 세부 기능             |
| ------ | ----------------- |
| 퀴즈     | 객관식, 주관식, OX, 단답형 |
| 실시간 투표 | 선택형, 복수 선택        |
| 토론     | 찬반 토론, 의견 제출      |
| 워드클라우드 | 단어 수집 및 시각화       |
| 설문     | 질문 생성, 결과 분석      |
| 게임     | 점수 경쟁, 팀 대항       |
| 랜덤     | 학생 및 팀 추첨         |
| 질문     | 익명 질문, 공개 질문      |

추가로 다음 기능도 넣자.

- 실시간 정답률
- 응답자별 제출 현황
- 문제별 통계
- 자동 채점
- 문제 은행
- 퀴즈 템플릿
- 결과 PDF 내보내기

## **③ Workspace — 협업 작업 공간**

[Brand assets & guidelines | Mural](https://images.openai.com/static-rsc-4/1BeQlD8dPMYb-FnQbPhFXSkn39bbxgTPTwZA0kjpMlhUReAtpmYHMaHvlG4xiEOnLXCO_NFw5ubIZjqt7xuQwPgGIVYnM7lUsj7mi-F4JD_GWqw2tCZRwzDtWtkioOJTc-Y0hIgI4yN5Ps8FUqFCkJfv_kjnPMmoJzIxCUJs8ek?purpose=inline)

[Figma for Education | Free Tools for the Classroom](https://images.openai.com/static-rsc-4/2z60XNHeTF4ADoj8B7cxI_a9rdPWbp_TH1q71XkAG3BfgSTdD0E-RVt5PH9A-T0G4CIPGpc6cmGObyKjTkH89hhf52fHIQyYE66tcKsQLlVPyVvIMH4KmvalwonOzFYITcDR9sBpbS-rBfXXSi7pDmZwqzC_RzvY3nwmLphLTm4?purpose=inline)

10

학생들이 함께 작업하는 공간이야.

- 무한 화이트보드
- 포스트잇 보드
- 마인드맵
- 공동 브레인스토밍
- 그룹별 작업 공간
- 실시간 커서
- 이미지 및 파일 삽입
- 도형 및 연결선
- 댓글과 반응
- 작업 이력
- 결과물 내보내기

특히 화이트보드 하나에서 텍스트, 이미지, 도형, PDF 페이지를 함께 배치할 수 있도록 설계하자.

## **④ Documents — 통합 문서 시스템**

[Der beste Online Word Editor für Dokumente | ONLYOFFICE](https://images.openai.com/static-rsc-4/1IHt52sqkmG0El91-MWZIwa6_r4BQGozpKl9eiIRF4-HyzmGL36HRrCU73IT_otgcVeIuwkmS66EgKIvTn0Z99lEDFBB0v2oY_U3b8kiSyDpDnRo93HM9GH2seFz2qKZnD4W_ojAO9frG9vDOX3b1k1rVgZf3bRCtrRMtC8z4HU?purpose=inline)

[onlyoffice.com](https://www.onlyoffice.com/de/document-editor?utm_source=chatgpt.com)

단순한 메모장이 아니라 독립적인 문서 편집 시스템이야.

- 텍스트 문서
- 서식 및 표
- 이미지 삽입
- PDF 뷰어
- PDF 주석 및 판서
- 공동 편집
- 자동 저장
- 문서 버전 관리
- 문서 공유
- 문서 템플릿
- 인쇄 및 PDF 내보내기

문서와 화이트보드가 연결되어야 해. 예를 들어 문서의 내용을 화이트보드에 가져오거나 화이트보드 결과를 문서로 변환할 수 있게 하는 거지.

## **⑤ Presentation — 발표 제작 및 진행**

[Sunum hazırlamak için en iyi slayt programları | DonanımHaber](https://images.openai.com/static-rsc-4/fceih_3q5xxuJ0Sz-HFYUh4cW0GgitBAziLTc8A1nky_3JMDB99QUA3diQq3-y14PN77AjmLy0aTGh0imFZdMv6fpmD2Rttp-tH-dpG4yhM_5o3znMwbNVDqqhZ6x1G2p2yasl41rTOTCR-3TC6ynGzycZGYpubpu2AYqxNDt8Q?purpose=inline)

[donanimhaber.com](https://www.donanimhaber.com/sunum-hazirlamak-icin-en-iyi-slayt-programlari--165737?utm_source=chatgpt.com)

- 슬라이드 제작
- 슬라이드 템플릿
- 텍스트, 이미지, 도형
- 애니메이션 및 전환
- 발표자 모드
- 발표자 노트
- 실시간 발표
- 학생 발표
- 화면 공유 연동
- PDF 및 이미지 내보내기

## **⑥ Assessment — 평가 및 시험**

- 시험지 제작
- 문제 출제
- 객관식 및 주관식
- 시간제한 시험
- 자동 채점
- 수동 채점
- 학생 답변 확인
- 정답 및 해설 공개
- 평가 결과 통계
- 오답 분석
- 재시험 및 복습

시험 진행 중에는 문제 공개 시점, 제출 시간, 답안 공개 여부 등을 선생님이 설정할 수 있어야 해.

## **⑦ Board — 게시판과 자료 공유**

[Mentions](https://images.openai.com/static-rsc-4/AUkR2QWDgvhjX9BvVHzdJZmUcAKwCMVVG9cgb6AZP5VvQAYkut92CnUNUS0xvO-r9IJZFuboFjfpRBbSeWtHk7vB3udBTYqb3z0D2qliz_roARUPG7UtL-Ovz5mE0dvmW6RUumGqIf9CN69Iv8uxADC6HVzmPZtfnXf6XP3IJ1c?purpose=inline)

[padlet.blog](https://padlet.blog/mentions/?utm_source=chatgpt.com)

- 자유 게시판
- 질문 게시판
- 자료 공유 게시판
- 공지 게시판
- 이미지 및 파일 첨부
- 댓글
- 좋아요 및 반응
- 게시물 검색
- 카테고리
- 공개 및 비공개 설정

## **⑧ Content — 교육 콘텐츠 제작소**

이 영역은 다른 서비스들과 차별화할 수 있는 부분이야.

- 학습지 제작기
- 퀴즈 제작기
- 시험지 제작기
- 수업 자료 제작기
- 템플릿 라이브러리
- 직접 제작한 자료 저장
- 자료 공유 및 복제
- 자료를 수업으로 바로 가져오기

## **⑨ AI Studio — AI 교육 도구**

- AI 문제 생성
- PDF 내용 요약
- 학습지 자동 생성
- 문제 해설 생성
- 발표 자료 초안 생성
- 문서 교정
- 토론 주제 추천
- 학생 질문 답변
- 학습 콘텐츠 변환

AI는 특정 모델에 종속되지 않도록 Provider 구조로 설계하자. API를 바꾸거나 다른 AI를 추가해도 나머지 시스템을 수정할 필요가 없어야 해.

## **⑩ Utilities — 수업 보조 도구**

- 랜덤 학생 추첨
- 랜덤 팀 편성
- 자리 배치
- 타이머
- 스톱워치
- 주사위
- 룰렛
- 모둠별 점수판
- 발표 순서 지정
- 소음 측정
- QR 생성
- 수업 시간표

# **3. 사용자 및 권한 시스템**

AIC는 선생님과 학생 모두가 사용할 수 있어야 해.

단, 역할에 따라 사용할 수 있는 기능이 달라져.

| 권한     | 선생님      | 학생       |
| ------ | -------- | -------- |
| 수업 생성  | 가능       | 가능 여부 설정 |
| 수업 참여  | 가능       | 가능       |
| 화면 공유  | 가능       | 허용 시 가능  |
| 퀴즈 생성  | 가능       | 권한에 따라   |
| 퀴즈 참여  | 가능       | 가능       |
| 문서 생성  | 가능       | 가능       |
| 공동 편집  | 가능       | 가능       |
| 시험 생성  | 가능       | 제한적      |
| 시험 응시  | 가능 여부 설정 | 가능       |
| 게시판 관리 | 관리 가능    | 게시 가능    |
| 자료 공유  | 가능       | 권한에 따라   |
| AI 도구  | 전체 도구    | 허용된 도구   |

**중요한 설계 원칙:** 선생님과 학생을 서로 완전히 다른 프로그램으로 만들지 말자.

하나의 계정 시스템을 사용하고, 역할과 권한에 따라 기능을 제어하는 방식이 좋아.

### **수업 공간 구조**

```
AIC
 ├── User
 │    ├── Teacher
 │    └── Student
 │
 ├── Workspace
 │    ├── Members
 │    ├── Resources
 │    └── Documents
 │
 └── Session
      ├── Participants
      ├── Live Activities
      ├── Shared Screen
      ├── Quiz
      └── Results
```

여기서 Workspace는 지속적으로 사용하는 작업 공간이고 Session은 실제 수업이 진행되는 일시적인 공간이야.

특정 학교나 학급에 종속되지 않아도 수업을 만들고 공유할 수 있게 하자.

# **4. 전체 UI/UX 설계**

AIC는 기능이 많기 때문에 UI가 특히 중요해.

기능을 무작정 한 화면에 넣으면 복잡해지므로, 통합 대시보드와 작업 공간을 분리하는 걸 추천해.

[Academic - Edutech Platform by Barly Design for Uxerflow on Dribbble](https://images.openai.com/static-rsc-4/AfAM62aVS2GliMzCu7ZoSAhWvywHYRU_QipkbI-THVI78h_2mmsg5VjgmED5b9sJFow-CwukjVAd-MboeZ53IE51hVkuSmxUWcOWNuAQip6YqPGIkjA8mtneposJItr7nPufzLJ_ZeFz9Sqe9doCiggtnMOYjqCSYCCUfXFW9IY?purpose=inline)

[Online Meeting designs, themes, templates and downloadable graphic elements on Dribbble](https://images.openai.com/static-rsc-4/LqEqFEa-lEPsmU0gYxHRA6Nt8Ns7pUmh3i6fIwwcJ58hqMdZy5ref715pO1mdSLNx62-A8rjUYRRVBmAMeZ0KY5kFCuE4d2F8vTwBfhwz2SFI03CqUO2EaxBVqwCk-P0fay-hVhRKjEN6t6wqwMYuxl8hiDdTDu3hhiiU5HwCew?purpose=inline)

[Project Management Dashboard — Kanban View by Jason D on Dribbble](https://images.openai.com/static-rsc-4/E4iZrRONVxUaV_9xNsu218SKjH2G8c3ymwMZKZJ5hnCrDneLbFOZ08fMaxPBUHXUPfZL468FR6xtwIjyLUdlZuWg3BVQQ694-Bz-o3QvWDaky6DjJbyZe9C46wMtQW7cUOdzqDph_cZnHqA8kX6OU_opuarXvy1moVJA14hTMKs?purpose=inline)

10

## **메인 화면**

왼쪽 사이드바:

- 홈
- 내 작업 공간
- 수업
- 문서
- 화이트보드
- 퀴즈
- 시험
- 발표
- 자료실
- AI Studio
- 도구 모음

중앙 영역:

- 최근 작업
- 진행 중인 수업
- 최근 문서
- 최근 사용한 도구
- 공유받은 자료
- 바로가기

상단:

- 통합 검색
- 알림
- 빠른 실행
- 프로필

## **수업 화면**

수업 화면은 별도의 집중형 인터페이스로 만들자.

**AIC Classroom**

LIVE

**수업 콘텐츠 영역**

화면 공유 · 문서 · 발표 · 화이트보드

참여자

채팅

자료

손들기

수업 도구

전체 도구 보기

퀴즈

투표

화이트보드

발표

타이머

자료

수업 화면의 레이아웃 개념도

수업 중에는 퀴즈를 실행해도 기존 화면을 완전히 벗어나지 않도록 오버레이나 분할 패널로 실행하는 것이 좋아.

# **5. 기술 아키텍처**

이제 실제 구현 기술을 정하자.

내 추천은 **React + TypeScript 기반의 모듈형 모놀리스 아키텍처**야.

초기부터 마이크로서비스를 여러 개 운영하면 개발과 배포가 복잡해져. 하나의 백엔드에서 모듈을 분리하는 것이 효율적이야.

# **AIC Technical Architecture**

**Client Applications**

Desktop

Tablet

Mobile

React · TypeScript · Responsive PWA

**API Gateway**

인증 · 요청 검증 · 권한 확인 · 라우팅

**AIC Backend — Cloudflare Workers**

User & Auth

Workspace

Classroom

Interactive

Documents

Presentation

Assessment

Content & AI

Utilities

Notifications

**D1**

관계형 데이터

**Durable Objects**

실시간 세션

**Object Storage**

PDF 및 파일

**WebSocket**

실시간 이벤트

## **추천 기술 스택**

| 영역     | 기술                          |
| ------ | --------------------------- |
| 언어     | TypeScript                  |
| 프론트엔드  | React                       |
| 빌드     | Vite                        |
| UI     | Tailwind CSS                |
| 컴포넌트   | Radix UI 기반                 |
| 서버     | Cloudflare Workers          |
| API    | REST + OpenAPI              |
| 데이터베이스 | Cloudflare D1               |
| 실시간    | Durable Objects + WebSocket |
| 파일 저장  | Object Storage 어댑터          |
| 공동 편집  | Yjs                         |
| 화면 공유  | WebRTC                      |
| 인증     | Google OAuth + 자체 계정        |
| 배포     | Cloudflare Pages / Workers  |

### **왜 이런 구성이 좋을까?**

**React + TypeScript**

기능이 매우 많으므로 타입 안정성과 컴포넌트 재사용이 중요해.

**Cloudflare Workers**

별도의 서버 컴퓨터를 직접 운영하지 않고 API를 배포할 수 있어.

**D1**

사용자, 작업 공간, 문서, 퀴즈, 결과 등의 관계형 데이터를 관리하기 좋아.

**Durable Objects**

수업별 실시간 상태를 관리하는 데 적합해. 예를 들어 한 수업의 참여자, 퀴즈 진행 상태, 발표자 등을 하나의 세션 객체에서 관리할 수 있어.

**Yjs**

문서와 화이트보드 공동 편집에서 동시 수정 충돌을 처리하는 데 사용할 수 있어.

다만 Yjs 자체가 저장소나 네트워크 서버를 제공하는 것은 아니므로 별도의 영속성 및 동기화 계층이 필요해.

# **6. 실시간 시스템 설계**

AIC에서 가장 중요한 기술 영역 중 하나야.

일반적인 CRUD 웹앱과 달리 여러 사용자가 동시에 같은 수업에 들어와서 활동하기 때문이지.

## **실시간 이벤트 구조**

예를 들어 선생님이 퀴즈를 시작하면 다음과 같이 작동해.

```

Teacher
   |
   | quiz.start
   v
AIC API
   |
   | 권한 확인 및 퀴즈 검증
   v
Classroom Session
   |
   | WebSocket Broadcast
   |
   +------ Student A
   |
   +------ Student B
   |
   +------ Student C
   |
   +------ Student D

```

이벤트는 공통 형식으로 통일하자.

```
interface AICEvent<T = unknown> {
  id: string;
  type: string;
  sessionId: string;
  senderId: string;
  timestamp: number;
  payload: T;
}
```

이벤트 예시:

```
session.join
session.leave
screen.start
screen.stop
quiz.start
quiz.answer
quiz.end
poll.start
poll.vote
board.update
document.update
participant.raise_hand
presentation.change_slide
```

이렇게 하면 각 기능이 서로 다른 통신 방식을 구현할 필요가 없어.

## **화면 공유 구조**

화면 공유는 WebRTC를 사용하자.

- 선생님 화면 공유
- 학생 화면 공유
- 발표자 화면 공유
- 화면 공유 요청 및 승인
- 공유 화면 시청자 관리

주의할 점은 WebRTC가 연결 신호 전달 서버를 대신 제공하지 않는다는 거야. 별도 Signaling이 필요하고, 네트워크 환경에 따라 TURN 중계 서버도 필요해.

많은 학생에게 동시에 영상을 전송하는 상황에서는 P2P만으로는 부담이 커질 수 있어. 따라서 초기 소규모 수업은 P2P로 시작하고, 규모가 커지면 SFU 방식의 미디어 서버를 도입하는 게 좋아.

## **공동 편집 구조**

문서와 화이트보드는 Yjs 기반으로 설계하자.

```
User A ─┐
User B ─┼── Collaboration Server
User C ─┘          |
                   v
              Yjs Document
                   |
             Persistence
                   |
                   v
               Database
```

문서의 변경사항은 실시간으로 공유하고, 일정 간격 또는 변경 단위로 영구 저장하도록 하자.

# **7. 데이터베이스 설계**

초기에는 D1에 다음 테이블을 만들면 돼.

| 테이블                 | 역할       |
| ------------------- | -------- |
| users               | 사용자      |
| user_profiles       | 사용자 프로필  |
| workspaces          | 작업 공간    |
| workspace_members   | 참여자      |
| sessions            | 수업 세션    |
| session_members     | 세션 참여자   |
| documents           | 문서       |
| document_versions   | 문서 버전    |
| resources           | 업로드 파일   |
| boards              | 협업 보드    |
| board_objects       | 보드 객체    |
| quizzes             | 퀴즈       |
| quiz_questions      | 문제       |
| quiz_answers        | 답변       |
| polls               | 투표       |
| poll_responses      | 투표 응답    |
| exams               | 시험       |
| exam_submissions    | 시험 제출    |
| presentations       | 발표 자료    |
| presentation_slides | 슬라이드     |
| posts               | 게시물      |
| comments            | 댓글       |
| notifications       | 알림       |
| activities          | 활동 기록    |
| ai_generations      | AI 생성 기록 |

추가로 다음 원칙을 지키자.

- 모든 데이터에 고유 ID 사용
- 생성 및 수정 시간 기록
- 사용자별 접근 권한 확인
- 파일 데이터와 파일 메타데이터 분리
- 중요한 작업은 감사 로그 기록
- 삭제는 필요한 경우 복구 가능한 소프트 삭제 지원

실시간 상태는 D1에 매번 쓰지 말고 Durable Objects에서 관리하는 게 좋아. 영구 보관해야 하는 결과와 문서만 데이터베이스에 저장하자.

# **8. 파일 저장 및 문서 처리**

AIC는 PDF, 이미지, 동영상, 문서 등 파일을 많이 다루기 때문에 저장 시스템을 잘 설계해야 해.

여기서는 특정 저장소에 종속되지 않는 구조를 추천해.

## **Storage Adapter**

```
AIC Storage
    |
    +-- Local Development Storage
    |
    +-- Cloudflare R2
    |
    +-- S3 Compatible Storage
    |
    +-- Other Storage Providers
```

파일 저장 기능은 공통 인터페이스로 구현하자.

```
interface StorageProvider {
  upload(file: File, path: string): Promise<string>;

  download(path: string): Promise<Blob>;

  delete(path: string): Promise<void>;

  getMetadata(path: string): Promise<FileMetadata>;
}
```

이렇게 하면 저장소를 바꿔도 문서나 학습지 모듈을 다시 개발할 필요가 없어.

**파일 처리 파이프라인**

1. 파일 업로드 요청
2. 사용자 권한 검사
3. 파일 크기 및 확장자 검사
4. 저장소에 업로드
5. 메타데이터 기록
6. 필요한 미리보기 생성
7. 자료실에서 접근 가능하도록 등록

PDF는 브라우저에서 볼 수 있도록 PDF.js를 활용하는 방향이 좋아.

이미지는 미리보기와 원본을 구분하고, 동영상은 업로드 용량과 재생 성능을 고려해 별도 미디어 처리 계층을 두자.

# **9. API 설계**

API도 처음부터 규칙을 정해놓자.

기본 주소:

```
/api/v1/
```

주요 엔드포인트:

| 영역    | API                |
| ----- | ------------------ |
| 인증    | `/auth/*`          |
| 사용자   | `/users/*`         |
| 작업 공간 | `/workspaces/*`    |
| 수업    | `/sessions/*`      |
| 문서    | `/documents/*`     |
| 자료    | `/resources/*`     |
| 퀴즈    | `/quizzes/*`       |
| 투표    | `/polls/*`         |
| 시험    | `/exams/*`         |
| 보드    | `/boards/*`        |
| 발표    | `/presentations/*` |
| 게시판   | `/posts/*`         |
| AI    | `/ai/*`            |
| 알림    | `/notifications/*` |

예를 들어 퀴즈 생성은 다음처럼 설계할 수 있어.

```
POST /api/v1/quizzes
Content-Type: application/json
```

```
{
  "title": "과학 퀴즈",
  "type": "multiple_choice",
  "questions": [
    {
      "content": "물의 화학식은?",
      "options": ["CO2", "H2O", "O2"],
      "answer": 1
    }
  ]
}
```

실제 정답 데이터는 학생용 API 응답에 포함하지 않아야 해. 학생에게는 문제와 선택지만 전달하고, 채점은 서버에서 처리해야 하지.

# **10. 프로젝트 디렉터리 구조**

개발할 때 가장 중요한 부분 중 하나야.

기능별로 명확하게 분리하고, 불필요하게 복잡한 폴더 계층은 만들지 않는 방향으로 하자.

```
AIC/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── pages/
│   │   │   ├── layouts/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── worker/
│       ├── src/
│       │   ├── api/
│       │   ├── auth/
│       │   ├── core/
│       │   ├── modules/
│       │   ├── realtime/
│       │   ├── storage/
│       │   └── index.ts
│       └── wrangler.toml
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── schemas/
│   ├── events/
│   ├── editor/
│   ├── collaboration/
│   └── shared/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── API.md
│   ├── DATABASE.md
│   └── SECURITY.md
│
├── tests/
│
├── package.json
└── README.md
```

### **구조의 핵심**

- `apps/web`: 사용자에게 보여주는 웹앱
- `apps/worker`: 백엔드 및 API
- `packages/ui`: 공통 UI 컴포넌트
- `packages/events`: 실시간 이벤트 규격
- `packages/editor`: 문서 편집기
- `packages/collaboration`: 공동 편집 기능
- `database`: 스키마 및 마이그레이션

각 기능은 독립적인 모듈로 관리하되 공통 기능을 재사용해야 해.

# **11. 보안 및 개인정보 보호**

AIC는 미성년 학생들도 이용할 수 있으므로 이 부분은 처음부터 설계해야 해.

| 항목    | 설계                    |
| ----- | --------------------- |
| 인증    | OAuth 및 안전한 세션        |
| 비밀번호  | Argon2id 해싱           |
| 권한    | 서버 측 RBAC             |
| 파일    | 비공개 기본값               |
| 파일 접근 | 만료되는 서명 URL           |
| 통신    | HTTPS 및 WSS           |
| 데이터   | 최소한의 개인정보 수집          |
| 로그    | 민감한 정보 제외             |
| 수업    | 입장 코드 만료 및 접근 제어      |
| AI    | 학생 데이터의 무분별한 외부 전송 방지 |

특히 다음 사항을 지키자.

1. 학생의 개인정보를 불필요하게 수집하지 않기.
2. 학생의 답변이나 시험 결과를 다른 학생에게 노출하지 않기.
3. 선생님이 학생 자료의 공유 범위를 설정할 수 있게 하기.
4. AI에 학생 개인정보를 자동으로 전달하지 않기.
5. 녹화나 화면 기록은 명확한 안내와 권한 없이 진행하지 않기.
6. 실제 서비스 출시 전 국내 개인정보보호법과 미성년자 관련 요구사항을 검토하기.

# **12. 개발 로드맵**

기능이 워낙 많으니까 한 번에 전부 구현하려고 하면 안 돼.

하지만 처음부터 전체 아키텍처는 확정해 놓고 기능을 순차적으로 개발하자.

## **AIC Development Roadmap**

1. **Phase 1 — Platform Foundation**

   최우선
   - 프로젝트 구조
   - 로그인 및 사용자
   - 권한 시스템
   - 대시보드
   - 작업 공간
   - 공통 UI
   - API 및 데이터베이스
2. **Phase 2 — Live Classroom**
   - 수업 생성 및 참여
   - 초대 코드와 QR
   - 실시간 참여자
   - 채팅 및 알림
   - 화면 공유
   - 수업 도구 실행 시스템
3. **Phase 3 — Interactive**
   - 퀴즈
   - 투표
   - 설문
   - 토론
   - 랜덤 추첨
   - 결과 통계
4. **Phase 4 — Workspace**
   - 화이트보드
   - 게시판
   - 마인드맵
   - 실시간 공동 작업
   - 팀별 공간
5. **Phase 5 — Documents & Presentation**
   - 문서 편집기
   - PDF 편집 및 주석
   - 학습지 제작
   - 발표 제작기
   - 슬라이드 발표
6. **Phase 6 — Assessment & Content**
   - 시험 제작
   - 자동 채점
   - 문제 은행
   - 콘텐츠 라이브러리
   - 자료 공유
7. **Phase 7 — AI Studio**
   - AI 문제 생성
   - AI 학습지 생성
   - AI 요약
   - AI 콘텐츠 제작
8. **Phase 8 — Optimization**
   - 성능 최적화
   - 모바일 최적화
   - 접근성
   - 보안 검증
   - 배포 및 운영

# **13. 반드시 추가할 차별화 기능**

단순히 여러 서비스의 기능을 합치는 데서 끝나면 아쉬워.

AIC만의 강점도 만들어야 해.

### **A. 통합 수업 도구 실행기**

수업 중 모든 기능을 빠르게 실행하는 시스템이야.

예를 들어 선생님이 퀴즈를 실행하면:

- 퀴즈 모듈이 수업 화면에 자동으로 열림
- 참여 학생에게 자동으로 전달
- 응답이 실시간으로 수집
- 종료 후 결과가 자동 저장
- 결과를 화이트보드나 문서에 바로 삽입

### **B. 모든 콘텐츠의 연결**

**PDF 학습지**

문서로 변환

퀴즈로 변환

**수업 공간에 공유**

**결과물 통합 저장**

이런 식으로 모든 기능이 서로 연결되어야 해.

### **C. 플러그인 시스템**

나중에는 새로운 기능을 쉽게 추가할 수 있도록 플러그인 구조도 만들자.

예를 들어:

```
AIC Plugin System
 ├── Core API
 ├── UI Extension API
 ├── Classroom API
 ├── Document API
 ├── Realtime API
 └── Permission API
```

향후 외부 개발자가 AIC용 수업 도구를 개발할 수 있도록 하는 거야.

단, 플러그인은 권한 제한과 격리 환경을 갖추도록 해야 해.

# **14. 운영 및 비용 전략**

무료로 시작할 수 있는 구성을 우선하자.

| 구성   | 초기 전략                |
| ---- | -------------------- |
| 웹 배포 | Cloudflare Pages     |
| API  | Workers              |
| DB   | D1                   |
| 실시간  | Durable Objects      |
| 파일   | 저장소 어댑터로 분리          |
| AI   | 선택적 API 연결           |
| 로그인  | Google OAuth + 자체 인증 |

주의할 점은 무료 요금제의 사용량과 결제 조건이 바뀔 수 있다는 거야. 특히 대용량 파일 저장, 영상 중계, AI API는 무료라고 가정하면 안 돼.

초기에는 다음을 추천해.

- 영상 녹화는 제외
- 대용량 동영상 스트리밍은 후순위
- PDF와 이미지 중심으로 시작
- AI 기능은 사용자가 직접 실행하도록 설정
- 저장소 교체가 가능하도록 설계
- 실시간 접속자 수와 트래픽 제한 관리

# **15. 최종 프로젝트 결정 사항**

# **AIC**

설계 확정안

**ALL-IN-ONE CLASS**

*One Platform. Every Classroom.*

| 항목     | 결정                          |
| ------ | --------------------------- |
| 제품     | 통합 교육 플랫폼                   |
| 플랫폼    | 웹앱 + PWA                    |
| 사용자    | 선생님 및 학생                    |
| 개발 형태  | 모듈형 모놀리스                    |
| 프론트엔드  | React + TypeScript          |
| 백엔드    | Cloudflare Workers          |
| 데이터베이스 | D1                          |
| 실시간    | Durable Objects + WebSocket |
| 공동 편집  | Yjs                         |
| 화면 공유  | WebRTC                      |
| UI     | 현대적인 SaaS 디자인               |
| 확장성    | 플러그인 지원 구조                  |
| 개발 방식  | 단계별 전체 기능 구현                |

**핵심 제품 영역**

Classroom

Interactive

Workspace

Documents

Presentation

Assessment

Board

Content

AI Studio

Utilities

## **16. 실제 개발을 시작할 때의 첫 번째 작업**

설계가 끝났으니 바로 모든 기능을 코딩하기보다는 먼저 다음 4개를 완성하는 게 좋아.

1. **AIC Core** — 인증, 사용자, 권한, 작업 공간
2. **AIC Design System** — 전체 디자인, 공통 컴포넌트
3. **AIC Module System** — 각 기능의 등록, 실행, 연결
4. **AIC Realtime Core** — 수업 및 실시간 이벤트 기반

이 네 가지가 완성되면 나머지 기능을 독립적으로 추가할 수 있어.

그리고 한 가지 더. 기존 교육 서비스의 기능을 참고하되 코드, 브랜드, 독점 콘텐츠를 복제하지 않고 AIC 자체 구현으로 만드는 게 좋아.

**내가 생각하는 AIC의 최종 모습은 이거야.**

띵커벨, 클래스툴, 패들렛, 구글 문서, 캔바 같은 서비스를 각각 실행할 필요 없이, AIC에 접속하면 수업 준비부터 진행, 협업, 평가, 결과물 저장까지 모두 해결되는 것.

이걸 단순한 학교 앱이 아니라 장기적으로 확장 가능한 독립적인 교육 플랫폼으로 만들자. 오, 이 방향이 훨씬 좋아. 그러면 AIC는 일반적인 학습 관리 시스템이 아니라 **선생님이 수업을 개설하고 학생은 로그인 없이 참여하는 교실 운영 플랫폼**이 되는 거야.

그리고 선생님이 학생 태블릿을 제어하는 기능까지 넣으면 기존 수업 서비스와 차별화되는 강력한 시스템이 될 수 있어.

내가 추천하는 구조는 다음과 같아.

# **1. 로그인 구조 변경**

추천 설계

**선생님**

로그인 필요

- Google 로그인
- 수업 생성 및 관리
- 자료 저장
- 학생 화면 제어
- 수업 기록 관리

QR 코드 / 참가 코드

**학생**

로그인 불필요

1. QR 코드 스캔
2. 이름 입력
3. 참가 버튼
4. 수업 화면 진입

학생은 계정을 만들 필요가 없어.

다만 이름은 해당 수업에서만 사용하는 임시 표시 이름으로 취급하고, 다른 수업과 연결되는 영구 학생 프로필은 만들지 않는 게 좋아.

# **2. 데이터베이스 최소화**

이 부분은 네 생각에 동의해.

학생마다 계정을 만들고, 학생별 데이터를 계속 DB에 저장하면 복잡해지고 관리 비용도 증가해.

**선생님 계정 중심 + 수업별 임시 데이터** 구조를 추천해.

## **추천 데이터 구조**

**D1 — 최소한의 영구 데이터**

- `teachers` : 선생님 계정
- `workspaces` : 선생님 작업 공간
- `saved_resources` : 저장한 자료
- `saved_documents` : 문서 및 제작물
- `saved_templates` : 퀴즈와 수업 템플릿
- `sessions` : 수업 정보 및 설정

**Durable Objects — 임시 실시간 데이터**

- 현재 참가 학생
- 학생 이름
- 접속 상태
- 현재 실행 중인 퀴즈
- 실시간 투표 결과
- 화면 공유 상태
- 학생별 임시 작업 상태

**수업 종료**

- 필요한 결과만 선생님 계정에 저장
- 임시 참가자 데이터 만료
- 저장하지 않은 데이터는 자동 삭제

이렇게 하면 학생 계정 테이블이나 학생별 장기 기록 테이블이 필요 없어.

다만 퀴즈 결과나 제출물을 보관하고 싶다면 선생님이 저장하도록 설정할 수 있어.

### **저장 방식**

| 데이터       | 저장 위치           |
| --------- | --------------- |
| 선생님 계정    | D1              |
| 선생님 문서    | D1 + 파일 저장소     |
| 수업 자료     | R2 등 객체 저장소     |
| 현재 접속 학생  | Durable Objects |
| 실시간 퀴즈 상태 | Durable Objects |
| 저장된 퀴즈 결과 | D1              |
| 임시 답변     | 메모리 또는 임시 저장소   |
| 화면 공유     | WebRTC 스트림      |

**중요:** Durable Objects의 메모리만을 영구 저장소처럼 사용하면 안 돼. 재시작이나 장애가 발생할 수 있으므로, 진행 중인 수업 상태도 필요한 경우 영속 저장소에 체크포인트를 남겨야 해.

# **3. 학생 태블릿 원격 제어 시스템**

AIC의 핵심 차별화 기능 후보

이건 별도의 모듈로 만들자.

이름은 **AIC Device Control**을 추천해.

[La Consola del tutor](https://images.openai.com/static-rsc-4/5oRenRDlM-eBfLa5D3XvT6dIjjjg2D2Kdc8sxej82Ju8uFD5qrs44RdU-NEm8DMOwbhKDjILon5SqD320tWZwaRkxi7mFo-b42SGOgnydcSCdhYph462_iJSw5Pa0bJORyEeeRKSvxilqcs3KJVhEZbd8j2VTzcv6nT3Nvn_1Yk?purpose=inline)

[help.netsupportschool.com](https://help.netsupportschool.com/es-android/Content/Android/User-interface/Tutor-Console.htm?utm_source=chatgpt.com)

## **구현할 기능**

| 기능        | 설명                    |
| --------- | --------------------- |
| 화면 공유     | 학생 태블릿 화면을 선생님에게 표시   |
| 화면 잠금     | AIC 내부 화면의 조작 제한      |
| 활동 전환     | 모든 학생의 화면을 특정 학습지로 이동 |
| URL 전송    | 학생 태블릿에 지정된 수업 자료 열기  |
| 앱 내 탐색 제한 | AIC 외부 링크 열기 제한       |
| 입력 제한     | 퀴즈 중 답변 외 조작 제한       |
| 일괄 제어     | 여러 태블릿에 동시에 명령 전달     |
| 개별 제어     | 특정 학생의 화면만 제어         |
| 화면 복귀     | 수업 시작 화면으로 복귀         |

예를 들어 이런 상황이 가능해.

**AIC Device Control**

개념 UI

현재 수업 · 참가 기기

**태블릿 01**

연결됨

**태블릿 02**

연결됨

**태블릿 03**

연결됨

**태블릿 04**

연결 끊김

**일괄 제어**

학습지 열기

화면 전환

수업 화면 고정

초기 화면 복귀

실제 기기 연결이나 제어가 실행되는 화면은 아니고 UI 설계 예시야.

## **그런데 중요한 기술적 한계가 있어**

여기서는 두 가지를 구분해야 해.

**A. AIC 내부에서 학생을 제어하는 것**

웹앱만으로 구현 가능해.

- AIC 안에서 특정 학습지만 열리게 하기
- 다른 AIC 메뉴 접근 제한
- 퀴즈 진행 중 다른 활동으로 이동 제한
- 선생님 명령에 따라 화면 변경
- 수업 중 화면 공유 요청

**B. 태블릿 자체를 제어하는 것**

일반 웹사이트만으로는 완전한 제어가 불가능해.

예를 들어 학생이 홈 버튼을 누르거나 Safari를 종료하거나 다른 앱을 실행하는 것까지 AIC 웹앱이 막을 수는 없어.

기기별로는 다음과 같은 방법이 있어.

[Use iOS's Guided Access to disable Photos delete and other app features | Macworld](https://images.openai.com/static-rsc-4/UEk4NBsxj_06UiU_fFeAQjzaNd4VhF3meiq1mELQ5YFQ87mgNSUnGkwt3HwyoatF_z-8gQRL5vHmtuHx7FCYrcoqSx8ZUj1IvWqq2fZHIGqMvQEk1wOV7OLs8d5x_3KrZ8Q-vTLaOZTtv25Ynqwoes5gZRBWYPeYApt4Llexwak?purpose=inline)

**iPadOS — Guided Access / MDM**

사용법 유도 또는 학교에서 관리하는 기기의 Single App Mode를 활용하면 특정 앱에 머물도록 제한할 수 있어.

[Android Kiosk Mode | Lock Tablets into Dedicated Devices](https://images.openai.com/static-rsc-4/rYVThiQknw-_emmxNqXr9t4GyIbNmrn0kH6-3c63_9Arw2MYm5nxLZY-Pr-Y75hlClOjEhcPpfhyRdNNGR-bUccNkaOFdxembDl0pYrVvsWztjdCYsCianrl0ntNUBENT4h-K8zRKkgzASWnp-at0wXXJLbekLOIyEc67kQoaY8?purpose=inline)

**Android — Kiosk Mode / MDM**

관리되는 기기에서는 지정한 앱만 실행하도록 제한하는 방식이 가능해.

[Edge Chromium Kiosk Mode - Can You Set A Custom Home Page/New Tab Page Instead Of Default InPrivate Info Page? - Microsoft Q&A](https://images.openai.com/static-rsc-4/9EXSrYSBbLKcGuxT3ROAA8nvMWXQIz6PZhmbHKgtCwN9ZP5rEM3UjezRZOcTe_0oSxhlv2lk3jqyHegYXC_-G9UZB2Rab8KPbk_FPzd5riF3TBXa-VOfzzHquMi_haSFHAhnNbeMYjZmEkLG7VvmbilTTa_LcrJYpN8m8QdwweU?purpose=inline)

**Windows — Assigned Access / MDM**

관리자가 지정한 앱 중심으로 사용하도록 구성할 수 있어.

따라서 내가 추천하는 건 다음 구조야.

**AIC Device Control Architecture**

**Teacher Dashboard**

선생님 제어 인터페이스

**Device Control Server**

인증 · 권한 · 명령 전달 · 상태 확인

**AIC Web Client**

모든 기기 지원

**Managed Device**

선택적 OS 관리

기본은 웹앱으로 지원하고, 학교에서 관리하는 태블릿은 별도의 기기 관리 기능을 연동하는 거야.

화면 공유나 원격 조작은 학생에게 명확하게 표시하고 허용된 수업 시간에만 작동하도록 하자. 학생 기기의 다른 앱이나 개인 데이터까지 몰래 들여다보는 기능은 넣지 않는 게 맞아.

# **4. 학생용 AIC는 설치 없이 사용**

이것도 중요해.

학생은 QR을 스캔하면 바로 웹페이지가 열리는 구조로 만들자.

```
aic.example.com/join/ABC123
```

학생의 이용 과정:

1. QR 스캔
2. 수업 이름 확인
3. 이름 입력
4. 참가
5. 수업 도구 이용

학생은 회원가입, 비밀번호, Google 로그인 전부 필요 없어.

다만 참가 코드는 추측하기 어렵게 만들고, 수업 종료 시 만료시키며, 참가자별 임시 토큰을 발급해야 해.

# **5. 수정된 AIC 전체 아키텍처**

기존 설계를 다음과 같이 변경하는 게 좋아.

| 구성                 | 역할          |
| ------------------ | ----------- |
| Teacher Auth       | 선생님 인증      |
| Teacher Workspace  | 선생님 자료 및 설정 |
| Guest Access       | 학생 비회원 입장   |
| Classroom Core     | 수업 생성 및 관리  |
| Realtime Core      | 학생 실시간 연결   |
| Device Control     | 학생 기기 제어    |
| Content System     | 문서 및 자료     |
| Interactive System | 퀴즈와 투표      |
| Collaboration      | 공동 작업       |
| Storage            | 선생님 자료 보관   |

학생 계정 관리 시스템은 제거하고, 학생은 수업에 종속된 임시 참여자로 처리하는 거야.

# **6. 선생님 데이터 저장 방식**

네가 말한 것처럼 선생님 중심으로 저장하자.

추천하는 방식은 **Cloud + Local Hybrid**야.

- 클라우드: 선생님 계정에 연결된 자료와 수업 설정 보관
- IndexedDB: 현재 기기의 임시 작업과 캐시
- 파일 저장소: PDF, 이미지, 문서 등의 원본 보관
- 자동 동기화: 다른 기기에서 로그인해도 자료 이용

즉, 선생님이 PC에서 만든 퀴즈를 나중에 태블릿에서 열 수도 있어.

# **7. 최종 변경 사항**

**AIC Architecture 2.0**

추천 확정안

- 선생님만 계정 생성 및 로그인
- 학생은 QR + 이름으로 참가
- 학생 계정 및 장기 프로필 제거
- 선생님 계정 중심 데이터 저장
- 최소한의 D1 데이터베이스
- 실시간 학생 상태는 Durable Objects
- 학생 태블릿 원격 화면 제어 모듈
- AIC 내부 화면 잠금
- 관리형 기기에서 OS 수준 키오스크 연동
- 전체 수업 도구 통합
- PC, iPad, Android 지원

## **마지막으로 중요한 질문 하나!**

학생들이 사용하는 태블릿은 어떤 종류야?

아이패드 중심 (iPadOS)

갤럭시 탭 중심 (Android)

아이패드 + 갤럭시 탭 혼합

태블릿 + Windows PC 모두

선택 완료

이걸 알아야 AIC의 기기 제어 기능을 현실적으로 설계할 수 있어.