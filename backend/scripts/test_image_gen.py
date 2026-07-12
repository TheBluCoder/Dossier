"""Manually verify the Replicate + storage pipeline end to end:

    python -m scripts.test_image_gen "a weathered detective's badge, noir photo"

Prints the durable storage URL on success. Costs one Replicate generation
(~$0.003 with the default flux-schnell model).
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.services.images import generate_and_store_image  # noqa: E402


async def main() -> None:
    prompt = " ".join(sys.argv[1:]) or "a noir detective's badge on a wooden desk, moody lighting"
    print(f"Generating: {prompt!r}")
    url = await generate_and_store_image(prompt, folder="detective-k/test")
    print(f"Stored at: {url}")


if __name__ == "__main__":
    asyncio.run(main())
