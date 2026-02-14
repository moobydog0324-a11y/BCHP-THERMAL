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

def check_filenames():
    url = get_db_url()
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        # thermal_images -> inspections -> pipes (section_category)
        query = """
            SELECT t.original_filename
            FROM thermal_images t
            JOIN inspections i ON t.inspection_id = i.inspection_id
            JOIN pipes p ON i.pipe_id = p.pipe_id
            WHERE p.section_category = 'C-1'
            ORDER BY t.original_filename
            LIMIT 50
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        print(f"\n🔍 C-1 구역 파일명 패턴 확인 ({len(rows)}개):")
        for row in rows:
            print(row[0])

        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    check_filenames()
