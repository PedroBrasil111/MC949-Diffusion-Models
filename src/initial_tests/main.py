from argparse import ArgumentParser
import os
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

from helper_functions import (
    get_all_images, get_image_path,
    read_image, save_result, display_result,
    MODE_FOLDERS, IMAGE_FOLDER
)
from stable_diffusion import (
    DiffusionPipeline
)

BASE_FOLDER = os.path.join(os.path.dirname(__file__))
DIFF_PIPELINE = DiffusionPipeline()

def handle_args(args) -> None:
    if not args.images or args.images[0] == "all":
        args.images = get_all_images()
    else:
        missing = [img for img in args.images if not os.path.exists(get_image_path(img))]
        if missing:
            raise ValueError(f"Image(s) not found: {', '.join(missing)}")
    valid_modes = ["inpainting", "outpainting"]
    if not args.mode:
        args.mode = valid_modes
    else:
        invalid_modes = [m for m in args.mode if m not in valid_modes]
        if invalid_modes:
            raise ValueError(f"Invalid mode(s): {', '.join(invalid_modes)}. Use 'hough' and/or 'projection'.")
    if not (args.save or args.display):
        raise ValueError("No action specified. Use -s to save images and/or -d to display them.")

def readlines_ignore_comments(fp):
    lines = [l.strip() for l in fp.readlines() if not l.strip().startswith("#")]
    return lines

def build_masks(img_name: str, mask_names: list[str], mode: str, shape: tuple[int]) -> dict[str, Image.Image]:
    suffix = img_name[:img_name.find('.')]
    all_masks = {}
    for fn in mask_names:
        if not fn.startswith(suffix):
            continue
        with open(os.path.join(BASE_FOLDER, mode, "masks", fn)) as fp:
            lines = readlines_ignore_comments(fp)
        mask = np.zeros(shape)
        for coords in lines:
            x1, y1, x2, y2 = [int(c) for c in coords.strip().split()]
            mask[y1:y2, x1:x2] = 255
        all_masks[fn[:fn.find(".")]] = Image.fromarray(mask)
    return all_masks

def get_prompts(names: str, mode: str) -> dict[str, str]:
    all_prompts = {}
    for fn in names:
        with open(os.path.join(BASE_FOLDER, mode, "prompts", fn)) as fp:
            prompt = " ".join(readlines_ignore_comments(fp)) # prompt unica
        all_prompts[fn[:fn.find(".")]] = prompt
    return all_prompts

def handle_result(
        name: str,
        original: Image.Image,
        result: Image.Image,
        mask: str,
        prompt: str,
        mode: str,
        save: bool,
        display: bool
    ) -> bool:
    if save:
        save_result(name, result, mode)
        print("\033[92mResults saved\033[0m")
    if display:
        print("\033[93mDisplaying results. Press 'q' to exit.\033[0m")
        return display_result(original, result, mode, mask, prompt)
    return True

def main(args):
    for mode in args.mode:
        DIFF_PIPELINE.update(
            mode, args.model_name, args.strength, args.guidance_scale
        )
        mask_names = os.listdir(os.path.join(MODE_FOLDERS[mode], 'masks'))
        for img_name in args.images:
            img = read_image(os.path.join(IMAGE_FOLDER, img_name))
            if not img:
                continue
            mask_dict = build_masks(img_name, mask_names, mode, img.size[::-1])
            prompt_dict = get_prompts(mask_names, mode)
            if not mask_dict:
                print(f"\033[93mWarning: No masks found for image {img_name} with mode {mode}.\033[0m")
                continue
            for mask_name in mask_dict.keys():
                mask = mask_dict[mask_name]
                prompt = prompt_dict.get(mask_name, "remove")
                result = DIFF_PIPELINE.run_diffusion(
                    img, mask, prompt,
                )
                handle_result(
                    mask_name, img, result, mask, prompt,
                    mode, args.save, args.display,
                )

if __name__ == '__main__':
    while True:
        parser = ArgumentParser()
        parser.add_argument("-i", "--images", nargs='+', type=str)
        parser.add_argument("-m", "--mode", nargs='+', type=str)
        parser.add_argument("-s", "--save", action="store_true")
        parser.add_argument("-d", "--display", action="store_true")
        parser.add_argument("--strength", type=float, default=1.0)
        parser.add_argument("--guidance_scale", type=float, default=10.0)
        parser.add_argument("--model_name", type=str, default="")
        args = parser.parse_args(input(">> ").split())

        for mode in MODE_FOLDERS.keys():
            for folder in ["masks", "prompts", "results"]:
                os.makedirs(os.path.join(BASE_FOLDER, mode, folder), exist_ok=True)

        try:
            handle_args(args)
        except ValueError as e:
            print(f"\033[91mError: {e}\033[0m")
            continue

        main(args)
