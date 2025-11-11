"""
ExifTool 찾기 유틸리티
현재 시스템에서 ExifTool이 어디에 있는지 찾아줍니다.
"""

import os
import subprocess

def find_exiftool_detailed():
    """여러 위치에서 ExifTool을 찾고 상세 정보 출력"""
    
    print("="*70)
    print("🔍 ExifTool 검색 중...")
    print("="*70)
    
    possible_paths = [
        # 1. 현재 폴더 (python-backend/)
        ("현재 폴더", os.path.join(os.path.dirname(__file__), "exiftool.exe")),
        ("현재 폴더 (-k)", os.path.join(os.path.dirname(__file__), "exiftool(-k).exe")),
        
        # 2. 프로젝트 루트 폴더
        ("프로젝트 루트", os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool.exe")),
        ("프로젝트 루트 (-k)", os.path.join(os.path.dirname(os.path.dirname(__file__)), "exiftool(-k).exe")),
        
        # 3. 다운로드 폴더
        ("다운로드 폴더", os.path.join(os.path.expanduser("~"), "Downloads", "exiftool.exe")),
        ("다운로드 폴더 (-k)", os.path.join(os.path.expanduser("~"), "Downloads", "exiftool(-k).exe")),
        
        # 4. 바탕화면
        ("바탕화면", os.path.join(os.path.expanduser("~"), "Desktop", "exiftool.exe")),
        ("바탕화면 (-k)", os.path.join(os.path.expanduser("~"), "Desktop", "exiftool(-k).exe")),
    ]
    
    found = []
    not_found = []
    
    for location, path in possible_paths:
        if os.path.exists(path):
            size_mb = os.path.getsize(path) / (1024 * 1024)
            found.append((location, path, size_mb))
            print(f"✅ 발견: [{location}]")
            print(f"   경로: {path}")
            print(f"   크기: {size_mb:.2f} MB")
            print()
        else:
            not_found.append((location, path))
    
    # 시스템 PATH 확인
    print("🔍 시스템 PATH 확인 중...")
    try:
        result = subprocess.run(["where", "exiftool"], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            paths = result.stdout.strip().split('\n')
            for path in paths:
                print(f"✅ 발견: [시스템 PATH]")
                print(f"   경로: {path}")
                found.append(("시스템 PATH", path, 0))
        else:
            print("❌ 시스템 PATH에 없음")
            not_found.append(("시스템 PATH", "N/A"))
    except Exception as e:
        print(f"⚠️  시스템 PATH 확인 실패: {e}")
    
    print("\n" + "="*70)
    
    if found:
        print(f"✅ {len(found)}개의 ExifTool 발견!")
        print("\n권장 사항:")
        print(f"   가장 좋은 위치: python-backend\\exiftool.exe")
        
        # 이름 변경이 필요한 경우 안내
        for location, path, _ in found:
            if "(-k)" in path:
                new_path = path.replace("(-k)", "")
                print(f"\n⚠️  파일 이름 변경 필요:")
                print(f"   현재: {path}")
                print(f"   변경: {new_path}")
                print(f"\n   PowerShell 명령:")
                print(f"   Rename-Item '{path}' 'exiftool.exe'")
    else:
        print("❌ ExifTool을 찾을 수 없습니다!")
        print("\n📥 다운로드 방법:")
        print("   1. https://exiftool.org/ 방문")
        print("   2. 'Windows Executable' 클릭")
        print("   3. 다운로드한 파일 압축 해제")
        print("   4. exiftool(-k).exe → exiftool.exe 이름 변경")
        print("   5. 다음 위치로 이동:")
        print(f"      {os.path.join(os.path.dirname(__file__), 'exiftool.exe')}")
    
    print("\n" + "="*70)
    
    # 찾지 못한 위치 상세
    if not_found and not found:
        print("\n검색한 위치:")
        for location, path in not_found[:5]:  # 처음 5개만
            if path != "N/A":
                print(f"   ❌ {location}: {path}")
    
    return len(found) > 0

if __name__ == "__main__":
    found = find_exiftool_detailed()
    
    if not found:
        print("\n💡 도움말:")
        print("   1. 위 다운로드 방법대로 ExifTool을 설치하세요")
        print("   2. 설치 후 Flask 서버를 재시작하세요: python app.py")
        print("   3. 여전히 문제가 있다면 이 스크립트를 다시 실행하세요")


