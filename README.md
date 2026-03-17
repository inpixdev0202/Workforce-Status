# Workforce Status Management System
# 인력현황 관리 시스템

엑셀 기반 인력현황 관리를 웹 애플리케이션으로 전환한 시스템입니다.

## 주요 기능

- ✅ **그룹 관리**: SCG, CDG, FDG, ISG1, ISD 등 동적 그룹 추가/삭제
- ✅ **직원 관리**: 직원 정보 등록, 수정, 삭제 및 검색
- ✅ **출퇴근 관리**: 월별 캘린더 뷰로 출퇴근 상태 관리
- ✅ **대시보드**: 그룹별 인원 현황 및 통계

## 기술 스택

### Backend
- Node.js + Express
- SQLite (better-sqlite3)
- REST API

### Frontend
- React 18
- Vite
- React Router
- Axios
- date-fns

## 설치 및 실행

### 1. 백엔드 설정

```bash
cd server
npm install
npm run dev
```

서버는 `http://localhost:5000`에서 실행됩니다.

### 2. 프론트엔드 설정

```bash
cd client
npm install
npm run dev
```

클라이언트는 `http://localhost:5173`에서 실행됩니다.

## 프로젝트 구조

```
Workforce-Status/
├── server/                 # 백엔드
│   ├── routes/            # API 라우트
│   │   ├── groups.js      # 그룹 API
│   │   ├── employees.js   # 직원 API
│   │   └── attendance.js  # 출퇴근 API
│   ├── db.js              # 데이터베이스 설정
│   ├── server.js          # Express 서버
│   └── package.json
│
└── client/                # 프론트엔드
    ├── src/
    │   ├── components/    # React 컴포넌트
    │   │   ├── Dashboard.jsx
    │   │   ├── EmployeeList.jsx
    │   │   ├── EmployeeForm.jsx
    │   │   ├── GroupManager.jsx
    │   │   └── AttendanceCalendar.jsx
    │   ├── api.js         # API 클라이언트
    │   ├── App.jsx        # 메인 앱
    │   └── index.css      # 스타일
    └── package.json
```

## API 엔드포인트

### Groups (그룹)
- `GET /api/groups` - 모든 그룹 조회
- `POST /api/groups` - 그룹 생성
- `PUT /api/groups/:id` - 그룹 수정
- `DELETE /api/groups/:id` - 그룹 삭제

### Employees (직원)
- `GET /api/employees` - 직원 목록 조회 (필터링 가능)
- `POST /api/employees` - 직원 추가
- `PUT /api/employees/:id` - 직원 정보 수정
- `DELETE /api/employees/:id` - 직원 삭제

### Attendance (출퇴근)
- `GET /api/attendance` - 출퇴근 기록 조회
- `POST /api/attendance` - 출퇴근 기록 추가/수정
- `GET /api/attendance/summary/monthly` - 월별 요약

### Dashboard (대시보드)
- `GET /api/dashboard/stats` - 통계 데이터

## 배포

### GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### Vercel (프론트엔드)
1. Vercel 계정에 로그인
2. 프로젝트 import
3. Root Directory를 `client`로 설정
4. Build Command: `npm run build`
5. Output Directory: `dist`

### Vercel (백엔드 - Serverless Functions)
백엔드를 Vercel Serverless Functions로 배포하려면 추가 설정이 필요합니다.
또는 Railway, Render 등의 서비스를 사용할 수 있습니다.

## 라이선스

MIT
