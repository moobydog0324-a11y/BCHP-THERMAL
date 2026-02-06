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

def check_schema():
    url = get_db_url()
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'thermal_images'")
        rows = cur.fetchall()
        print("Columns in thermal_images:")
        for r in rows:
            print(f"- {r[0]}")
        conn.close()
    except Exception as e:
        print(e)

if __name__ == '__main__':
    check_schema()
