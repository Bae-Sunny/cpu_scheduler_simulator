# 🧠 CPU Scheduling Simulator

React + TypeScript + Vite 기반으로 구현된 **CPU 스케줄링 알고리즘 시뮬레이터**입니다.  
다양한 알고리즘을 시각적으로 체험하고, Gantt 차트 및 실행 통계를 확인할 수 있습니다.

👉 [🔗 StackBlitz에서 바로 실행하기](https://stackblitz.com/edit/vitejs-vite-twrqnvig?file=README.md)

---

## 🎯 구현 목적

- CS 이론 중 핵심 개념인 **CPU Scheduling** 알고리즘을 직접 구현하며 학습
- 각 알고리즘의 특성과 차이를 **시각적으로 확인**
- 실시간 실행 흐름, 상태 전이, 대기 시간 등 **통계 기반 분석 기능 포함**

---

## ⚙️ 지원 알고리즘

- FCFS (First Come First Served)
- SJF (Shortest Job First)
- SRT (Shortest Remaining Time)
- Priority Scheduling
- HRN (Highest Response Ratio Next)
- RR (Round Robin) with Time Quantum

---

## 🛠 기술 스택

- **React + TypeScript** – UI 구성 및 상태 관리
- **TailwindCSS** – 반응형 스타일링
- **Lucide Icons** – UI 아이콘
- **useReducer + useEffect** – 시뮬레이션 상태 흐름 제어
- **Vite** – 빠른 개발 환경 구성

---

## 🧪 주요 기능

- 알고리즘 선택 및 타임퀀텀 입력 (RR)
- 프로세스 도착시간, 실행시간, 우선순위 수정
- 자동 실행, 단계 실행, 초기화 버튼
- Gantt Chart로 실행 흐름 시각화
- Turnaround Time, Waiting Time 통계 계산

---

## 🧠 학습 포인트

- 선점형/비선점형 알고리즘의 구조적 차이 이해
- 상태 기반 시뮬레이션 흐름 구성 (Reducer 활용)
- 성능 최적화 및 타입 안전성 개선

---

## 🤖 AI 코드 리뷰 참고

일부 구조 설계 및 코드 리뷰는 Claude AI의 도움을 받아 진행했으며,  
성능 최적화와 타입 안정성 향상에 참고가 되었습니다.

---

## 📌 실행 방법

> 이 프로젝트는 StackBlitz 상에서 별도 설정 없이 **즉시 실행**이 가능합니다.  
> 브라우저 기반으로 직접 조작하며 알고리즘의 동작을 테스트해보세요.

---