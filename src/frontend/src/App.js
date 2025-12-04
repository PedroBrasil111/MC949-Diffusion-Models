// Estado da aplicação
let state = {
    activeTab: 'outpainting',
    uploadedImage: null,
    processedImage: null,
    isDrawing: false,
    drawMode: 'draw', // 'draw' ou 'erase'
    canvas: null,
    ctx: null,
    originalImageData: null,
    // New: Separate canvas for tracking user drawings only
    drawingCanvas: null,
    drawingCtx: null,
    lastX: 0,
    lastY: 0,
    // New: Store image dimensions for percentage calculations
    imageWidth: 0,
    imageHeight: 0
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupCanvas();
    updateRangeValues();
});

// Configurar event listeners
function setupEventListeners() {
    // Upload de imagem
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    
    // Botão de upload
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });

        // Botão para usar resultado como entrada
    document.getElementById('setAsInputBtn').addEventListener('click', setResultAsInput);
    
    // Botão processar
    document.getElementById('processBtn').addEventListener('click', processImage);
    
    // Botão download
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.getAttribute('data-tab'));
        });
    });
    
    // Ferramentas de máscara
    document.getElementById('drawBtn').addEventListener('click', () => setDrawMode('draw'));
    document.getElementById('eraseBtn').addEventListener('click', () => setDrawMode('erase'));
    document.getElementById('clearMaskBtn').addEventListener('click', clearMask);
    
    // Atualização de valores dos ranges
    const ranges = [
        { id: 'percentage', valueId: 'percentage-value' },
        { id: 'outpaint-guidance', valueId: 'outpaint-guidance-value' },
        { id: 'outpaint-steps', valueId: 'outpaint-steps-value' },
        { id: 'inpaint-guidance', valueId: 'inpaint-guidance-value' },
        { id: 'inpaint-steps', valueId: 'inpaint-steps-value' },
        { id: 'inpaint-strength', valueId: 'inpaint-strength-value' },
        { id: 'outpaint-strength', valueId: 'outpaint-strength-value' },
        { id: 'denoise', valueId: 'denoise-value' }
    ];
    
    ranges.forEach(range => {
        const element = document.getElementById(range.id);
        if (element) {
            element.addEventListener('input', function() {
                document.getElementById(range.valueId).textContent = 
                    range.id === 'percentage' ? this.value + '%' : this.value;
                
                // Update dimension info when percentage changes
                if (range.id === 'percentage' && state.imageWidth && state.imageHeight) {
                    updateDimensionInfo();
                }
            });
        }
    });
    
    // Direção do outpainting
    document.getElementById('direction').addEventListener('change', function() {
        if (state.imageWidth && state.imageHeight) {
            updateDimensionInfo();
        }
    });
}

// Configurar canvas para desenho de máscara
function setupCanvas() {
    const canvas = document.getElementById('maskCanvas');
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    
    // Create a separate canvas for tracking user drawings only
    state.drawingCanvas = document.createElement('canvas');
    state.drawingCtx = state.drawingCanvas.getContext('2d');
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Touch events para mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
}

// Atualizar valores iniciais dos ranges
function updateRangeValues() {
    document.getElementById('percentage-value').textContent = document.getElementById('percentage').value + '%';
    document.getElementById('outpaint-guidance-value').textContent = document.getElementById('outpaint-guidance').value;
    document.getElementById('outpaint-steps-value').textContent = document.getElementById('outpaint-steps').value;
    document.getElementById('inpaint-guidance-value').textContent = document.getElementById('inpaint-guidance').value;
    document.getElementById('inpaint-steps-value').textContent = document.getElementById('inpaint-steps').value;
    document.getElementById('inpaint-strength-value').textContent = document.getElementById('inpaint-strength').value;
    document.getElementById('outpaint-strength-value').textContent = document.getElementById('outpaint-strength').value;
    document.getElementById('denoise-value').textContent = document.getElementById('denoise').value;
}

