import torch
import numpy as np
from PIL import Image
from diffusers import (
    StableDiffusionControlNetInpaintPipeline,
    ControlNetModel,
    UniPCMultistepScheduler,
)

class ControlNetDiffusionPipeline:
    def __init__(self):
        self.num_inference_steps = 20
        self.controlnet_conditioning_scale = 0.95

        self.inpainting_model_name = "runwayml/stable-diffusion-v1-5"
        self.controlnet_model_name = "lllyasviel/control_v11p_sd15_inpaint"

        self.pipe = None

        self._initialize_models()

    def _initialize_models(self):
        print("Loading ControlNet...")
        controlnet = ControlNetModel.from_pretrained(
            self.controlnet_model_name,
            torch_dtype=torch.float16,
        )

        print("Building ControlNet inpaint pipeline...")
        self.pipe = StableDiffusionControlNetInpaintPipeline.from_pretrained(
            self.inpainting_model_name,
            controlnet=controlnet,
            torch_dtype=torch.float16,
        )

        # Reduzir trabalho da gpu
        self.pipe.scheduler = UniPCMultistepScheduler.from_config(self.pipe.scheduler.config)
        self.pipe.enable_model_cpu_offload()
        print("Pipeline ready (ControlNet + inpaint).")

    def update(self, strength=1, guidance_scale=14, num_inference_steps=20, controlnet_conditioning_scale=None):
        self.strength = strength
        self.guidance_scale = guidance_scale
        self.num_inference_steps = num_inference_steps
        if controlnet_conditioning_scale is not None:
            self.controlnet_conditioning_scale = controlnet_conditioning_scale

    def _make_inpaint_condition(self, image, image_mask):
        image = np.array(image.convert("RGB")).astype(np.float32) / 255.0
        image_mask = np.array(image_mask.convert("L")).astype(np.float32) / 255.0

        assert image.shape[0:1] == image_mask.shape[0:1], "image and image_mask must have the same image size"
        image[image_mask > 0.5] = -1.0  # set as masked pixel
        image = np.expand_dims(image, 0).transpose(0, 3, 1, 2)
        image = torch.from_numpy(image)
        return image

    def _save_mask_image(self, image, mask):
        img_array = np.array(image)
        mask_array = np.array(mask)

        mask_bool = mask_array > 128

        masked_visualization = img_array.copy()

        red_overlay = np.array([255, 0, 0], dtype=np.uint8)

        alpha = 0.5
        for c in range(3):
            masked_visualization[..., c][mask_bool] = (
                alpha * red_overlay[c] + (1 - alpha) * img_array[..., c][mask_bool]
            )

        masked_viz_image = Image.fromarray(masked_visualization.astype(np.uint8))

        try:
            masked_viz_image.save("mask_visualization.png")
            print(f"\tSaved mask visualization to: mask_visualization.png")
        except Exception as e:
            print(f"\tError saving mask visualization: {e}")

    def _save_control_image(self, control_image):
        try:
            control_np = control_image.squeeze().permute(1, 2, 0).cpu().numpy()

            control_np = (control_np + 1.0) * 127.5
            control_np = np.clip(control_np, 0, 255).astype(np.uint8)

            control_pil = Image.fromarray(control_np)
            control_pil.save("control_image.png")
            print(f"\tSaved control image to: control_image.png")
        except Exception as e:
            print(f"\tError saving control image: {e}")

    def run_diffusion(self, image: Image.Image, mask: Image.Image, prompt: str, negative_prompt: str = "") -> Image.Image:
        print("Running diffusion model")

        print(f"\tPrompt: {prompt}")
        print(f"\tNegative prompt: {negative_prompt}")
        print(f"\tStrength: {self.strength}")
        print(f"\tGuidance scale: {self.guidance_scale}")
        print(f"\tSteps: {self.num_inference_steps}")

        target_w = image.width
        target_h = image.height

        target_w = ((target_w + 7) // 8) * 8
        target_h = ((target_h + 7) // 8) * 8

        # Reduzir custo computacional
        max_dim = 1024
        if target_w > max_dim:
            scale = max_dim / target_w
            target_w = max_dim
            target_h = int(target_h * scale)
            target_h = ((target_h + 7) // 8) * 8
        if target_h > max_dim:
            scale = max_dim / target_h
            target_h = max_dim
            target_w = int(target_w * scale)
            target_w = ((target_w + 7) // 8) * 8

        print(f"\tOriginal dimensions: {image.width}x{image.height}")
        print(f"\tTarget dimensions: {target_w}x{target_h}")

        # Garantir tipos e tamanhos
        resized_image = image.convert("RGB").resize((target_w, target_h), resample=Image.BICUBIC)
        resized_mask = mask.convert("L").resize((target_w, target_h), resample=Image.NEAREST)

        # -1 nos pontos de mascara
        control_image = self._make_inpaint_condition(resized_image, resized_mask)

        self._save_mask_image(resized_image, resized_mask)
        self._save_control_image(control_image)

        kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "image": resized_image,
            "mask_image": resized_mask,
            "control_image": control_image,
            "strength": float(self.strength),
            "guidance_scale": float(self.guidance_scale),
            "num_inference_steps": int(self.num_inference_steps),
            "controlnet_conditioning_scale": float(self.controlnet_conditioning_scale),
            "height": target_h,
            "width": target_w,
        }

        # geracap de animais e humanos
        kwargs["negative_prompt"] += """\
            ,skin spots,acnes,skin blemishes,age spot,ugly,duplicate,morbid,mutilated,\
            tranny,mutated hands,poorly drawn hands,blurry,bad anatomy,bad proportions,\
            extra limbs,disfigured,missing arms,extra legs,fused fingers,\
            too many fingers,unclear eyes,lowers,bad hands,missing fingers,extra digit,\
            bad hands,missing fingers,extra arms and legs,worst quality,low quality,\
            normal quality,lowres
        """

        result = self.pipe(**kwargs).images[0]

        print("Finished")
        return result