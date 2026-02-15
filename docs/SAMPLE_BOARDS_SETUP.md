# Sample Boards Setup for Study Mode

## Overview
Your two sample schematic board images have been successfully processed and integrated into Study Mode for testing.

## Images Processed
1. **laptop-motherboard-front.jpg** - Front side of a laptop motherboard
2. **computer-circuit-back.jpg** - Back side of a computer circuit board

Both images are now stored in: `services/api/storage/`

## What Was Done

### 1. Backend Updates

#### Added Sample Boards Endpoint
- **File**: `services/api/app/routers/boards.py`
- **Endpoint**: `GET /api/boards/samples/list`
- **Returns**: List of 2 sample boards with their metadata and image URLs
- **Response**:
  ```json
  {
    "samples": [
      {
        "id": "sample-front",
        "boardId": "sample-board-01",
        "deviceModel": "Laptop Motherboard",
        "side": "front",
        "imageUrl": "/api/uploads/laptop-motherboard-front.jpg",
        "notes": "Sample laptop motherboard - front side"
      },
      {
        "id": "sample-back",
        "boardId": "sample-board-02",
        "deviceModel": "Circuit Board",
        "side": "back",
        "imageUrl": "/api/uploads/computer-circuit-back.jpg",
        "notes": "Sample computer circuit board - back side"
      }
    ]
  }
  ```

#### Added File Serving
- **File**: `services/api/app/routers/uploads.py`
- **Endpoint**: `GET /api/uploads/{filename}`
- **Purpose**: Serves image files from the storage directory
- **Supports**: JPEG, PNG, GIF, WebP formats

### 2. Frontend Updates

#### API Client Method
- **File**: `apps/web/src/lib/api/client.ts`
- **Method**: `apiClient.getSampleBoards()`
- **Purpose**: Fetches the list of available sample boards

#### Study Mode Page
- **File**: `apps/web/src/app/mode/study/page.tsx`
- **Added**:
  - State management for sample boards and selected board
  - Board selector component in the toolbar
  - Dynamic image loading from the backend
  - Image error handling with fallback message
  - Canvas initialization with actual board images
  - Responsive image scaling to fit canvas

## How to Use

### 1. Start the Backend
```bash
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Start the Frontend
```bash
cd apps/web
npm run dev  # Runs on http://localhost:3000
```

### 3. Access Study Mode
1. Navigate to `http://localhost:3000`
2. Click on "Study Mode"
3. In the left sidebar under "Sample Boards", you'll see two boards:
   - **Laptop Motherboard** (Front)
   - **Circuit Board** (Back)
4. Click on a board to load it on the canvas
5. Use the annotation tools to mark up the board images

## Features Available in Study Mode

- **Board Selection**: Switch between the two sample boards
- **Drawing Tools**: Pen, arrow, rectangle, circle, text, eraser
- **Color Palette**: 6 colors to choose from
- **Stroke Width**: Adjustable from 1-20px
- **Zoom**: Zoom in/out or fit to screen
- **Layers**: Show/hide different annotation layers
- **Export**: Save your annotated images and annotations

## File Locations

| Component | Path |
|-----------|------|
| Sample Images | `services/api/storage/` |
| Backend Routes | `services/api/app/routers/boards.py` |
| Backend File Server | `services/api/app/routers/uploads.py` |
| Frontend API Client | `apps/web/src/lib/api/client.ts` |
| Study Mode Page | `apps/web/src/app/mode/study/page.tsx` |

## Testing

To verify everything is working:

1. Check backend is running: `curl http://localhost:8000/api/boards/samples/list`
   - Should return the JSON with both sample boards

2. Check frontend loads correctly
   - Navigate to study mode
   - Both sample boards should appear in the selector
   - Clicking on a board should display its image on the canvas

3. Test image serving: Open `http://localhost:8000/api/uploads/laptop-motherboard-front.jpg`
   - Should display the image in your browser

## Next Steps

- Add more sample boards by:
  1. Copying image files to `services/api/storage/`
  2. Adding entries to the `GET /api/boards/samples/list` endpoint response

- Persist sample boards to database (currently hardcoded in endpoint)
- Add board rotation/transformation tools
- Implement export functionality to save annotations
- Add component detection and labeling on top of annotations

## Troubleshooting

**Images not loading?**
- Ensure backend is running on `http://localhost:8000`
- Check that image files exist in `services/api/storage/`
- Verify CORS is enabled in the backend
- Check browser console for error messages

**Study Mode not showing board selector?**
- Verify `apiClient.getSampleBoards()` is being called (check browser DevTools)
- Ensure backend `/api/boards/samples/list` endpoint is accessible

**Canvas is empty?**
- Check browser console for image loading errors
- Verify the imageUrl paths are correct
- Try opening the image URL directly in a new tab
