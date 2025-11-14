# -*- coding: utf-8 -*-
import sys
import io

# Windows에서 유니코드 출력 문제 해결
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import tempfile
import os
from flirimageextractor import FlirImageExtractor
import numpy as np

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
        "message": "Flask FLIR 전문 분석 서버가 실행 중입니다.",
        "exiftool_available": EXIFTOOL_PATH is not None and os.path.exists(EXIFTOOL_PATH),
        "flir_library": "flirimageextractor (전문 라이브러리)"
    })

@app.route("/analyze", methods=["POST"])
def analyze():
    """FLIR 이미지 전문 분석 - 정확한 온도 추출"""
    import time
    start_time = time.time()
    
    try:
        print("\n" + "="*60)
        print("📥 새로운 FLIR 분석 요청")
        
        file = request.files.get("file")
        if not file:
            print("❌ 파일 없음")
            return jsonify({"success": False, "error": "파일이 없습니다."}), 400

        file_size = len(file.read())
        file.seek(0)
        print(f"📁 파일: {file.filename} ({file_size:,} bytes / {file_size/1024/1024:.2f} MB)")

        # 임시 파일로 저장
        suffix = os.path.splitext(file.filename)[1] or ".jpg"
        tmp_path = tempfile.mktemp(suffix=suffix)
        print(f"💾 임시 파일: {tmp_path}")
        file.save(tmp_path)

        try:
            # 1. ExifTool로 기본 메타데이터 추출
            print(f"\n📊 1단계: ExifTool 메타데이터 추출...")
            if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
                cmd = [EXIFTOOL_PATH, "-json", "-All", tmp_path]
            else:
                cmd = ["exiftool", "-json", "-All", tmp_path]
            
            result = subprocess.check_output(cmd, stderr=subprocess.PIPE, timeout=30)
            metadata = json.loads(result.decode("utf-8"))[0]
            print(f"   ✅ {len(metadata)}개 필드 추출 완료")
            
            # 열화상 주요 데이터 추출
            thermal_data = extract_thermal_data(metadata)
            
            # 2. FLIR Image Extractor로 정확한 온도 추출
            print(f"\n🔥 2단계: FLIR 전문 라이브러리로 정확한 온도 추출...")
            try:
                temp_stats = extract_accurate_temperature(tmp_path, EXIFTOOL_PATH)
                if temp_stats:
                    thermal_data['actual_temp_stats'] = temp_stats
                    print(f"   ✅ 정확한 온도 추출 완료!")
                    print(f"      최저: {temp_stats['min_temp']}°C")
                    print(f"      최고: {temp_stats['max_temp']}°C")
                    print(f"      평균: {temp_stats['avg_temp']}°C")
                else:
                    print(f"   ⚠️  온도 추출 실패 (FLIR 포맷이 아닐 수 있음)")
            except Exception as e:
                print(f"   ⚠️  FLIR 라이브러리 오류: {e}")
            
            # 임시 파일 삭제
            os.remove(tmp_path)
            print(f"\n🗑️  임시 파일 삭제")
            
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
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

def extract_accurate_temperature(image_path, exiftool_path=None):
    """
    FLIR Image Extractor 라이브러리를 사용하여 정확한 온도 추출
    모든 보정(대기전송, 방사율, 반사 등)이 자동으로 적용됩니다.
    """
    try:
        # FLIR 이미지 추출기 초기화
        fie = FlirImageExtractor(exiftool_path=exiftool_path)
        
        # 이미지 처리
        fie.process_image(image_path)
        
        # 온도 배열 가져오기 (모든 보정이 적용된 실제 온도)
        thermal_np = fie.get_thermal_np()
        
        if thermal_np is None or thermal_np.size == 0:
            print("   ⚠️  온도 데이터를 가져올 수 없습니다.")
            return None
        
        # 온도 통계 계산
        stats = {
            'min_temp': float(round(np.min(thermal_np), 2)),
            'max_temp': float(round(np.max(thermal_np), 2)),
            'avg_temp': float(round(np.mean(thermal_np), 2)),
            'median_temp': float(round(np.median(thermal_np), 2)),
            'std_temp': float(round(np.std(thermal_np), 2)),
            'pixel_count': int(thermal_np.size),
            'data_source': 'flir-image-extractor',
            'note': '모든 보정(대기전송, 방사율, 반사 등)이 적용된 정확한 온도입니다.'
        }
        
        return stats
        
    except Exception as e:
        print(f"   ⚠️  FLIR 추출 오류: {e}")
        import traceback
        traceback.print_exc()
        return None

def extract_thermal_data(metadata):
    """열화상 이미지의 주요 메타데이터 추출"""
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
    
    return thermal_data

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Flask FLIR 전문 분석 서버")
    print("="*60)
    
    if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
        print(f"✅ ExifTool: {EXIFTOOL_PATH}")
    else:
        print("⚠️  ExifTool 없음")
    
    print("\n🔥 FLIR Image Extractor 라이브러리 사용")
    print("   - 정확한 온도 계산 (모든 보정 자동 적용)")
    print("   - 대기전송, 방사율, 반사온도, 거리, 습도 보정")
    print("   - 검증된 알고리즘 사용")
    
    print("\n🌐 서버: http://localhost:5000")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=5000, debug=True)

