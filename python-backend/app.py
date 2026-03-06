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

# Register Blueprints
from analysis_routes import analysis_bp
app.register_blueprint(analysis_bp, url_prefix='/api/analysis')

# ExifTool 경로 자동 검색
def find_exiftool():
    """여러 위치에서 ExifTool 실행 파일 찾기"""
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "exiftool.exe"),
        os.path.join(os.path.dirname(__file__), "exiftool(-k).exe"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool.exe"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool(-k).exe"),
        # Local Mac ExifTool
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "tools", "exiftool-dist", "exiftool"),
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
        result = subprocess.run(["where", "exiftool"], capture_output=True, text=True, shell=False)
        if result.returncode == 0:
            path = result.stdout.strip().split('\n')[0]
            print(f"✅ ExifTool 발견 (시스템 PATH): {path}")
            return path
    except:
        pass
    
    print("⚠️  ExifTool을 찾을 수 없습니다.")
    return None

import os
if "/usr/bin" not in os.environ.get("PATH", ""):
    os.environ["PATH"] += os.pathsep + "/usr/bin"

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

@app.route("/health", methods=["GET"])
def health_check():
    """헬스체크 엔드포인트 - 서비스 가용성 확인"""
    import time
    start = time.time()
    
    health_status = {
        "status": "ok",
        "timestamp": time.time(),
        "checks": {
            "exiftool": {
                "status": "ok" if (EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH)) else "fail",
                "path": EXIFTOOL_PATH if EXIFTOOL_PATH else None
            },
            "flir_library": {
                "status": "ok",
                "version": "flirimageextractor"
            }
        },
        "response_time_ms": 0
    }
    
    # ExifTool 간단한 버전 체크
    if EXIFTOOL_PATH and os.path.exists(EXIFTOOL_PATH):
        try:
            result = subprocess.run(
                [EXIFTOOL_PATH, "-ver"], 
                capture_output=True, 
                text=True, 
                timeout=2
            )
            if result.returncode == 0:
                health_status["checks"]["exiftool"]["version"] = result.stdout.strip()
        except:
            health_status["checks"]["exiftool"]["status"] = "degraded"
    
    # 전체 상태 판정
    all_ok = all(check["status"] == "ok" for check in health_status["checks"].values())
    health_status["status"] = "ok" if all_ok else "degraded"
    health_status["response_time_ms"] = round((time.time() - start) * 1000, 2)
    
    status_code = 200 if all_ok else 503
    return jsonify(health_status), status_code

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

        # 파일 확장자 검증 (화이트리스트 방식)
        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.flir', '.fff', '.csq'}
        suffix = os.path.splitext(file.filename)[1].lower() if file.filename else ''
        if not suffix:
            suffix = '.jpg'
        if suffix not in ALLOWED_EXTENSIONS:
            print(f"❌ 허용되지 않는 파일 확장자: {suffix}")
            return jsonify({"success": False, "error": "허용되지 않는 파일 형식입니다."}), 400

        # 임시 파일로 저장 (NamedTemporaryFile로 경쟁 조건 방지)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_path = tmp_file.name
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
        print(f"❌ 예외 발생")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": "분석 중 오류가 발생했습니다."}), 500

def extract_accurate_temperature(image_path, exiftool_path=None):
    """
    FLIR Image Extractor 라이브러리를 사용하여 정확한 온도 추출
    모든 보정(대기전송, 방사율, 반사 등)이 자동으로 적용됩니다.
    
    ⚠️ 주의: 이 함수는 결정론적(deterministic)입니다.
    같은 이미지 파일은 항상 같은 온도 값을 반환해야 합니다.
    """
    try:
        # FLIR 이미지 추출기 초기화
        fie = FlirImageExtractor(exiftool_path=exiftool_path)
        
        # 이미지 처리 (결정론적 처리 보장)
        fie.process_image(image_path)
        
        # 온도 배열 가져오기 (모든 보정이 적용된 실제 온도)
        thermal_np = fie.get_thermal_np()
        
        if thermal_np is None or thermal_np.size == 0:
            print("   ⚠️  온도 데이터를 가져올 수 없습니다.")
            return None
        
        # 온도 통계 계산 (부동소수점 정밀도 보장)
        stats = {
            'min_temp': float(np.round(np.min(thermal_np), 2)),
            'max_temp': float(np.round(np.max(thermal_np), 2)),
            'avg_temp': float(np.round(np.mean(thermal_np), 2)),
            'median_temp': float(np.round(np.median(thermal_np), 2)),
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
        "Emissivity",
        "ObjectDistance",
        "RelativeHumidity",
        "ReflectedApparentTemperature",
        "IRWindowTemperature",
        "IRWindowTransmission",
        "PlanckR1",
        "PlanckB",
        "PlanckF",
        "PlanckO",
        "PlanckR2",
        "CameraTemperatureRangeMax",
        "CameraTemperatureRangeMin",
        "CameraTemperatureMaxSaturation",
        "CameraTemperatureMinSaturation",
        # DJI / Drone Specific
        "GimbalPitchDegree",
        "GimbalRollDegree",
        "GimbalYawDegree",
        "FlightPitchDegree",
        "FlightRollDegree",
        "FlightYawDegree",
        "CentralTemperature",
        "TlinearError",
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
        "GPSLatitude",
        "GPSLongitude",
        "GPSAltitude",
        "GPSAltitudeRef",
    ]
    
    for field in common_fields:
        if field in metadata:
            thermal_data[field] = metadata[field]
    
    return thermal_data

