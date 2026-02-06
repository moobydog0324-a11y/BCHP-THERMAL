import cv2
import numpy as np
import requests
import json
from flask import Blueprint, request, jsonify
from loguru import logger
from skimage.metrics import structural_similarity as ssim

analysis_bp = Blueprint('analysis', __name__)

def load_image_from_url(url):
    """URL에서 이미지를 다운로드하여 OpenCV 포맷으로 변환"""
    try:
        resp = requests.get(url, stream=True).raw
        image = np.asarray(bytearray(resp.read()), dtype="uint8")
        image = cv2.imdecode(image, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        logger.error(f"Failed to load image from URL: {url}, Error: {e}")
        return None

def align_images_orb(master_img, target_img, max_features=5000, keep_percent=0.2):
    """ORB 특징점 매칭을 이용한 자동 정합"""
    # 1. Convert to grayscale
    img1_gray = cv2.cvtColor(master_img, cv2.COLOR_BGR2GRAY)
    img2_gray = cv2.cvtColor(target_img, cv2.COLOR_BGR2GRAY)

    # 2. Detect ORB features and descriptors
    orb = cv2.ORB_create(max_features)
    keypoints1, descriptors1 = orb.detectAndCompute(img1_gray, None)
    keypoints2, descriptors2 = orb.detectAndCompute(img2_gray, None)

    if descriptors1 is None or descriptors2 is None:
        return None, 0.0

    # 3. Match features using Hamming distance
    matcher = cv2.DescriptorMatcher_create(cv2.DESCRIPTOR_MATCHER_BRUTEFORCE_HAMMING)
    matches = matcher.match(descriptors1, descriptors2, None)

    # 4. Sort matches by score (lower is better)
    matches.sort(key=lambda x: x.distance, reverse=False)

    # 5. Keep only top N% matches
    num_keep = int(len(matches) * keep_percent)
    matches = matches[:num_keep]

    # 6. Extract location of good matches
    points1 = np.zeros((len(matches), 2), dtype=np.float32)
    points2 = np.zeros((len(matches), 2), dtype=np.float32)

    for i, match in enumerate(matches):
        points1[i, :] = keypoints1[match.queryIdx].pt
        points2[i, :] = keypoints2[match.trainIdx].pt

    # 7. Find Homography
    # RANSAC을 사용하여 이상치 제거
    try:
        h_matrix, mask = cv2.findHomography(points2, points1, cv2.RANSAC)
        
        # Calculate alignment score (inliers ratio or similar)
        if mask is not None:
             inliers_ratio = np.sum(mask) / len(mask)
        else:
             inliers_ratio = 0.0
             
        return h_matrix, inliers_ratio
    except Exception as e:
        logger.error(f"Homography calculation failed: {e}")
        return None, 0.0

@analysis_bp.route('/align/auto', methods=['POST'])
def auto_align():
    """
    Input: { "master_url": "...", "target_url": "..." }
    Output: { "matrix": [[...]], "score": 0.95 }
    """
    data = request.json
    master_url = data.get('master_url')
    target_url = data.get('target_url')

    if not master_url or not target_url:
        return jsonify({"error": "Missing image URLs"}), 400

    master_img = load_image_from_url(master_url)
    target_img = load_image_from_url(target_url)

    if master_img is None or target_img is None:
        return jsonify({"error": "Failed to load images"}), 400

    # Resize for faster processing if too large? (Optional)
    
    matrix, score = align_images_orb(master_img, target_img)

    if matrix is not None:
        return jsonify({
            "success": True,
            "matrix": matrix.tolist(),
            "score": score
        })
    else:
        return jsonify({
            "success": False,
            "error": "Alignment failed"
        })

@analysis_bp.route('/align/manual', methods=['POST'])
def manual_align():
    """
    Input: { 
        "master_points": [[x,y], [x,y], [x,y]], 
        "target_points": [[x,y], [x,y], [x,y]],
        "image_width": 640,
        "image_height": 480
    }
    Output: { "matrix": [[...]] }
    """
    data = request.json
    master_pts = np.array(data.get('master_points'), dtype=np.float32)
    target_pts = np.array(data.get('target_points'), dtype=np.float32)
    
    if len(master_pts) < 3 or len(target_pts) < 3:
        return jsonify({"error": "Need at least 3 points"}), 400

    try:
        # Affine (3 points) or Perspective (4 points)? 
        # Usually Perspective (Homography) provides better results for drone shots.
        if len(master_pts) >= 4:
            matrix, _ = cv2.findHomography(target_pts, master_pts, cv2.RANSAC)
        else:
            matrix = cv2.getAffineTransform(target_pts[:3], master_pts[:3])
            # Convert 2x3 affine to 3x3 homography style for consistency
            matrix = np.vstack([matrix, [0, 0, 1]])

        return jsonify({
            "success": True,
            "matrix": matrix.tolist()
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@analysis_bp.route('/analyze/roi', methods=['POST'])
def analyze_roi_series():
    """
    Input: {
        "target_url": "...",
        "transform_matrix": [[...]] (Optional, if null assume aligned),
        "rois": [
            { "id": 1, "type": "rect", "coords": [x1, y1, x2, y2] }
        ]
    }
    Output: { "results": [ { "id": 1, "min": 10, "max": 50, "avg": 30 } ] }
    """
    data = request.json
    target_url = data.get('target_url')
    matrix_data = data.get('transform_matrix')
    rois = data.get('rois', [])

    target_img = load_image_from_url(target_url)
    if target_img is None:
        return jsonify({"error": "Failed to load image"}), 400
    
    # 1. Apply Transformation if matrix exists
    if matrix_data:
        matrix = np.array(matrix_data)
        height, width = target_img.shape[:2]
        # Warp perspective
        warped_img = cv2.warpPerspective(target_img, matrix, (width, height))
    else:
        warped_img = target_img

    # 2. Extract Temperature Data from ROIs
    # NOTE: The image loaded might be RGB Visual or Radiometric JPG.
    # If it's a raw thermal image (1-channel), we can read temperature directly.
    # If it's a Visual image, we can't extract temperature.
    # Assuming the input URL points to a FLIR Radiometric JPEG, 
    # we need to extract thermal data using flirimageextractor FIRST.
    
    # TODO: This part needs `flirimageextractor` integration similar to `app.py`.
    # For now, let's assume we are working with the thermal array directly 
    # OR we invoke the extraction logic here.
    
    # Re-using the logic from app.py might be cleaner.
    # For this MVP, let's assume we extract thermal data from the warped image location.
    # However, warping raw temperature data is tricky (interpolation).
    # Strategy:
    # 1. Extract Thermal 2D Array from original Target Image.
    # 2. Warp the Thermal 2D Array using the matrix (Nearest Neighbor to preserve raw values? or Linear).
    # 3. Crop ROI from warped Thermal Array.
    
    from flirimageextractor import FlirImageExtractor
    import tempfile
    import os
    
    # Save to temp file for flir extractor
    suffix = ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(requests.get(target_url).content)
        tmp_path = tmp.name

    try:
        fie = FlirImageExtractor()
        fie.process_image(tmp_path)
        thermal_np = fie.get_thermal_np()
        
        if thermal_np is None:
             raise Exception("No thermal data found")
        
        # Warp the thermal numpy array
        if matrix_data:
             matrix = np.array(matrix_data)
             height, width = thermal_np.shape
             # Use Inter_Linear for smooth temperature gradients, or Nearest for raw pixel preservation
             warped_thermal = cv2.warpPerspective(thermal_np, matrix, (width, height), flags=cv2.INTER_LINEAR)
        else:
             warped_thermal = thermal_np

        results = []
        for roi in rois:
            coords = roi.get('coords') # [x, y, w, h] or [x1, y1, x2, y2]
            # Assuming normalized coords 0.0 ~ 1.0 based on Master Image
            h, w = warped_thermal.shape
            
            x1 = int(coords['x1'] * w)
            y1 = int(coords['y1'] * h)
            x2 = int(coords['x2'] * w)
            y2 = int(coords['y2'] * h)
            
            # Clip
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            roi_area = warped_thermal[y1:y2, x1:x2]
            
            if roi_area.size > 0:
                results.append({
                    "id": roi.get('id'),
                    "min": float(np.min(roi_area)),
                    "max": float(np.max(roi_area)),
                    "avg": float(np.mean(roi_area)),
                    "std": float(np.std(roi_area))
                })
            else:
                results.append({ "id": roi.get('id'), "error": "Empty ROI" })

        os.remove(tmp_path)
        return jsonify({ "success": True, "results": results })

    except Exception as e:
        if os.path.exists(tmp_path):
             os.remove(tmp_path)
        return jsonify({"success": False, "error": str(e)}), 500
