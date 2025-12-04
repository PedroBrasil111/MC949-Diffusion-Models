import os
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

IMAGE_FOLDER  = os.path.join(os.path.dirname(__file__), os.path.pardir, 'img')
MODE_FOLDERS = {
    'inpainting': os.path.join(os.path.dirname(__file__), 'inpainting'),
    'outpainting': os.path.join(os.path.dirname(__file__), 'outpainting')
}

def get_image_path(image_name: str) -> str:
    return os.path.join(IMAGE_FOLDER, image_name)

def get_all_images() -> list[str]:
    images = []
    for filename in os.listdir(IMAGE_FOLDER):
        if filename.endswith(".png") or filename.endswith(".jpg"):
            images.append(filename)
    return images

def save_result(name: str, img: Image.Image, mode: str) -> None:
    result_folder = os.path.join(MODE_FOLDERS[mode], "results")
    os.makedirs(result_folder, exist_ok=True)
    filename = f"{name}.png"
    print(f"\033[93mWriting image {name} to {result_folder}.\033[0m")
    img.save(os.path.join(result_folder, filename), format="PNG")

import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

def display_result(
        original: Image.Image,
        result: Image.Image,
        mode: str,
        mask: Image.Image,
        prompt: str
    ) -> bool:

    original_np = np.array(original.resize((512,512)))
    mask_np = np.array(mask.resize((512,512)))

    if mask_np.ndim == 2:
        mask_rgb = np.stack([mask_np]*3, axis=-1)
    else:
        mask_rgb = mask_np

    masked_img = np.where(mask_rgb == 255, [255, 0, 0], original_np)

    fig, axes = plt.subplots(1, 3, figsize=(16, 6))
    fig.suptitle(f"{mode.capitalize()} - Prompt: {prompt}", fontsize=14)

    axes[0].imshow(original_np)
    axes[0].set_title("Original")
    axes[0].axis("off")

    axes[1].imshow(masked_img)
    axes[1].set_title("With Mask")
    axes[1].axis("off")

    axes[2].imshow(result)
    axes[2].set_title("Result")
    axes[2].axis("off")

    plt.tight_layout()
    plt.show()

    return True


def read_image(path: str) -> Image.Image:
    try:
        img = Image.open(path).convert("RGB")
        return img
    except Exception as e:
        print(e)
        return None
