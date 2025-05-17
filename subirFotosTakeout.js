const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ruta local donde están las imágenes y JSONs
const FOLDER_PATH = "/Users/danielguzmansagredo/Downloads/Takeout/Google\u00A0Fotos/Templo Vida Nueva/";

const esImagen = (archivo) => /\.(jpe?g|png|heic)$/i.test(archivo);

const subirFotos = async () => {
  const archivos = fs.readdirSync(FOLDER_PATH);
  const resultados = [];

  for (const archivo of archivos) {
    if (esImagen(archivo)) {
      const rutaImagen = path.join(FOLDER_PATH, archivo);
      const jsonPath = path.join(FOLDER_PATH, `${archivo}.supplemental-metadata.json`);
      let fecha = "sin_fecha";
      let contextData = {};

      if (fs.existsSync(jsonPath)) {
        try {
          const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          fecha = jsonData.photoTakenTime?.formatted?.split("T")[0] || "sin_fecha";

          contextData = {
            fecha_toma: jsonData.photoTakenTime?.formatted || "",
            fecha_creacion: jsonData.creationTime?.formatted || "",
            latitud: `${jsonData.geoData?.latitude ?? ""}`,
            longitud: `${jsonData.geoData?.longitude ?? ""}`,
            altitud: `${jsonData.geoData?.altitude ?? ""}`,
            vistas_google: jsonData.imageViews || "0",
            foto_original_url: jsonData.url || "",
            subido_por: jsonData.googlePhotosOrigin?.driveDesktopUploader?.version || "",
          };
        } catch (err) {
          console.warn("⚠️ Error leyendo JSON:", jsonPath, err.message);
        }
      }

      const publicId = `${fecha}_${path.parse(archivo).name}`;

      try {
        const res = await cloudinary.uploader.upload(rutaImagen, {
          folder: "galeria_iglesia",
          public_id: publicId,
          context: contextData,
        });

        console.log("✅ Subida:", res.secure_url, "| Fecha:", contextData.fecha_toma);

        resultados.push({
          url: res.secure_url,
          titulo: archivo,
          ...contextData,
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
