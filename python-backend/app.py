from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import tempfile
import os
import sys

app = Flask(__name__)
# Next.js (localhost:3000)에서 접근 허용
CORS(app, origins=["http://localhost:3000"])

# ExifTool 경로 자동 검색
def find_exiftool():
    """여러 위치에서 ExifTool 실행 파일 찾기"""
    possible_paths = [
        # 1. 현재 폴더 (python-backend/)
        os.path.join(os.path.dirname(__file__), "exiftool.exe"),
        os.path.join(os.path.dirname(__file__), "exiftool(-k).exe"),
        
        # 2. 프로젝트 루트 폴더
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool.exe"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool(-k).exe"),
        
        # 3. 다운로드 폴더
        os.path.join(os.path.expanduser("~"), "Downloads", "exiftool.exe"),
        os.path.join(os.path.expanduser("~"), "Downloads", "exiftool(-k).exe"),
        
        # 4. 바탕화면
        os.path.join(os.path.expanduser("~"), "Desktop", "exiftool.exe"),
        os.path.join(os.path.expanduser("~"), "Desktop", "exiftool(-k).exe"),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"✅ ExifTool 발견: {path}")
            return path
    
    # 시스템 PATH에서 찾기
    try:
        result = subprocess.run(["where", "exiftool"], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            path = result.stdout.strip().split('\n')[0]
            print(f"✅ ExifTool 발견 (시스템 PATH): {path}")
            return path
    except:
        pass
    
    print("⚠️  ExifTool을 찾을 수 없습니다.")
    return None

EXIFTOOL_PATH = find_exiftool()

@app.route("/", methods=["GET"])
def home():
    """서버 상태 체크"""
    return jsonify({
        "status": "running",
        "message": "Flask ExifTool 서버가 실행 중입니다.",
        "exiftool_available": os.path.exists(EXIFTOOL_PATH)
    })

@app.route("/analyze", methods=["POST"])
def analyze():
    """이미지 메타데이터 분석"""
    import time
    start_time = time.time()
    
    try:
        print("\n" + "="*60)
        print("📥 새로운 분석 요청 수신")
        
        # 파일 받기
        file = request.files.get("file")
        if not file:
            print("❌ 파일 없음")
            return jsonify({
                "success": False, 
                "error": "파일이 없습니다."
            }), 400

        file_size = len(file.read())
        file.seek(0)  # 파일 포인터 초기화
        print(f"📁 파일 정보:")
        print(f"   이름: {file.filename}")
        print(f"   크기: {file_size:,} bytes ({file_size/1024/1024:.2f} MB)")

        # 임시 파일로 저장
        suffix = os.path.splitext(file.filename)[1] or ".jpg"
        tmp_path = tempfile.mktemp(suffix=suffix)
        print(f"💾 임시 파일 저장: {tmp_path}")
        file.save(tmp_path)
        print(f"✅ 파일 저장 완료")

        try:
            # ExifTool 실행
            if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
                cmd = [EXIFTOOL_PATH, "-json", "-All", tmp_path]
                print(f"🔍 ExifTool 사용: {EXIFTOOL_PATH}")
            else:
                # 시스템 PATH에서 exiftool 시도
                cmd = ["exiftool", "-json", "-All", tmp_path]
                print(f"🔍 ExifTool 사용: 시스템 PATH")
            
            print(f"⚙️  명령 실행 중...")
            exec_start = time.time()
            result = subprocess.check_output(cmd, stderr=subprocess.PIPE, timeout=30)
            exec_time = time.time() - exec_start
            print(f"✅ ExifTool 실행 완료 ({exec_time:.2f}초)")
            
            print(f"📊 메타데이터 파싱 중...")
            metadata = json.loads(result.decode("utf-8"))[0]
            print(f"✅ 메타데이터 파싱 완료 ({len(metadata)} 필드)")
            
            # 임시 파일 삭제
            os.remove(tmp_path)
            print(f"🗑️  임시 파일 삭제 완료")
            
            # 열화상 관련 주요 데이터 추출
            thermal_data = extract_thermal_data(metadata)
            print(f"🌡️  열화상 데이터 추출 완료 ({len(thermal_data)} 필드)")
            
            total_time = time.time() - start_time
            print(f"✅ 전체 처리 완료 ({total_time:.2f}초)")
            print("="*60 + "\n")
            
            return jsonify({
                "success": True,
                "metadata": metadata,
                "thermal_data": thermal_data,
                "filename": file.filename,
                "processing_time": round(total_time, 2)
            })
            
        except subprocess.TimeoutExpired:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            print("❌ ExifTool 타임아웃 (30초 초과)")
            print("="*60 + "\n")
            return jsonify({
                "success": False,
                "error": "ExifTool 실행 타임아웃 (30초 초과)"
            }), 500
            
        except subprocess.CalledProcessError as e:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            error_msg = e.stderr.decode('utf-8') if e.stderr else "알 수 없는 오류"
            print(f"❌ ExifTool 실행 오류: {error_msg}")
            print("="*60 + "\n")
            return jsonify({
                "success": False,
                "error": f"ExifTool 실행 오류: {error_msg}"
            }), 500
            
    except Exception as e:
        print(f"❌ 예외 발생: {str(e)}")
        print("="*60 + "\n")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def extract_thermal_data(metadata):
    """열화상 이미지의 주요 온도 데이터 추출"""
    thermal_data = {}
    
    # FLIR 열화상 카메라 데이터 추출
    thermal_fields = [
        "ObjectDistance",
        "AtmosphericTemperature", 
        "ReflectedApparentTemperature",
        "IRWindowTemperature",
        "IRWindowTransmission",
        "RelativeHumidity",
        "PlanckR1",
        "PlanckB",
        "PlanckF",
        "PlanckO",
        "PlanckR2",
        "AtmosphericTransAlpha1",
        "AtmosphericTransAlpha2",
        "AtmosphericTransBeta1",
        "AtmosphericTransBeta2",
        "AtmosphericTransX",
        "CameraTemperatureRangeMax",
        "CameraTemperatureRangeMin",
        "CameraTemperatureMaxSaturation",
        "CameraTemperatureMinSaturation",
        "Emissivity",
    ]
    
    for field in thermal_fields:
        if field in metadata:
            thermal_data[field] = metadata[field]
    
    # 일반 EXIF 데이터
    common_fields = [
        "Make",
        "Model", 
        "DateTimeOriginal",
        "ImageWidth",
        "ImageHeight",
        "Orientation",
    ]
    
    for field in common_fields:
        if field in metadata:
            thermal_data[field] = metadata[field]
    
    return thermal_data

@app.route("/batch-analyze", methods=["POST"])
def batch_analyze():
    """여러 이미지 일괄 분석"""
    try:
        files = request.files.getlist("files")
        if not files:
            return jsonify({
                "success": False,
                "error": "파일이 없습니다."
            }), 400
        
        results = []
        for file in files:
            suffix = os.path.splitext(file.filename)[1] or ".jpg"
            tmp_path = tempfile.mktemp(suffix=suffix)
            file.save(tmp_path)
            
            try:
                if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
                    cmd = [EXIFTOOL_PATH, "-json", "-All", tmp_path]
                else:
                    cmd = ["exiftool", "-json", "-All", tmp_path]
                
                result = subprocess.check_output(cmd, stderr=subprocess.PIPE)
                metadata = json.loads(result.decode("utf-8"))[0]
                thermal_data = extract_thermal_data(metadata)
                
                results.append({
                    "success": True,
                    "filename": file.filename,
                    "thermal_data": thermal_data,
                    "metadata": metadata
                })
                
            except Exception as e:
                results.append({
                    "success": False,
                    "filename": file.filename,
                    "error": str(e)
                })
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        
        return jsonify({
            "success": True,
            "count": len(results),
            "results": results
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Flask ExifTool 서버")
    print("="*60)
    
    # ExifTool 상태 확인
    if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
        print(f"✅ ExifTool 발견!")
        print(f"   경로: {EXIFTOOL_PATH}")
    else:
        print("⚠️  ExifTool을 찾을 수 없습니다!")
        print("\n📥 ExifTool 다운로드:")
        print("   1. https://exiftool.org/ 방문")
        print("   2. Windows Executable 다운로드")
        print("   3. exiftool(-k).exe → exiftool.exe 이름 변경")
        print("   4. 다음 중 한 곳에 저장:")
        print(f"      - {os.path.join(os.path.dirname(__file__), 'exiftool.exe')}")
        print(f"      - {os.path.join(os.path.expanduser('~'), 'Downloads', 'exiftool.exe')}")
        print("   5. 서버 재시작 (Ctrl+C 후 python app.py)")
        print("\n   또는 시스템 PATH에 exiftool 추가")
    
    print("\n🌐 서버 정보:")
    print("   URL: http://localhost:5000")
    print("   CORS: http://localhost:3000 허용")
    print("   테스트: http://localhost:3000/exif-test")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=5000, debug=True)

