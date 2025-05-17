const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const exifParser = require("exif-parser");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ruta a la carpeta exportada desde Fotos de macOS
const FOLDER_PATH = "/Users/danielguzmansagredo/Downloads/Fotos/";

const esImagen = (archivo) => /\.(jpe?g|png|heic)$/i.test(archivo);

const extraerFechaDesdeExif = (buffer) => {
  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    const timestamp = result.tags.DateTimeOriginal;
    if (timestamp) {
      return new Date(timestamp * 1000).toISOString().split("T")[0];
    }
  } catch (error) {
    console.warn("⚠️ No se pudo leer EXIF:", error.message);
  }
  return "sin_fecha";
};

const subirFotos = async () => {
  const archivos = fs.readdirSync(FOLDER_PATH);
  const resultados = [];

  for (const archivo of archivos) {
    if (esImagen(archivo)) {
      const rutaImagen = path.join(FOLDER_PATH, archivo);
      const buffer = fs.readFileSync(rutaImagen);
      const fecha = extraerFechaDesdeExif(buffer);

      const publicId = `${fecha}_${path.parse(archivo).name}`;

      try {
        const res = await cloudinary.uploader.upload(rutaImagen, {
          folder: "galeria_iglesia",
          public_id: publicId,
          context: {
            fecha_toma: fecha,
          },
        });

        console.log("✅ Subida:", res.secure_url, "| Fecha:", fecha);

        resultados.push({
          url: res.secure_url,
          titulo: archivo,
          fecha_toma: fecha,
        });
      } catch (error) {
        console.error("❌ Error al subir", archivo, ":", error.message);
      }
    }
  }

  fs.writeFileSync("fotos_cloudinary.json", JSON.stringify(resultados, null, 2));
  console.log(`🎉 Subidas completadas: ${resultados.length} fotos`);
};

subirFotos();
