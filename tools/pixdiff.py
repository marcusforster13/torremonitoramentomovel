# Compara duas imagens PNG (via ffmpeg -> rgb cru) e diz a porcentagem de pixels com diferença > 8 níveis.
import subprocess, sys
def raw(p):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return out
a, b = raw(sys.argv[1]), raw(sys.argv[2])
n = min(len(a), len(b)) // 3
diff = sum(1 for i in range(0, n * 3, 3) if abs(a[i] - b[i]) + abs(a[i + 1] - b[i + 1]) + abs(a[i + 2] - b[i + 2]) > 24)
print(f"{sys.argv[1].split('/')[-1]}: {100 * diff / n:.3f}% diferentes")
