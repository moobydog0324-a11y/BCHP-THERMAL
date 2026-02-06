# -*- coding: utf-8 -*-
"""
기존 DB 이미지들의 실제 온도 데이터 재추출 스크립트
Next.js API를 통해 작동
"""
import sys
import io
import os
import json
import requests
import tempfile
import time

# Windows 유니코드 출력
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

NEXTJS_API = 'http://localhost:3000/api'
FLASK_SERVER = 'http://localhost:5000'

def get_all_thermal_images():
    """모든 구역의 thermal 이미지 가져오기"""
    sections = ['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2']
    all_images = []
    
    for section in sections:
        try:
            response = requests.get(
                f'{NEXTJS_API}/thermal-images/by-section/{section}?image_type=thermal',
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    all_images.extend(data['data'])
        except Exception as e:
            print(f"  ⚠️ {section} 조회 오류: {e}")
    
    return all_images

def download_image(image_url, temp_path):
    """Supabase에서 이미지 다운로드"""
    try:
        response = requests.get(image_url, timeout=30)
        if response.status_code == 200:
            with open(temp_path, 'wb') as f:
                f.write(response.content)
            return True
        return False
    except Exception as e:
        print(f"  ❌ 다운로드 오류: {e}")
        return False

def analyze_with_flask(image_path):
    """Flask 서버로 이미지 분석"""
    try:
        with open(image_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(f'{FLASK_SERVER}/analyze', files=files, timeout=90)
            
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('thermal_data')
        return None
    except Exception as e:
        print(f"  ❌ 분석 오류: {e}")
        return None

def update_metadata_via_api(image_id, thermal_data):
    """Next.js API를 통해 메타데이터 업데이트"""
    try:
        response = requests.post(
            f'{NEXTJS_API}/update-thermal-metadata',
            json={
                'image_id': image_id,
                'thermal_data': thermal_data
            },
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"  ❌ 업데이트 오류: {e}")
        return False

def main():
    print("="*70)
    print("🔄 기존 이미지 실제 온도 데이터 재추출 시작")
    print("="*70)
    
    # 1. 서버 확인
    try:
        response = requests.get(FLASK_SERVER, timeout=5)
        print(f"✅ Flask 서버 연결 확인: {FLASK_SERVER}")
    except:
        print(f"❌ Flask 서버에 연결할 수 없습니다: {FLASK_SERVER}")
        print("   RUN-FLASK.bat를 실행하여 Flask 서버를 먼저 시작하세요!")
        return
    
    try:
        response = requests.get(f'{NEXTJS_API}/test-connection', timeout=5)
        print(f"✅ Next.js API 연결 확인: {NEXTJS_API}")
    except:
        print(f"❌ Next.js 서버에 연결할 수 없습니다: {NEXTJS_API}")
        print("   npm run dev를 실행하여 Next.js 서버를 먼저 시작하세요!")
        return
    
    # 2. 모든 thermal 이미지 가져오기
    print("\n📥 이미지 목록 가져오는 중...")
    all_images = get_all_thermal_images()
    
    # actual_temp_stats가 없는 이미지만 필터링 (thermal_data_json 확인)
    images_to_update = []
    for img in all_images:
        thermal_json = img.get('thermal_data_json', {})
        if not thermal_json:
            images_to_update.append(img)
        elif not thermal_json.get('actual_temp_stats'):
            images_to_update.append(img)
    
    total = len(images_to_update)
    print(f"📊 재분석 대상: {total}개 이미지 (전체 {len(all_images)}개 중)")
    
    if total == 0:
        print("✅ 모든 이미지가 이미 분석되었습니다!")
        return
    
    print(f"\n계속하시겠습니까? (Y/N): ", end='')
    answer = input().strip().upper()
    if answer != 'Y':
        print("취소되었습니다.")
        return
    
    # 3. 각 이미지 재분석
    success_count = 0
    fail_count = 0
    temp_dir = tempfile.mkdtemp()
    
    for idx, img in enumerate(images_to_update, 1):
        image_id = img['image_id']
        image_url = img['image_url']
        section = img.get('section_category', 'Unknown')
        
        print(f"\n[{idx}/{total}] ID:{image_id} ({section})")
        
        # 임시 파일 경로
        temp_path = os.path.join(temp_dir, f"temp_{image_id}.jpg")
        
        try:
            # 다운로드
            print(f"  📥 다운로드 중...")
            if not download_image(image_url, temp_path):
                fail_count += 1
                continue
            
            # 분석
            print(f"  🔥 온도 분석 중...")
            thermal_data = analyze_with_flask(temp_path)
            
            if thermal_data and 'actual_temp_stats' in thermal_data:
                stats = thermal_data['actual_temp_stats']
                print(f"  ✅ 분석 완료!")
                print(f"     최저: {stats['min_temp']:.1f}°C")
                print(f"     최고: {stats['max_temp']:.1f}°C")
                print(f"     평균: {stats['avg_temp']:.1f}°C")
                
                # DB 업데이트
                print(f"  💾 DB 업데이트 중...")
                if update_metadata_via_api(image_id, thermal_data):
                    print(f"  💾 DB 업데이트 완료!")
                    success_count += 1
                else:
                    print(f"  ❌ DB 업데이트 실패")
                    fail_count += 1
            else:
                print(f"  ⚠️ 온도 데이터 추출 실패")
                fail_count += 1
            
            # 임시 파일 삭제
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            # 너무 빠르게 요청하지 않도록 약간 대기
            time.sleep(0.5)
                
        except Exception as e:
            print(f"  ❌ 처리 오류: {e}")
            fail_count += 1
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    # 4. 결과 요약
    print("\n" + "="*70)
    print("📊 재분석 완료!")
    print(f"  ✅ 성공: {success_count}개")
    print(f"  ❌ 실패: {fail_count}개")
    if success_count > 0:
        print("\n✅ 데이터 관리 페이지를 새로고침하면 실제 온도가 표시됩니다!")
    print("="*70)

if __name__ == '__main__':
    main()
