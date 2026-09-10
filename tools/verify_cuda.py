from __future__ import annotations

import json
import platform
import subprocess
import sys


def main() -> int:
    result = {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "torch_importable": False,
        "torch_version": None,
        "torch_cuda": None,
        "cuda_available": False,
        "device_count": 0,
        "device_name": None,
        "tensor_smoke_test": False,
        "nvidia_smi": None,
    }
    try:
        import torch

        result["torch_importable"] = True
        result["torch_version"] = torch.__version__
        result["torch_cuda"] = torch.version.cuda
        result["cuda_available"] = bool(torch.cuda.is_available())
        if result["cuda_available"]:
            result["device_count"] = torch.cuda.device_count()
            result["device_name"] = torch.cuda.get_device_name(0)
            tensor = torch.rand((1024, 1024), device="cuda")
            result["tensor_mean"] = float(tensor.mean().cpu())
            result["tensor_smoke_test"] = True
    except Exception as exc:
        result["error"] = repr(exc)

    try:
        smi = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,driver_version",
                "--format=csv,noheader",
            ],
            text=True,
            capture_output=True,
            check=False,
            timeout=10,
        )
        result["nvidia_smi"] = smi.stdout.strip() if smi.returncode == 0 else smi.stderr.strip()
    except Exception as exc:
        result["nvidia_smi_error"] = repr(exc)

    print(json.dumps(result, indent=2))
    return 0 if result["cuda_available"] and result["tensor_smoke_test"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