@app.route("/generate-thermal-image", methods=["POST"])
def generate_thermal_image():
    """열화상 이미지 생성 (다양한 컬러맵 지원)"""
    import time
    import io
    import base64
    import matplotlib
    matplotlib.use('Agg')  # GUI 없이 사용
    import matplotlib.pyplot as plt
    from matplotlib import cm
    
    start_time = time.time()
    
    try:
        print("\n" + "="*60)
        print("🎨 열화상 이미지 생성 요청")
        
        file = request.files.get("file")
        colormap = request.form.get("colormap", "jet")  # 기본: jet
        
        if not file:
            return jsonify({"success": False, "error": "파일이 없습니다."}), 400
        
        print(f"📁 파일: {file.filename}")
        print(f"🎨 컬러맵: {colormap}")
        
        # 파일 확장자 검증 (화이트리스트 방식)
        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.flir', '.fff', '.csq'}
        suffix = os.path.splitext(file.filename)[1].lower() if file.filename else ''
        if not suffix:
            suffix = '.jpg'
        if suffix not in ALLOWED_EXTENSIONS:
            return jsonify({"success": False, "error": "허용되지 않는 파일 형식입니다."}), 400

        # 임시 파일로 저장 (NamedTemporaryFile로 경쟁 조건 방지)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_path = tmp_file.name
        file.save(tmp_path)
        
        try:
            # FLIR Image Extractor로 온도 데이터 추출
            print(f"\n🔥 온도 데이터 추출 중...")
            fie = FlirImageExtractor(exiftool_path=EXIFTOOL_PATH)
            fie.process_image(tmp_path)
            thermal_np = fie.get_thermal_np()
            
            if thermal_np is None or thermal_np.size == 0:
                os.remove(tmp_path)
                return jsonify({
                    "success": False, 
                    "error": "열화상 데이터를 추출할 수 없습니다."
                }), 400
            
            print(f"✅ 온도 배열 크기: {thermal_np.shape}")
            print(f"   온도 범위: {np.min(thermal_np):.2f}°C ~ {np.max(thermal_np):.2f}°C")
            
            # 컬러맵으로 이미지 생성
            print(f"\n🎨 컬러맵 '{colormap}' 적용 중...")
            
            # 컬러맵 적용
            valid_colormaps = {
                'jet': cm.jet,
                'viridis': cm.viridis,
                'plasma': cm.plasma,
                'inferno': cm.inferno,
                'hot': cm.hot,
                'cool': cm.cool,
                'rainbow': cm.rainbow,
                'turbo': cm.turbo,
                'seismic': cm.seismic,
                'coolwarm': cm.coolwarm,
            }
            
            cmap = valid_colormaps.get(colormap, cm.jet)
            
            # 이미지를 바이트로 변환 (여백/축 없이 원본 배열과 1:1 픽셀 매칭되도록 저장)
            img_buffer = io.BytesIO()
            plt.imsave(img_buffer, thermal_np, cmap=cmap, format='png')
            img_buffer.seek(0)
            img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')
            
            # 온도 데이터를 리스트로 변환 (JSON 전송용)
            # 전체 데이터는 너무 크므로 압축된 형태로 전송
            height, width = thermal_np.shape
            
            # 온도 통계
            temp_stats = {
                'min': float(np.round(np.min(thermal_np), 2)),
                'max': float(np.round(np.max(thermal_np), 2)),
                'mean': float(np.round(np.mean(thermal_np), 2)),
                'median': float(np.round(np.median(thermal_np), 2)),
                'std': float(np.round(np.std(thermal_np), 2))
            }
            
            # 온도 데이터를 1D 배열로 변환 (클라이언트에서 재구성)
            temp_data_flat = thermal_np.flatten().tolist()
            
            os.remove(tmp_path)
            
            total_time = time.time() - start_time
            print(f"✅ 이미지 생성 완료 ({total_time:.2f}초)")
            print("="*60 + "\n")
            
            return jsonify({
                "success": True,
                "image": f"data:image/png;base64,{img_base64}",
                "temperature_data": temp_data_flat,
                "width": int(width),
                "height": int(height),
                "stats": temp_stats,
                "colormap": colormap,
                "processing_time": round(total_time, 2)
            })
            
        except Exception as e:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            print(f"❌ 이미지 생성 오류")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": "이미지 생성 중 오류가 발생했습니다."}), 500
            
    except Exception as e:
        print(f"❌ 예외 발생")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": "서버 오류가 발생했습니다."}), 500

