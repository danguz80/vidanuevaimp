const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const borrar = async () => {
  try {
    let nextCursor = null;
    let totalBorrados = 0;

    do {
      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: "galeria_iglesia/",
        max_results: 100,
        next_cursor: nextCursor,
      });

      const recursos = result.resources;

      for (const recurso of recursos) {
        await cloudinary.uploader.destroy(recurso.public_id);
        console.log("🗑️ Eliminado:", recurso.public_id);
        totalBorrados++;
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    console.log(`✅ Eliminación completa: ${totalBorrados} imágenes borradas.`);
  } catch (err) {
    console.error("❌ Error al eliminar:", err.message);
  }
};

borrar();
