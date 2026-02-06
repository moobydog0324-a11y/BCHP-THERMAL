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

def check_data():
    url = get_db_url()
    if not url:
        print("❌ DATABASE_URL not found")
        return
    
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        print("\n🔍 최근 5개 이미지 데이터 확인:")
        # original_filename 제거, image_url 등으로 대체
        cur.execute("""
            SELECT image_id, image_url, capture_timestamp, 
                   range_min, range_max, avg_temp
            FROM thermal_images 
            ORDER BY capture_timestamp DESC 
            LIMIT 5
        """)
        
        rows = cur.fetchall()
        for row in rows:
            print(f"\nID: {row[0]}")
            print(f"URL: {row[1]}")
            print(f"Captured: {row[2]}")
            print(f"Temp Range: Min={row[3]}, Max={row[4]}, Avg={row[5]}")
            
            if row[3] is None and row[4] is None:
                print("⚠️  온도 데이터가 NULL입니다!")
            elif row[3] == 0 and row[4] == 0:
                print("⚠️  온도 데이터가 0입니다!")
            else:
                print("✅ 온도 데이터 존재함")

        conn.close()
        
    except Exception as e:
        print(f"❌ DB 조회 실패: {e}")

if __name__ == '__main__':
    check_data()
