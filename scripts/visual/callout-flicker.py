"""Check a known white callout interior throughout a recorded hold.
Use a tight interior patch, away from text, selection and rounded edges.
Times are relative to the recording start; inspect the recording to select
the hold window. FFmpeg is required. This checks pixels, not source code.
"""
import argparse
import json
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("video")
parser.add_argument("--start", type=float, required=True)
parser.add_argument("--end", type=float, required=True)
parser.add_argument("--x", type=int, required=True)
parser.add_argument("--y", type=int, required=True)
parser.add_argument("--size", type=int, default=6)
parser.add_argument("--minimum", type=float, default=250)
args = parser.parse_args()
assert args.end > args.start and args.size > 0
filters = (
    f"setpts=PTS-STARTPTS,fps=60,trim=start={args.start}:end={args.end},"
    f"crop={args.size}:{args.size}:{args.x}:{args.y},format=rgb24"
)
pixels = subprocess.check_output(
    ["ffmpeg", "-v", "error", "-i", args.video, "-vf", filters,
     "-f", "rawvideo", "-"]
)
stride = args.size * args.size * 3
assert pixels and len(pixels) % stride == 0, "No complete frames in hold window"
brightness = [sum(pixels[i:i + stride]) / stride for i in range(0, len(pixels), stride)]
failures = [round(args.start + i / 60, 3) for i, value in enumerate(brightness)
            if value < args.minimum]
print(json.dumps({
    "result": "FAIL" if failures else "PASS",
    "frames": len(brightness),
    "minimumBrightness": round(min(brightness), 2),
    "threshold": args.minimum,
    "darkFrameTimes": failures,
}, indent=2))
raise SystemExit(1 if failures else 0)
