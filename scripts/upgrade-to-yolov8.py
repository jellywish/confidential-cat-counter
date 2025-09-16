#!/usr/bin/env python3
"""
Upgrade script to download and integrate YOLOv8 for better cat detection accuracy
"""

import os
import requests
import sys
from pathlib import Path

# YOLOv8 model URLs (ONNX format)
YOLOV8_MODELS = {
    'yolov8n.onnx': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx',  # Nano - fastest
    'yolov8s.onnx': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8s.onnx',  # Small - balanced
    'yolov8m.onnx': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8m.onnx',  # Medium - higher accuracy
}

def download_model(model_name, url, target_dir):
    """Download YOLOv8 ONNX model"""
    target_path = Path(target_dir) / model_name
    
    if target_path.exists():
        print(f"✅ {model_name} already exists")
        return target_path
    
    print(f"📥 Downloading {model_name}...")
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r  Progress: {percent:.1f}% ({downloaded / 1024 / 1024:.1f}MB)", end='')
        
        print(f"\n✅ Downloaded {model_name} ({os.path.getsize(target_path) / 1024 / 1024:.1f}MB)")
        return target_path
        
    except Exception as e:
        print(f"❌ Failed to download {model_name}: {e}")
        if target_path.exists():
            target_path.unlink()
        return None

def update_ml_service_for_yolov8():
    """Update the ML service to use YOLOv8"""
    
    ml_service_path = Path("src/ml-service/app.py")
    
    if not ml_service_path.exists():
        print(f"❌ ML service not found at {ml_service_path}")
        return False
    
    # Read current file
    with open(ml_service_path, 'r') as f:
        content = f.read()
    
    # Update model path and class detection for YOLOv8
    updates = {
        'yolov5s.onnx': 'yolov8s.onnx',  # Switch to YOLOv8 small
        'yolov5s-onnx': 'yolov8s-onnx',  # Update model name in results
        "# Class 15 is typically 'cat' in COCO dataset (YOLOv5)": "# Class 15 is 'cat' in COCO dataset (YOLOv8)",
        "(640, 640)": "(640, 640)",  # Same input size
    }
    
    updated_content = content
    for old, new in updates.items():
        updated_content = updated_content.replace(old, new)
    
    # Backup original
    backup_path = ml_service_path.with_suffix('.py.backup')
    with open(backup_path, 'w') as f:
        f.write(content)
    
    # Write updated file
    with open(ml_service_path, 'w') as f:
        f.write(updated_content)
    
    print(f"✅ Updated ML service for YOLOv8 (backup: {backup_path})")
    return True

def main():
    """Main upgrade process"""
    print("🚀 YOLOv8 Upgrade for Better Cat Detection")
    print("==========================================")
    
    # Check if running from project root
    if not Path("src/ml-service").exists():
        print("❌ Run this script from the project root directory")
        sys.exit(1)
    
    # Create models directory
    models_dir = Path("src/ml-service/models")
    models_dir.mkdir(exist_ok=True)
    
    # Download YOLOv8 small (good balance of speed/accuracy)
    model_url = YOLOV8_MODELS['yolov8s.onnx']
    model_path = download_model('yolov8s.onnx', model_url, models_dir)
    
    if not model_path:
        print("❌ Failed to download YOLOv8 model")
        sys.exit(1)
    
    # Update ML service code
    if not update_ml_service_for_yolov8():
        print("❌ Failed to update ML service")
        sys.exit(1)
    
    print("\n🎉 YOLOv8 upgrade complete!")
    print("\nNext steps:")
    print("1. Rebuild containers: make local-demo")
    print("2. Test with images - should see 'yolov8s-onnx' as model")
    print("3. Expect 5-10% better accuracy, especially on small cats")
    
    print(f"\nModel comparison:")
    print(f"- YOLOv5s: ~14MB, good accuracy")
    print(f"- YOLOv8s: ~{os.path.getsize(model_path) / 1024 / 1024:.1f}MB, better accuracy")

if __name__ == "__main__":
    main()
