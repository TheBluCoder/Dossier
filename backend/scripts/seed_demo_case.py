"""Manually (re-)seed the demo case: python -m scripts.seed_demo_case [--force]"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.services.seed import seed_demo_case  # noqa: E402


async def main() -> None:
    inserted = await seed_demo_case(force="--force" in sys.argv)
    print("Demo case inserted." if inserted else "Cases already exist — use --force to add another copy.")


if __name__ == "__main__":
    asyncio.run(main())
