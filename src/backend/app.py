from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image
import cv2
import io
import json
import numpy as np
from stable_diffusion_controlnet import ControlNetDiffusionPipeline

app = Flask(__name__)
CORS(app)

PROCESSOR = None
def get_processor():
    global PROCESSOR
    if PROCESSOR is None:
        print("Carregando modelos...")
        PROCESSOR = ImageProcessor()
        print("Modelos carregados!")
    return PROCESSOR

class ImageProcessor:
    def __init__(self):
        self.pipeline = ControlNetDiffusionPipeline()

    def process_inpainting(self, image, mask, params):
        prompt = params.get('prompt', '')
        negative_prompt = params.get('negative_prompt', '')
        guidance_scale = params.get('guidance_scale', 7.5)
        strength = params.get('strength', 0.8)
        num_inference_steps = params.get('num_inference_steps', 50)

        mask_binary = np.array(mask)
        mask_pil = Image.fromarray(mask_binary).convert('L')
        mask = self._feather_mask(self._expand_mask(mask_pil, 5), radius=20)

        self.pipeline.update(
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
        )

        result = self.pipeline.run_diffusion(
            image,
            mask,
            prompt,
            negative_prompt
        )
        return result

    def _feather_mask(self, mask, radius=25):
        np_mask = np.array(mask).astype(np.uint8)
        np_mask = cv2.GaussianBlur(np_mask, (0,0), radius)
        return Image.fromarray(np_mask)

    def _expand_mask(self, mask, pixels=20):
        np_mask = np.array(mask).astype(np.uint8)
        kernel = np.ones((pixels, pixels), np.uint8)
        expanded = cv2.dilate(np_mask, kernel, iterations=1)
        return Image.fromarray(expanded)

    def _fill_with_noise(self, arr, x1, y1, w, h):
        noise = np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)
        arr[y1:y1+h, x1:x1+w] = noise

    def process_outpainting(self, image, params):
        direction = params.get('direction', 'all')
        pixels_dict = params.get('pixels', {'left': 256, 'right': 256, 'top': 256, 'bottom': 256})
        prompt = params.get('prompt', '')
        negative_prompt = params.get('negative_prompt', '')
        guidance_scale = params.get('guidance_scale', 7.5)
        num_inference_steps = params.get('num_inference_steps', 50)
        strength = params.get('strength', 1.0)

        width, height = image.size

        if isinstance(pixels_dict, int):
            pixels_dict = {
                'left': pixels_dict if direction in ['left', 'horizontal', 'all'] else 0,
                'right': pixels_dict if direction in ['right', 'horizontal', 'all'] else 0,
                'top': pixels_dict if direction in ['top', 'vertical', 'all'] else 0,
                'bottom': pixels_dict if direction in ['bottom', 'vertical', 'all'] else 0
            }
        elif not isinstance(pixels_dict, dict):
            pixels_dict = {'left': 256, 'right': 256, 'top': 256, 'bottom': 256}

        left_pixels = pixels_dict.get('left', 0)
        right_pixels = pixels_dict.get('right', 0)
        top_pixels = pixels_dict.get('top', 0)
        bottom_pixels = pixels_dict.get('bottom', 0)

        new_width = width + left_pixels + right_pixels
        new_height = height + top_pixels + bottom_pixels

        # Create expanded blank canvas and mask
        new_image = Image.new("RGB", (new_width, new_height), (255, 255, 255))
        new_image.paste(image, (left_pixels, top_pixels))

        mask = Image.new("L", (new_width, new_height), 255)
        mask.paste(0, (left_pixels, top_pixels, left_pixels+width, top_pixels+height))
        mask.save("mask_raw.png")
        mask = self._feather_mask(self._expand_mask(mask, 50), radius=50)
        mask.save("mask_processed.png")

        # Run inpainting on the expanded canvas
        self.pipeline.update(
            strength,
            guidance_scale,
            num_inference_steps
        )
        result = self.pipeline.run_diffusion(
            new_image,
            mask,
            prompt,
            negative_prompt
        )

        return result

    @app.route('/process', methods=['POST'])
    def process_image():
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400

        image_processor = get_processor()
        image_file = request.files['image']
        task = request.form.get('task', 'outpainting')
        params = json.loads(request.form.get('params', '{}'))

        image = Image.open(image_file).convert('RGB')

        if task == 'outpainting':
            processed_image = image_processor.process_outpainting(image, params)
        elif task == 'inpainting':
            mask_file = request.files.get('mask')
            if not mask_file:
                return jsonify({'error': 'No mask provided for inpainting'}), 400
            mask = Image.open(mask_file).convert('L')
            processed_image = image_processor.process_inpainting(image, mask, params)
        elif task == 'superresolution':
            processed_image = image_processor.process_superresolution(image, params)
        else:
            return jsonify({'error': 'Invalid task'}), 400

        img_byte_arr = io.BytesIO()
        processed_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        return send_file(
            img_byte_arr,
            mimetype='image/png',
            as_attachment=False
        )

@app.route('/health', methods=['GET'])
def health_check():
    """Verifica se o servidor está funcionando"""
    return jsonify({'status': 'ok', 'message': 'Servidor funcionando!'})

@app.route('/models/info', methods=['GET'])
def models_info():
    """Retorna informações sobre os modelos disponíveis"""
    return jsonify({
        'outpainting': {
            'available': True,
            'description': 'Expande imagens além de suas bordas originais'
        },
        'inpainting': {
            'available': True,
            'description': 'Preenche áreas mascaradas da imagem'
        },
        'superresolution': {
            'available': True,
            'models': ['esrgan', 'realesrgan', 'swinir'],
            'description': 'Aumenta a resolução da imagem'
        }
    })

if __name__ == '__main__':
    print("Iniciando servidor Flask...")
    print("Servidor rodando em http://localhost:5000")
    get_processor()
    app.run(debug=False, host='0.0.0.0', port=5000)