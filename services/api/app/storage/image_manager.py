"""
services/api/app/storage/image_manager.py
Image storage and processing management
"""

import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from PIL import Image
from io import BytesIO


class ImageManager:
    def __init__(self, storage_path: str = "./storage"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def save_uploaded_file(self, file: UploadFile, subfolder: str = "") -> str:
        """Save uploaded file and return relative path"""
        try:
            filename = f"{uuid.uuid4()}_{file.filename}"
            if subfolder:
                folder = self.storage_path / subfolder
                folder.mkdir(parents=True, exist_ok=True)
            else:
                folder = self.storage_path

            filepath = folder / filename
            with open(filepath, "wb") as buffer:
                contents = file.file.read()
                buffer.write(contents)

            # Return relative path for URL
            return f"/storage/{subfolder}/{filename}" if subfolder else f"/storage/{filename}"

        except Exception as e:
            raise Exception(f"Failed to save file: {str(e)}")

    def save_image_bytes(self, image_bytes: bytes, filename: str = None, subfolder: str = "") -> str:
        """Save image bytes and return relative path"""
        try:
            if filename is None:
                filename = f"{uuid.uuid4()}.png"

            if subfolder:
                folder = self.storage_path / subfolder
                folder.mkdir(parents=True, exist_ok=True)
            else:
                folder = self.storage_path

            filepath = folder / filename
            with open(filepath, "wb") as f:
                f.write(image_bytes)

            return f"/storage/{subfolder}/{filename}" if subfolder else f"/storage/{filename}"

        except Exception as e:
            raise Exception(f"Failed to save image: {str(e)}")

    def create_thumbnail(self, image_path: str, max_width: int = 200) -> str:
        """Create thumbnail and return path"""
        try:
            full_path = self.storage_path / image_path.lstrip("/storage/")
            img = Image.open(full_path)

            # Resize maintaining aspect ratio
            img.thumbnail((max_width, max_width))

            # Save thumbnail
            thumb_path = full_path.parent / f"{full_path.stem}_thumb{full_path.suffix}"
            img.save(thumb_path)

            return str(thumb_path.relative_to(self.storage_path.parent))

        except Exception as e:
            raise Exception(f"Failed to create thumbnail: {str(e)}")

    def delete_file(self, filepath: str) -> bool:
        """Delete a file"""
        try:
            full_path = self.storage_path / filepath.lstrip("/storage/")
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception as e:
            raise Exception(f"Failed to delete file: {str(e)}")

    def get_file_size(self, filepath: str) -> int:
        """Get file size in bytes"""
        try:
            full_path = self.storage_path / filepath.lstrip("/storage/")
            return full_path.stat().st_size
        except Exception as e:
            raise Exception(f"Failed to get file size: {str(e)}")

    def cleanup_old_files(self, days: int = 30) -> int:
        """Delete files older than specified days. Returns count of deleted files"""
        import time
        deleted_count = 0
        current_time = time.time()
        cutoff_time = current_time - (days * 24 * 60 * 60)

        try:
            for root, dirs, files in os.walk(self.storage_path):
                for file in files:
                    filepath = Path(root) / file
                    if filepath.stat().st_mtime < cutoff_time:
                        filepath.unlink()
                        deleted_count += 1
            return deleted_count
        except Exception as e:
            raise Exception(f"Failed to cleanup old files: {str(e)}")
