# Workforce Status (WMS) 개발 환경 구동 매뉴얼

이 가이드는 `Workforce-Status` (WMS) 프로젝트의 프론트엔드 및 백엔드 개발 환경을 터미널에서 구동하고 관리하는 방법을 설명합니다.

---

## 💻 1. 로컬 개발 환경 실행 (npm)

로컬 PC에 Node.js가 설치되어 있을 때 사용하는 가장 일반적인 방법입니다. 백엔드와 프론트엔드를 각각 다른 터미널 창에서 실행해야 합니다.

### 1-1. 백엔드 API 서버 실행
백엔드 서버는 `Express`와 `MySQL` 데이터베이스 커넥션을 관리합니다.

1. **터미널을 열고 백엔드 디렉터리로 이동합니다.**
   ```bash
   cd c:\myworkspace\Workforce-Status\server
   ```
2. **필요한 패키지를 설치합니다.** (최초 1회 또는 패키지 변경 시)
   ```bash
   npm install
   ```
3. **백엔드 서버를 개발 모드로 실행합니다.**
   ```bash
   npm run dev
   ```
   * 백엔드는 `http://localhost:5000`에서 실행됩니다.
   * `nodemon`이 코드 변경을 실시간 감지하여 자동 재시작합니다.

---

### 1-2. 프론트엔드 클라이언트 실행
프론트엔드는 `React`와 `Vite` 번들러를 기반으로 작동합니다.

1. **새로운 터미널 창을 열고 프론트엔드 디렉터리로 이동합니다.**
   ```bash
   cd c:\myworkspace\Workforce-Status\client
   ```
2. **필요한 패키지를 설치합니다.** (최초 1회 또는 패키지 변경 시)
   ```bash
   npm install
   ```
3. **Vite 개발 서버를 실행합니다.**
   ```bash
   npm run dev
   ```
   * 프론트엔드는 `http://localhost:5173`에서 실행됩니다.
   * 브라우저에서 `http://localhost:5173`으로 접속해 화면을 확인할 수 있습니다.

---

### 1-3. 로컬 개발 환경 종료
터미널에서 작동 중인 백엔드 및 프론트엔드 프로세스를 안전하게 종료하는 방법입니다.

* **일반적인 종료 (터미널 단축키)**
  * 프론트엔드와 백엔드가 구동 중인 각 터미널 창을 선택한 후 `Ctrl + C` 키를 입력합니다.
  * Windows cmd/PowerShell 환경에서 `일괄 작업을 끝내시겠습니까 (Y/N)?` 라는 메시지가 표시되면 `y` 또는 `Y`를 입력하고 `Enter`를 눌러 프로세스를 종료합니다.
  * VS Code 터미널의 경우 터미널 우측의 휴지통 아이콘(Kill Terminal)을 클릭하여 해당 터미널 창을 닫는 방식으로도 종료할 수 있습니다.

---

## 🐳 2. 도커 환경 실행 (Docker Compose)

별도로 환경 세팅을 하지 않고 백엔드, 프론트엔드, 데이터베이스를 컨테이너로 한 번에 실행하는 방법입니다.

1. **프로젝트 루트 디렉터리로 이동합니다.**
   ```bash
   cd c:\myworkspace\Workforce-Status
   ```
2. **도커 컴포즈 서비스를 백그라운드에서 통합 실행합니다.**
   ```bash
   docker-compose up -d
   ```
3. **현재 구동 상태를 확인합니다.**
   ```bash
   docker ps
   ```
4. **서비스를 종료하려면 아래 명령어를 사용합니다.**
   ```bash
   docker-compose down
   ```

---

## ⚙️ 3. 접속 정보 요약

| 구성 요소 | 로컬 환경 주소 | 포트 | 주요 역할 |
| :--- | :--- | :--- | :--- |
| **프론트엔드 (React)** | `http://localhost:5173` | `5173` | UI 및 화면 렌더링 |
| **백엔드 (Express API)** | `http://localhost:5000` | `5000` | API 비즈니스 로직 및 DB 통신 |
| **데이터베이스 (MySQL)** | `localhost` | `3306` | 직원 및 프로젝트 배정 데이터 저장 |

---

## 🛠️ 4. 문제 해결 (Troubleshooting)

### Q1. 포트가 이미 사용 중이라는 에러가 발생합니다. (EADDRINUSE)
* 이전 개발 서버 프로세스가 비정상 종료되어 포트를 점유하고 있을 수 있습니다.
* **해결 방법 (Windows 기준):**
  * 포트 5173 점유 프로세스 확인 및 종료:
    ```powershell
    # PID 확인
    Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object OwningProcess
    # 프로세스 강제 종료 (확인한 PID 입력)
    Stop-Process -Id <PID>
    ```

### Q2. 백엔드 구동 시 MySQL 접속 오류가 납니다.
* 로컬의 MySQL 서비스가 정상 작동 중인지 확인이 필요합니다.
* **Windows 서비스 확인:** `services.msc` 실행 후 `MySQL` 서비스 상태가 `실행 중`인지 확인하고 아닐 경우 시작시킵니다.
