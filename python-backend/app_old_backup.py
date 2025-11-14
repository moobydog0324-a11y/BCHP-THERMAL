from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import tempfile
import os
import sys
import numpy as np
from io import BytesIO
import struct

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
            
            # 열화상 관련 주요 데이터 추출
            thermal_data = extract_thermal_data(metadata)
            print(f"🌡️  열화상 데이터 추출 완료 ({len(thermal_data)} 필드)")
            
            # 실제 온도 통계 추출 (RawThermalImage 분석)
            print(f"🔥 실제 온도 통계 계산 시작...")
            temp_stats = extract_temperature_stats(metadata, tmp_path)
            
            if temp_stats:
                thermal_data['actual_temp_stats'] = temp_stats
                print(f"✅ 실제 온도 통계 추가됨")
            else:
                print(f"⚠️  실제 온도 통계 추출 실패 (메타데이터만 반환)")
            
            # 임시 파일 삭제
            os.remove(tmp_path)
            print(f"🗑️  임시 파일 삭제 완료")
            
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

def calculate_temperature_from_raw(raw_value, planck_r1, planck_b, planck_f, planck_o, planck_r2):
    """
    Planck 공식을 사용하여 raw 값을 온도(섭씨)로 변환
    T = PlanckB / ln(PlanckR1 / (PlanckR2 * (Raw + PlanckO)) + PlanckF) - 273.15
    """
    try:
        # Planck 공식 계산
        val = planck_r1 / (planck_r2 * (raw_value + planck_o)) + planck_f
        if val <= 0:
            return None
        temp_kelvin = planck_b / np.log(val)
        temp_celsius = temp_kelvin - 273.15
        return temp_celsius
    except:
        return None

def extract_temperature_stats(metadata, image_path):
    """RawThermalImage에서 실제 최고/최저/평균 온도 추출"""
    try:
        # Planck 상수 확인
        planck_r1 = metadata.get('PlanckR1')
        planck_b = metadata.get('PlanckB')
        planck_f = metadata.get('PlanckF')
        planck_o = metadata.get('PlanckO')
        planck_r2 = metadata.get('PlanckR2', 1)  # 기본값 1
        
        if not all([planck_r1, planck_b, planck_f, planck_o]):
            print("⚠️  Planck 상수가 없음 - 온도 계산 불가")
            return None
        
        print(f"📐 Planck 상수:")
        print(f"   R1={planck_r1}, B={planck_b}, F={planck_f}, O={planck_o}, R2={planck_r2}")
        
        # RawThermalImage를 바이너리로 추출
        if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
            cmd = [EXIFTOOL_PATH, "-b", "-RawThermalImage", image_path]
        else:
            cmd = ["exiftool", "-b", "-RawThermalImage", image_path]
        
        print(f"🔍 RawThermalImage 추출 중...")
        raw_data = subprocess.check_output(cmd, stderr=subprocess.PIPE, timeout=10)
        
        if len(raw_data) == 0:
            print("⚠️  RawThermalImage 데이터 없음")
            return None
        
        print(f"✅ RawThermalImage 추출 완료 ({len(raw_data):,} bytes)")
        
        # TIFF 형식으로 파싱 (16-bit unsigned integer)
        # 640x512 = 327,680 픽셀 * 2 bytes = 655,360 bytes
        raw_width = metadata.get('RawThermalImageWidth', 640)
        raw_height = metadata.get('RawThermalImageHeight', 512)
        expected_size = raw_width * raw_height * 2  # 16-bit = 2 bytes
        
        print(f"📊 이미지 크기: {raw_width}x{raw_height}")
        print(f"   예상 크기: {expected_size:,} bytes")
        print(f"   실제 크기: {len(raw_data):,} bytes")
        
        # 바이너리 데이터를 numpy 배열로 변환
        try:
            # Big-endian 16-bit unsigned integer로 해석
            raw_array = np.frombuffer(raw_data, dtype='>u2')
            
            if len(raw_array) == 0:
                print("⚠️  빈 배열")
                return None
            
            print(f"🔢 Raw 값 범위: {raw_array.min()} ~ {raw_array.max()}")
            
            # Planck 공식으로 온도 계산
            print(f"🌡️  온도 계산 중...")
            temperatures = []
            
            for raw_val in raw_array:
                temp = calculate_temperature_from_raw(
                    raw_val, planck_r1, planck_b, planck_f, planck_o, planck_r2
                )
                if temp is not None:
                    temperatures.append(temp)
            
            if not temperatures:
                print("⚠️  유효한 온도 값 없음")
                return None
            
            temps_array = np.array(temperatures)
            
            stats = {
                'min_temp': float(round(temps_array.min(), 2)),
                'max_temp': float(round(temps_array.max(), 2)),
                'avg_temp': float(round(temps_array.mean(), 2)),
                'median_temp': float(round(np.median(temps_array), 2)),
                'pixel_count': len(temperatures)
            }
            
            print(f"✅ 온도 통계 계산 완료:")
            print(f"   최저: {stats['min_temp']}°C")
            print(f"   최고: {stats['max_temp']}°C")
            print(f"   평균: {stats['avg_temp']}°C")
            print(f"   중앙: {stats['median_temp']}°C")
            
            return stats
            
        except Exception as e:
            print(f"⚠️  배열 변환 오류: {e}")
            return None
        
    except subprocess.TimeoutExpired:
        print("❌ RawThermalImage 추출 타임아웃")
        return None
    except Exception as e:
        print(f"⚠️  온도 추출 오류: {e}")
        return None

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

