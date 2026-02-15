FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including OpenCV and Tesseract dependencies)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libxcb1 \
    libx11-6 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libtesseract-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create storage directory
RUN mkdir -p /app/storage

# Expose port (Railway will use $PORT environment variable)
EXPOSE 8000

# Run the application - PORT is provided by Railway
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
