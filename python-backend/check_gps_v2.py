import os
import psycopg2

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '../.env.local')
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                val = line.split('=', 1)[1].strip()
                return val.strip('"').strip("'")
    return None

def check_gps_real():
    url = get_db_url()
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        # inspections 테이블 컬럼 확인 (구역 정보 찾기)
        print("Checking inspections table schema...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'inspections'")
        cols = [r[0] for r in cur.fetchall()]
        print(f"Inspections columns: {cols}")
        
        target_col = 'section_category' if 'section_category' in cols else 'section'
        
        print(f"\n🔍 C-1 구역 이미지 GPS 데이터 확인 (Join with {target_col}):")
        
        query = f"""
            SELECT t.image_id, t.image_url, t.gps_latitude, t.gps_longitude, t.capture_timestamp
            FROM thermal_images t
            JOIN inspections i ON t.inspection_id = i.inspection_id
            WHERE i.{target_col} = 'C-1'
            ORDER BY t.capture_timestamp DESC
            LIMIT 10
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        if not rows:
            print("⚠️ C-1 구역에 이미지가 없습니다.")
        else:
            for row in rows:
                print(f"\nID: {row[0]}")
                print(f"GPS: Lat={row[2]}, Lon={row[3]}")
                if row[2] is None or row[3] is None:
                    print("❌ GPS 데이터 NULL")
                else:
                    print("✅ GPS 데이터 존재")

        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    check_gps_real()
