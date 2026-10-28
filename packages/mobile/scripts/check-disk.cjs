const { statfsSync } = require("node:fs");

const disk = statfsSync(process.cwd());
if (disk.bavail * disk.bsize < 15 * 1024 ** 3) {
  process.stderr.write(
    "SSD 여유 공간이 15GiB 미만이므로 설치/빌드를 중단함.\n",
  );
  process.exit(1);
}
