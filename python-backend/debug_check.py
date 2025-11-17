# -*- coding: utf-8 -*-
import sys
import io
import requests
import json

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# C-1 구역 첫 이미지 확인
response = requests.get('http://localhost:3000/api/thermal-images/by-section/C-1?image_type=thermal')
data = response.json()

if data['success'] and len(data['data']) > 0:
    img = data['data'][0]
    print(f"Image ID: {img['image_id']}")
    print(f"\n=== temperature 객체 ===")
    print(json.dumps(img['temperature'], indent=2, ensure_ascii=False))
    
    print(f"\n=== thermal_data_json 객체 ===")
    if img['thermal_data_json']:
        print(f"actual_temp_stats 존재: {'actual_temp_stats' in img['thermal_data_json']}")
        if 'actual_temp_stats' in img['thermal_data_json']:
            print(json.dumps(img['thermal_data_json']['actual_temp_stats'], indent=2))
        else:
            print("❌ actual_temp_stats가 없습니다!")
            print("\nCameraTemperatureRangeMin:", img['thermal_data_json'].get('CameraTemperatureRangeMin'))
            print("CameraTemperatureRangeMax:", img['thermal_data_json'].get('CameraTemperatureRangeMax'))
    else:
        print("❌ thermal_data_json이 null입니다!")

