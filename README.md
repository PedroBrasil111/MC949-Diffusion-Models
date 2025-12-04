# MC949/MO446 - Diffusion Models for Image Restoration and Expansion

A web-based tool for image manipulation using diffusion models, featuring inpainting, outpainting, and super-resolution capabilities.

Members:
- João Pedro Leôncio - 260636
- Pedro Brasil Barroso - 260637
- Ana Beatriz Hidalgo - 260642

## Features:
- **Outpainting**: Expand images by 0-30% in any direction (left, right, top, bottom, or all sides)
- **Inpainting**: Remove or replace objects by drawing masks
- **Super-Resolution**: Upscale images using the Real-ESRGAN and SwinIR models

## Setup Instructions:

1. **Backend Setup**:
- Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

- Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```

- Run the backend server (inpainting and outpainting models):
    ```bash
    cd src/backend
    python app.py  # Runs on port 5000
    ```

2. **Frontend Setup**:
- Install Node.js and npm [here](https://nodejs.org/en/download/).
- Install frontend dependencies and run the React app:
    ```bash
    cd src/frontend
    npm install
    npm run start  # Runs on port 3000
    ```

3. **Backend Setup**:
   

## Usage:

- **Inpainting**:
    1. Select "Inpainting" tab
    2. Upload an image
    3. Draw on the image to create a red mask (areas to be replaced)
    4. Enter a prompt describing what to generate in the masked area
    5. Click "Process Image"

- **Outpainting**:
    1. Select "Outpainting" tab
    2. Upload an image
    3. Choose expansion direction (all sides, left, right, top, bottom, horizontal, vertical)
    4. Set percentage (0-30%)
    5. Enter a prompt describing what to generate in the expanded areas
    6. Click "Process Image"

- **Super-Resolution**:
    - Notebooks available in /notebooks directory
    - All required libraries are installed within notebook cells

### Notes:
- The application uses ControlNet for inpainting/outpainting
- Results can be downloaded or used as new input for further processing