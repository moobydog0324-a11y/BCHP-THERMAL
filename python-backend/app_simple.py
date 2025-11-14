from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import tempfile
import os

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# ExifTool 경로 자동 검색
def find_exiftool():
    """여러 위치에서 ExifTool 실행 파일 찾기"""
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "exiftool.exe"),
        os.path.join(os.path.dirname(__file__), "exiftool(-k).exe"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool.exe"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool(-k).exe"),
        os.path.join(os.path.expanduser("~"), "Downloads", "exiftool.exe"),
        os.path.join(os.path.expanduser("~"), "Downloads", "exiftool(-k).exe"),
        os.path.join(os.path.expanduser("~"), "Desktop", "exiftool.exe"),
        os.path.join(os.path.expanduser("~"), "Desktop", "exiftool(-k).exe"),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"✅ ExifTool 발견: {path}")
            return path
    
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
        "exiftool_available": EXIFTOOL_PATH is not None and os.path.exists(EXIFTOOL_PATH)
    })

@app.route("/analyze", methods=["POST"])
def analyze():
    """이미지 메타데이터 분석 (간소화 버전 - 온도 계산 제거)"""
    import time
    start_time = time.time()
    
    try:
        print("\n" + "="*60)
        print("📥 새로운 분석 요청 수신")
        
        file = request.files.get("file")
        if not file:
            print("❌ 파일 없음")
            return jsonify({"success": False, "error": "파일이 없습니다."}), 400

        file_size = len(file.read())
        file.seek(0)
        print(f"📁 파일: {file.filename} ({file_size:,} bytes)")

        suffix = os.path.splitext(file.filename)[1] or ".jpg"
        tmp_path = tempfile.mktemp(suffix=suffix)
        print(f"💾 임시 파일: {tmp_path}")
        file.save(tmp_path)

        try:
            if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
                cmd = [EXIFTOOL_PATH, "-json", "-All", tmp_path]
            else:
                cmd = ["exiftool", "-json", "-All", tmp_path]
            
            print(f"⚙️  ExifTool 실행 중...")
            exec_start = time.time()
            result = subprocess.check_output(cmd, stderr=subprocess.PIPE, timeout=30)
            exec_time = time.time() - exec_start
            print(f"✅ ExifTool 완료 ({exec_time:.2f}초)")
            
            metadata = json.loads(result.decode("utf-8"))[0]
            print(f"✅ 메타데이터 파싱 완료 ({len(metadata)} 필드)")
            
            # 열화상 주요 데이터만 추출
            thermal_data = extract_thermal_data(metadata)
            print(f"🌡️  열화상 데이터 추출 완료")
            
            # ⚠️ 복잡한 온도 계산은 제거 - 메타데이터만 제공
            print(f"ℹ️   참고: 실제 온도 계산은 복잡한 보정이 필요하여 생략됨")
            print(f"   카메라 설정 범위: {metadata.get('CameraTemperatureRangeMin')} ~ {metadata.get('CameraTemperatureRangeMax')}")
            
            os.remove(tmp_path)
            print(f"🗑️  임시 파일 삭제")
            
            total_time = time.time() - start_time
            print(f"✅ 전체 처리 완료 ({total_time:.2f}초)")
            print("="*60 + "\n")
            
            return jsonify({
                "success": True,
                "metadata": metadata,
                "thermal_data": thermal_data,
                "filename": file.filename,
                "processing_time": round(total_time, 2),
                "note": "실제 온도 계산은 메타데이터만으로는 부정확하여 제공하지 않습니다."
            })
            
        except subprocess.TimeoutExpired:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            print("❌ ExifTool 타임아웃")
            return jsonify({"success": False, "error": "ExifTool 타임아웃"}), 500
            
        except subprocess.CalledProcessError as e:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            error_msg = e.stderr.decode('utf-8') if e.stderr else "알 수 없는 오류"
            print(f"❌ ExifTool 오류: {error_msg}")
            return jsonify({"success": False, "error": f"ExifTool 오류: {error_msg}"}), 500
            
    except Exception as e:
        print(f"❌ 예외: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

def extract_thermal_data(metadata):
    """열화상 이미지의 주요 메타데이터만 추출 (온도 계산 제외)"""
    thermal_data = {}
    
    # FLIR 열화상 카메라 메타데이터
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
    
    # ℹ️ 참고 정보 추가
    thermal_data['_note'] = "실제 온도 계산은 대기전송, 방사율, 거리 등 복잡한 보정이 필요하여 제공하지 않습니다."
    
    return thermal_data

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Flask ExifTool 서버 (간소화 버전)")
    print("="*60)
    
    if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
        print(f"✅ ExifTool: {EXIFTOOL_PATH}")
    else:
        print("⚠️  ExifTool 없음")
    
    print("\n⚠️  중요: 실제 온도 계산 기능은 제거되었습니다.")
    print("   이유: Planck 공식만으로는 정확한 온도 계산이 불가능")
    print("   필요 보정: 대기전송, 방사율, 반사온도, 거리, 습도 등")
    print("\n🌐 서버: http://localhost:5000")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=5000, debug=True)






