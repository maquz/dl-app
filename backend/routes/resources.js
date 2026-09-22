const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

async function getFilesRecursively(bucket, currentPath = "") {
  let allFiles = [];
  const { data, error } = await supabase.storage.from(bucket).list(currentPath);
  if (error || !data) return allFiles;

  // Run in parallel for subfolders to speed up fetching
  const promises = data.map(async (item) => {
    if (item.name === ".emptyFolderPlaceholder") return [];

    if (!item.id) {
      // It's a folder, recurse
      const subPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      return await getFilesRecursively(bucket, subPath);
    } else {
      // It's a file
      const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const topLevelFolder = currentPath ? currentPath.split('/')[0] : "General Resources";
      
      return [{
        id: item.id,
        name: item.name,
        path: filePath,
        url: publicUrlData.publicUrl,
        size: item.metadata?.size || 0,
        created_at: item.created_at,
        category: topLevelFolder
      }];
    }
  });

  const results = await Promise.all(promises);
  for (const res of results) {
    allFiles.push(...res);
  }

  return allFiles;
}

router.get("/", async (req, res) => {
  if (!supabase) {
    return res.json({ resources: [] });
  }
  
  try {
    const allResources = await getFilesRecursively("dl-resources");
    res.json({ resources: allResources });
  } catch (err) {
    console.error("Resources fetch error:", err);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

module.exports = router;
