const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

router.get("/", async (req, res) => {
  if (!supabase) {
    return res.json({ resources: [] });
  }
  
  try {
    const { data, error } = await supabase.storage.from("dl-resources").list();
    if (error) {
      console.error("Storage list error (bucket might not exist):", error.message);
      return res.json({ resources: [] });
    }
    if (!data) {
      return res.json({ resources: [] });
    }
    
    // Filter to real files
    const files = data.filter(f => f.name !== ".emptyFolderPlaceholder" && f.id);
    
    const resources = files.map(f => {
      const { data: publicUrlData } = supabase.storage.from("dl-resources").getPublicUrl(f.name);
      return {
        id: f.id,
        name: f.name,
        url: publicUrlData.publicUrl,
        size: f.metadata?.size || 0,
        created_at: f.created_at
      };
    });
    
    // Sort alphabetically
    resources.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ resources });
  } catch (err) {
    console.error("Resources fetch error:", err);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

module.exports = router;
