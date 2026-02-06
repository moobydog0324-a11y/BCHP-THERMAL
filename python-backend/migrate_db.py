import os
import psycopg2

def get_db_url():
    # .env.local is in parent directory relative to python-backend
    env_path = os.path.join(os.path.dirname(__file__), '../.env.local')
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('DATABASE_URL='):
                val = line.split('=', 1)[1].strip()
                # Remove surrounding quotes if present
                return val.strip('"').strip("'")
    return None

def migrate():
    url = get_db_url()
    if not url:
        print("❌ DATABASE_URL not found in .env.local")
        return
    
    print(f"🔄 Connecting to Database...")
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        print("🚀 Executing ALTER TABLE commands...")
        
        # Add columns one by one or in block
        queries = [
            "ALTER TABLE thermal_images ADD COLUMN IF NOT EXISTS range_min FLOAT;",
            "ALTER TABLE thermal_images ADD COLUMN IF NOT EXISTS range_max FLOAT;",
            "ALTER TABLE thermal_images ADD COLUMN IF NOT EXISTS avg_temp FLOAT;"
        ]
        
        for q in queries:
            print(f"   Executing: {q}")
            cur.execute(q)
            
        conn.commit()
        print("✅ Migration successful! ALL columns added.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == '__main__':
    migrate()