// Trocar de aba
function switchTab(tab) {
    state.activeTab = tab;
    
    // Atualizar visual das abas
    document.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('data-tab') === tab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    // Mostrar/ocultar parâmetros
    document.getElementById('outpainting-params').classList.toggle('hidden', tab !== 'outpainting');
    document.getElementById('inpainting-params').classList.toggle('hidden', tab !== 'inpainting');
    document.getElementById('superres-params').classList.toggle('hidden', tab !== 'superresolution');
    
    // Mostrar/ocultar ferramentas de máscara
    const showMaskTools = tab === 'inpainting' && state.uploadedImage;
    document.getElementById('canvasTools').style.display = showMaskTools ? 'flex' : 'none';
    document.getElementById('maskHint').style.display = showMaskTools ? 'block' : 'none';
    
    // Mostrar canvas ou imagem
    if (state.uploadedImage) {
        if (tab === 'inpainting') {
            document.getElementById('maskCanvas').style.display = 'block';
            document.getElementById('originalImage').style.display = 'none';
            // Update the display to show current drawing state
            updateCanvasDisplay();
        } else {
            document.getElementById('maskCanvas').style.display = 'none';
            document.getElementById('originalImage').style.display = 'block';
        }
    }
}

// Upload de imagem
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        state.uploadedImage = event.target.result;
        displayOriginalImage();
        
        // Limpar resultado anterior
        state.processedImage = null;
        document.getElementById('resultImage').style.display = 'none';
        document.getElementById('resultPlaceholder').style.display = 'block';
        document.getElementById('downloadBtn').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Exibir imagem original
function displayOriginalImage() {
    const img = document.getElementById('originalImage');
    const canvas = document.getElementById('maskCanvas');
    const placeholder = document.querySelector('#originalImageContainer .placeholder');
    
    document.getElementById('setAsInputBtn').style.display = 'none';
    
    img.src = state.uploadedImage;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    
    // Configurar canvas com a imagem
    img.onload = function() {
        state.imageWidth = img.naturalWidth;
        state.imageHeight = img.naturalHeight;
        
        canvas.width = state.imageWidth;
        canvas.height = state.imageHeight;
        
        // Also setup the drawing canvas
        state.drawingCanvas.width = state.imageWidth;
        state.drawingCanvas.height = state.imageHeight;
        
        // Store the original image data
        state.ctx.drawImage(img, 0, 0);
        state.originalImageData = state.ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Clear the drawing canvas
        state.drawingCtx.clearRect(0, 0, state.drawingCanvas.width, state.drawingCanvas.height);
        
        // Update dimension info for outpainting
        updateDimensionInfo();
        
        // Mostrar canvas/ferramentas se estiver na aba de inpainting
        if (state.activeTab === 'inpainting') {
            canvas.style.display = 'block';
            img.style.display = 'none';
            document.getElementById('canvasTools').style.display = 'flex';
            document.getElementById('maskHint').style.display = 'block';
            updateCanvasDisplay();
        }
    };
}

// Update dimension info display for outpainting
function updateDimensionInfo() {
    if (!state.imageWidth || !state.imageHeight) return;
    
    const percentage = parseInt(document.getElementById('percentage').value);
    const direction = document.getElementById('direction').value;
    
    let infoText = '';
    
    switch(direction) {
        case 'left':
        case 'right':
            const widthPixels = Math.round(state.imageWidth * (percentage / 100));
            infoText = `${widthPixels}px (${percentage}% da largura)`;
            break;
            
        case 'top':
        case 'bottom':
            const heightPixels = Math.round(state.imageHeight * (percentage / 100));
            infoText = `${heightPixels}px (${percentage}% da altura)`;
            break;
            
        case 'horizontal':
            const horizontalPixels = Math.round(state.imageWidth * (percentage / 100));
            infoText = `${horizontalPixels}px em cada lado (${percentage}% da largura)`;
            break;
            
        case 'vertical':
            const verticalPixels = Math.round(state.imageHeight * (percentage / 100));
            infoText = `${verticalPixels}px em cada lado (${percentage}% da altura)`;
            break;
            
        case 'all':
            const allWidthPixels = Math.round(state.imageWidth * (percentage / 100));
            const allHeightPixels = Math.round(state.imageHeight * (percentage / 100));
            infoText = `${allWidthPixels}px (largura) × ${allHeightPixels}px (altura)`;
            break;

        default:
    }
    
    document.getElementById('dimension-info').textContent = infoText;
}

// Update the main canvas display (original image + red drawings)
function updateCanvasDisplay() {
    if (!state.originalImageData) return;
    
    // Clear and draw original image
    state.ctx.putImageData(state.originalImageData, 0, 0);
    
    // Draw the user's red markings on top
    state.ctx.drawImage(state.drawingCanvas, 0, 0);
}

