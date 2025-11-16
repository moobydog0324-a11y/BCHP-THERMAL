# 🚀 BCHP-THERMA 서버 시작 가이드

## 📋 빠른 시작

### 1단계: 서버 시작
```
start-servers.bat 더블클릭
```
- 자동으로 2개의 창이 열립니다
- Flask 서버 (포트 5000)
- Next.js 서버 (포트 3000)

### 2단계: 서버 확인
```
check-servers.bat 더블클릭
```
- 두 서버가 정상 작동하는지 확인

### 3단계: 브라우저 접속
```
http://localhost:3000
```

---

## 🔍 문제 해결

### 서버가 시작되지 않는 경우

1. **포트가 이미 사용 중**
   - `check-servers.bat` 실행하여 포트 상태 확인
   - 작업 관리자에서 `python.exe`, `node.exe` 종료 후 재시작

2. **Python 또는 Node.js가 설치되지 않음**
   - Python 3.11 이상 설치 필요
   - Node.js 18 이상 설치 필요
   - pnpm 설치 필요: `npm install -g pnpm`

3. **라이브러리 설치 안 됨**
   ```bash
   # Python 라이브러리
   cd python-backend
   pip install -r requirements.txt
   
   # Node.js 패키지
   cd ..
   pnpm install
   ```

---

## 🔥 새로운 기능

### FLIR 전문 온도 분석
- ✅ FLIR Image Extractor 라이브러리 사용
- ✅ 정확한 최고/최저/평균 온도 계산
- ✅ 모든 보정 자동 적용:
  - 대기 전송 보정
  - 방사율 보정
  - 반사 온도 보정
  - 거리 보정
  - 습도 보정

### 테스트 방법
1. http://localhost:3000/upload 접속
2. 구역 선택 (예: C-1)
3. 새 열화상 이미지 업로드
4. http://localhost:3000/compare 에서 결과 확인
5. "상세보기" 클릭하여 정확한 온도 확인

---

## 📊 서버 상태

### 정상 작동 시
```
[OK] Flask 서버: 정상
[OK] Next.js 서버: 정상
```

### 비정상 시
```
[오류] Flask 서버 응답 없음
[오류] Next.js 서버 응답 없음
```
→ `start-servers.bat` 다시 실행

---

## 🛑 서버 종료

1. Flask 서버 창 닫기 (Ctrl+C 또는 X)
2. Next.js 서버 창 닫기 (Ctrl+C 또는 X)

또는

```
작업 관리자 → python.exe, node.exe 프로세스 종료
```

---

## 📞 지원

문제 발생 시:
1. `check-servers.bat` 실행하여 상태 확인
2. 열린 서버 창에서 오류 메시지 확인
3. `start-servers.bat` 다시 실행

---

**완성 날짜**: 2025년 11월 13일  
**주요 업데이트**: FLIR Image Extractor 통합, 정확한 온도 계산






