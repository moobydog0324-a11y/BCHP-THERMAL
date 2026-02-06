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

def check_pipes_schema():
    url = get_db_url()
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        print("Checking pipes table schema...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pipes'")
        cols = [r[0] for r in cur.fetchall()]
        print(f"Pipes columns: {cols}")
        conn.close()
    except Exception as e:
        print(e)
        
if __name__ == '__main__':
    check_pipes_schema()