// Funções de desenho
function startDrawing(e) {
    if (state.activeTab !== 'inpainting') return;
    state.isDrawing = true;
    
    const coords = getCanvasCoordinates(e);
    state.lastX = coords.x;
    state.lastY = coords.y;
    
    draw(e);
}

function stopDrawing() {
    state.isDrawing = false;
    state.drawingCtx.beginPath();
}

function draw(e) {
    if (!state.isDrawing || state.activeTab !== 'inpainting') return;

    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

    state.drawingCtx.lineWidth = 40;
    state.drawingCtx.lineCap = 'round';
    state.drawingCtx.lineJoin = 'round';

    if (state.drawMode === 'draw') {
        // Draw red strokes on the drawing canvas
        state.drawingCtx.globalCompositeOperation = 'source-over';
        state.drawingCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        state.drawingCtx.lineTo(x, y);
        state.drawingCtx.stroke();
    } else {
        // Erase mode - remove drawings from the drawing canvas
        state.drawingCtx.globalCompositeOperation = 'destination-out';
        state.drawingCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
        state.drawingCtx.lineTo(x, y);
        state.drawingCtx.stroke();
        state.drawingCtx.globalCompositeOperation = 'source-over';
    }

    // Update the main canvas display
    updateCanvasDisplay();
    
    // Continue the path
    state.drawingCtx.beginPath();
    state.drawingCtx.moveTo(x, y);
    state.lastX = x;
    state.lastY = y;
}

// Get canvas coordinates from mouse or touch event
function getCanvasCoordinates(e) {
    const rect = state.canvas.getBoundingClientRect();
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;
    
    let clientX, clientY;
    
    if (e.type.includes('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// Touch events para mobile
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    state.canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    state.canvas.dispatchEvent(mouseEvent);
}

// Definir modo de desenho
function setDrawMode(mode) {
    state.drawMode = mode;
    document.getElementById('drawBtn').classList.toggle('active', mode === 'draw');
    document.getElementById('eraseBtn').classList.toggle('active', mode === 'erase');
}

// Limpar máscara
function clearMask() {
    if (!state.uploadedImage) return;
    
    // Clear only the drawing canvas (user's red markings)
    state.drawingCtx.clearRect(0, 0, state.drawingCanvas.width, state.drawingCanvas.height);
    updateCanvasDisplay();
}

// Obter máscara do canvas
function getMaskFromCanvas() {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = state.drawingCanvas.width;
    tmpCanvas.height = state.drawingCanvas.height;
    const tmpCtx = tmpCanvas.getContext('2d');

    // Start with a completely black canvas (no mask)
    tmpCtx.fillStyle = 'black';
    tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);

    // Get the drawing data from our separate drawing canvas
    const drawingData = state.drawingCtx.getImageData(0, 0, state.drawingCanvas.width, state.drawingCanvas.height);
    const data = drawingData.data;

    // Convert any non-transparent pixels in the drawing to white mask pixels
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 10) { // If this pixel has user drawing
            const pixelIndex = i / 4;
            const x = pixelIndex % tmpCanvas.width;
            const y = Math.floor(pixelIndex / tmpCanvas.width);
            
            // Make this pixel white in the mask
            tmpCtx.fillStyle = 'white';
            tmpCtx.fillRect(x, y, 1, 1);
        }
    }

    return tmpCanvas.toDataURL('image/png');
}

