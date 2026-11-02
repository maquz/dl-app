const fs = require("fs");
const path = require("path");
const { ZipArchive } = require(path.join(__dirname, "../backend/node_modules/archiver"));

function createZip(sourceDir, outPath, filter = null) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = new ZipArchive({
      zlib: { level: 9 }, // Best compression
    });

    output.on("close", () => {
      console.log(`[ZIP SUCCESS] Created ${outPath} (${archive.pointer()} total bytes)`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    function addDirRecursive(currentDir, relativeBase = "") {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const relPath = relativeBase ? `${relativeBase}/${item}` : item;
        const stat = fs.statSync(fullPath);

        if (filter && !filter(relPath, fullPath)) {
          continue;
        }

        if (stat.isDirectory()) {
          // Explicit directory entry with forward slash and 0755
          archive.append(null, {
            name: `${relPath}/`,
            mode: 0o755,
          });
          addDirRecursive(fullPath, relPath);
        } else {
          // Explicit file entry with forward slash and 0644
          archive.file(fullPath, {
            name: relPath,
            mode: 0o644,
          });
        }
      }
    }

    addDirRecursive(sourceDir);
    archive.finalize();
  });
}

async function main() {
  const cpanelDir = path.resolve(__dirname, "../cpanel_deployment");
  const fullZipPath = path.resolve(__dirname, "../dl-app-cpanel-full.zip");
  const resourcesZipPath = path.resolve(__dirname, "../dl-resources-only.zip");

  console.log("Generating quick code update ZIP (api + frontend assets, excludes heavy resources)...");
  const updateZipPath = path.resolve(__dirname, "../dl-app-update-only.zip");
  await createZip(cpanelDir, updateZipPath, (relPath) => {
    return !relPath.startsWith("resources") && !relPath.endsWith("database.sql");
  });

  console.log("Generating resources-only ZIP for quick upload...");
  await createZip(path.join(cpanelDir, "resources"), resourcesZipPath);

  console.log("Generating Linux-compatible full cPanel ZIP (POSIX forward slashes)...");
  await createZip(cpanelDir, fullZipPath);

  console.log("All ZIP packages generated successfully!");
}

main().catch((err) => {
  console.error("Error creating ZIP archives:", err);
  process.exit(1);
});
