# WMS 프로젝트 가이드

## 프로젝트 개요
**WMS — Workforce Status Management System**
인력 현황 및 프로젝트 관리 웹 시스템.
- 프론트엔드: `client/` (React 19 + Vite + Tailwind CSS)
- 백엔드: `server/` (Express + PostgreSQL/Neon)
- 배포: Vercel (`vercel.json`)

---

## 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite + React Router 7 |
| 상태관리 | Context API (AuthContext, ThemeContext) |
| HTTP | Axios + JWT Bearer 자동 주입 (`client/src/api.js`) |
| 스타일링 | Tailwind CSS + CSS 변수 테마 (`client/src/index.css`) |
| 백엔드 | Express + Node.js ES Modules |
| DB | PostgreSQL (Neon 클라우드), `server/db.js` |
| 인증 | JWT 24h + bcryptjs, `server/middleware/auth.js` |
| 아이콘 | lucide-react |
| 차트 | Recharts |
| 엑셀 | ExcelJS + file-saver |

---

## 핵심 파일 위치

```
client/src/
  api.js                  ← 모든 API 클라이언트 함수
  constants/menuConfig.js ← 메뉴 구조 & 권한 정의
  context/AuthContext.jsx ← 인증 상태
  context/ThemeContext.jsx← 다크/라이트 테마
  Layout.jsx              ← componentMap (메뉴-컴포넌트 연결)
  index.css               ← 디자인 시스템 CSS 변수

server/
  server.js               ← Express 앱 & 라우트 등록
  db.js                   ← PostgreSQL 연결 & query 헬퍼
  middleware/auth.js       ← JWT 인증 미들웨어
  routes/                 ← 각 기능별 API 라우트
```

---

## 코딩 규칙

### 로딩 상태 (반드시 이 패턴 사용)
```jsx
// 초기 진입: early return 방식
const [isInitialLoading, setIsInitialLoading] = useState(true);
if (isInitialLoading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', height:'60vh', gap:'16px' }}>
        <div style={{ width:'44px', height:'44px', border:'4px solid var(--border)',
                      borderTopColor:'var(--primary)', borderRadius:'50%',
                      animation:'spin 0.8s linear infinite' }} />
        <span style={{ color:'var(--text-muted)', fontSize:'14px' }}>데이터를 불러오는 중...</span>
    </div>
);
```

### 스타일링 원칙
- 새 색상 추가 금지 → 기존 CSS 변수 재사용 (`--primary`, `--surface-high` 등)
- 카드: `background: var(--surface-high)`
- 모달: `background: var(--surface-highest)`
- 아이콘 크기: 툴바 16px, 카드 20px, 강조 24~32px

### 컴포넌트 추가 순서
1. `server/scripts/` — DB 테이블 SQL
2. `server/routes/[name].js` — API 라우트
3. `server/server.js` — 라우트 등록
4. `client/src/api.js` — API 클라이언트 함수
5. `client/src/constants/menuConfig.js` — 메뉴 항목
6. `client/src/components/[Name].jsx` — 컴포넌트
7. `client/src/Layout.jsx` — componentMap 등록

### 역할(Role) 종류
`Admin`, `GroupLeader`, `TeamLeader`, `PD`, `PM`, `GM`

---

## 개발 품질 체크리스트

기능 완성 전:
- [ ] 초기 로딩 스피너 (isInitialLoading early return)
- [ ] 빈 데이터 empty state UI
- [ ] 에러 처리 (try/catch)
- [ ] 다크/라이트 테마 모두 확인
- [ ] 모바일 768px 이하 확인
- [ ] 권한 체크 (allowedRoles)

배포 전:
- [ ] git commit → push
- [ ] Vercel 자동 배포 확인
- [ ] `client/index.html` 탭 타이틀
- [ ] `client/public/manifest.json` 앱 이름

---

## 전체 방법론 참고
`C:\Users\inpix\.claude\methodology.md` — 신규 시스템 개발 방법론 전문