// Calculate pixels for outpainting based on percentage and direction
function calculateOutpaintingPixels() {
    if (!state.imageWidth || !state.imageHeight) {
        return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    
    const percentage = parseInt(document.getElementById('percentage').value);
    const direction = document.getElementById('direction').value;
    
    const left = direction === 'left' || direction === 'horizontal' || direction === 'all' ? 
        Math.round(state.imageWidth * (percentage / 100)) : 0;
    
    const right = direction === 'right' || direction === 'horizontal' || direction === 'all' ? 
        Math.round(state.imageWidth * (percentage / 100)) : 0;
    
    const top = direction === 'top' || direction === 'vertical' || direction === 'all' ? 
        Math.round(state.imageHeight * (percentage / 100)) : 0;
    
    const bottom = direction === 'bottom' || direction === 'vertical' || direction === 'all' ? 
        Math.round(state.imageHeight * (percentage / 100)) : 0;
    
    return { left, right, top, bottom };
}

// Coletar parâmetros baseado na aba ativa
function getParams() {
    if (state.activeTab === 'outpainting') {
        const pixels = calculateOutpaintingPixels();
        return {
            direction: document.getElementById('direction').value,
            pixels: pixels,
            percentage: parseInt(document.getElementById('percentage').value),
            prompt: document.getElementById('outpaint-prompt').value,
            negative_prompt: document.getElementById('outpaint-negative-prompt').value,
            guidance_scale: parseFloat(document.getElementById('outpaint-guidance').value),
            num_inference_steps: parseInt(document.getElementById('outpaint-steps').value),
            strength: parseFloat(document.getElementById('outpaint-strength').value)
        };
    } else if (state.activeTab === 'inpainting') {
        return {
            prompt: document.getElementById('inpaint-prompt').value,
            negative_prompt: document.getElementById('inpaint-negative-prompt').value,
            guidance_scale: parseFloat(document.getElementById('inpaint-guidance').value),
            num_inference_steps: parseInt(document.getElementById('inpaint-steps').value),
            strength: parseFloat(document.getElementById('inpaint-strength').value)
        };
    } else if (state.activeTab === 'superresolution') {
        return {
            scale: parseInt(document.getElementById('scale').value),
            model: document.getElementById('model').value,
            denoise_strength: parseFloat(document.getElementById('denoise').value)
        };
    }
}

// Processar imagem
async function processImage() {
    if (!state.uploadedImage) {
        alert('Por favor, faça upload de uma imagem primeiro!');
        return;
    }
    
    // Validação adicional para outpainting
    if (state.activeTab === 'outpainting') {
        const percentage = parseInt(document.getElementById('percentage').value);
        if (percentage === 0) {
            alert('A porcentagem precisa ser maior que 0% para outpainting!');
            return;
        }
    }
    
    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = true;
    processBtn.innerHTML = `
        <div class="spinner"></div>
        Processando...
    `;
    
    try {
        const formData = new FormData();
        
        // Converte base64 para blob
        const imageBlob = await fetch(state.uploadedImage).then(r => r.blob());
        formData.append('image', imageBlob, 'image.png');
        formData.append('task', state.activeTab);
        
        // Adiciona máscara para inpainting
        if (state.activeTab === 'inpainting') {
            const maskData = getMaskFromCanvas();
            const maskBlob = await fetch(maskData).then(r => r.blob());
            formData.append('mask', maskBlob, 'mask.png');
        }
        
        // Adiciona parâmetros
        const params = getParams();
        formData.append('params', JSON.stringify(params));
        
        // Chamada para o backend
        const response = await fetch('http://localhost:5000/process', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Erro ao processar imagem');
        }
        
        const blob = await response.blob();
        const processedUrl = URL.createObjectURL(blob);
        
        // Exibir resultado
        state.processedImage = processedUrl;
        const resultImg = document.getElementById('resultImage');
        resultImg.src = processedUrl;
        resultImg.style.display = 'block';
        document.getElementById('resultPlaceholder').style.display = 'none';
        document.getElementById('downloadBtn').style.display = 'flex';
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao processar imagem: ' + error.message + '\n\nVerifique se o backend está rodando em http://localhost:5000');
    } finally {
        processBtn.disabled = false;
        processBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Processar Imagem
        `;
        document.getElementById('setAsInputBtn').style.display = 'flex';
    }
}

// Download da imagem processada
function downloadImage() {
    if (!state.processedImage) return;
    
    const link = document.createElement('a');
    link.href = state.processedImage;
    link.download = `processed_${state.activeTab}_${Date.now()}.png`;
    link.click();
}

// Usar imagem de resultado como nova entrada
function setResultAsInput() {
    if (!state.processedImage) {
        alert('Não há imagem processada para usar como entrada!');
        return;
    }
    
    // Definir a imagem processada como nova imagem carregada
    state.uploadedImage = state.processedImage;
    
    // Atualizar a exibição da imagem original
    displayOriginalImage();
    
    // Limpar o resultado atual (opcional)
    state.processedImage = null;
    document.getElementById('resultImage').style.display = 'none';
    document.getElementById('resultPlaceholder').style.display = 'block';
    document.getElementById('downloadBtn').style.display = 'none';
    document.getElementById('setAsInputBtn').style.display = 'none';
    
    // Mostrar mensagem de sucesso
    alert('Imagem de resultado definida como nova entrada! Você pode agora processá-la novamente.');
}