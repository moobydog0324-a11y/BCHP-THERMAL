import os
import psycopg2
import json

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '../.env.local')
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                val = line.split('=', 1)[1].strip()
                return val.strip('"').strip("'")
    return None

def check_gps_data():
    url = get_db_url()
    if not url:
        print("❌ DATABASE_URL not found")
        return
    
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        print("\n🔍 C-1 구역 이미지 GPS 데이터 확인:")
        # original_filename 제거
        cur.execute("""
            SELECT t.image_id, t.image_url, 
                   m.metadata_json::json->>'GPSLatitude' as lat,
                   m.metadata_json::json->>'GPSLongitude' as lon,
                   t.capture_timestamp
            FROM thermal_images t
            LEFT JOIN image_metadata m ON t.image_id = m.image_id
            WHERE t.section_category = 'C-1'
            ORDER BY t.capture_timestamp DESC
            LIMIT 10
        """)
        
        rows = cur.fetchall()
        if not rows:
            print("⚠️ C-1 구역에 이미지가 없습니다.")
            return

        for row in rows:
            print(f"\nID: {row[0]}")
            print(f"URL: {row[1]}")
            print(f"GPS: Lat={row[2]}, Lon={row[3]}")
            print(f"Captured: {row[4]}")
            
            if row[2] is None or row[3] is None:
                print("❌ GPS 데이터 없음")
            else:
                print("✅ GPS 데이터 존재")

        conn.close()
        
    except Exception as e:
        print(f"❌ DB 조회 실패: {e}")

if __name__ == '__main__':
    check_gps_data()