@app.route("/analyze-roi", methods=["POST"])
def analyze_roi():
    """
    ROI (Region of Interest) 온도 분석
    사각형 영역의 온도 통계를 반환
    """
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "파일이 없습니다"}), 400
        
        file = request.files['file']
        
        # ROI 좌표 받기 (비율로 전달됨: 0~1)
        x1 = float(request.form.get('x1', 0))
        y1 = float(request.form.get('y1', 0))
        x2 = float(request.form.get('x2', 1))
        y2 = float(request.form.get('y2', 1))
        roi_name = request.form.get('name', 'ROI')
        
        print(f"\n🔍 ROI 분석 요청: {roi_name}")
        print(f"   파일: {file.filename}")
        print(f"   영역: ({x1:.3f}, {y1:.3f}) ~ ({x2:.3f}, {y2:.3f})")
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # FLIR 열화상 이미지 추출
            fie = FlirImageExtractor()
            fie.process_image(temp_path)
            
            # 온도 데이터 추출
            thermal_data = fie.get_thermal_np()
            
            if thermal_data is None or thermal_data.size == 0:
                return jsonify({
                    "success": False,
                    "error": "열화상 데이터를 추출할 수 없습니다. FLIR 이미지가 아닐 수 있습니다."
                }), 400
            
            # 이미지 크기
            height, width = thermal_data.shape
            print(f"   이미지 크기: {width} x {height}")
            
            # 비율을 픽셀 좌표로 변환
            px1 = int(x1 * width)
            py1 = int(y1 * height)
            px2 = int(x2 * width)
            py2 = int(y2 * height)
            
            # 좌표 정렬 (x1 < x2, y1 < y2)
            px1, px2 = min(px1, px2), max(px1, px2)
            py1, py2 = min(py1, py2), max(py1, py2)
            
            # 경계 체크
            px1 = max(0, min(px1, width - 1))
            px2 = max(0, min(px2, width - 1))
            py1 = max(0, min(py1, height - 1))
            py2 = max(0, min(py2, height - 1))
            
            print(f"   픽셀 좌표: ({px1}, {py1}) ~ ({px2}, {py2})")
            
            # ROI 영역 추출
            roi_data = thermal_data[py1:py2+1, px1:px2+1]
            
            if roi_data.size == 0:
                return jsonify({
                    "success": False,
                    "error": "ROI 영역이 너무 작습니다."
                }), 400
            
            # 온도 통계 계산
            roi_stats = {
                "name": roi_name,
                "coordinates": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "pixel_x1": px1,
                    "pixel_y1": py1,
                    "pixel_x2": px2,
                    "pixel_y2": py2,
                    "width": px2 - px1 + 1,
                    "height": py2 - py1 + 1
                },
                "temperature": {
                    "min": float(np.min(roi_data)),
                    "max": float(np.max(roi_data)),
                    "avg": float(np.mean(roi_data)),
                    "median": float(np.median(roi_data)),
                    "std": float(np.std(roi_data)),
                    "pixel_count": int(roi_data.size)
                }
            }
            
            print(f"✅ ROI 분석 완료!")
            print(f"   최저 온도: {roi_stats['temperature']['min']:.2f}°C")
            print(f"   최고 온도: {roi_stats['temperature']['max']:.2f}°C")
            print(f"   평균 온도: {roi_stats['temperature']['avg']:.2f}°C")
            print(f"   픽셀 수: {roi_stats['temperature']['pixel_count']:,}개")
            
            return jsonify({
                "success": True,
                "roi": roi_stats,
                "filename": file.filename
            })
            
        finally:
            # 임시 파일 삭제
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        print(f"❌ ROI 분석 오류")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "ROI 분석 중 오류가 발생했습니다."
        }), 500


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
    
    print("\n🌐 서버: http://localhost:5001")
    print("="*60 + "\n")
    
    # debug=False: 운영/개발 구분 없이 debug 모드 비활성화 (보안 취약점 방지)
    # host="0.0.0.0": 내부망 전용 서비스이므로 허용 (방화벽으로 외부 차단 필요)
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host="0.0.0.0", port=5001, debug=debug_mode)

