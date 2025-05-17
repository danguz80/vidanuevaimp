const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: "dxop18il1",
  api_key: "322427137445584",
  api_secret: "BNqGcmSMmUV8Op1hhHCtWdrh3Ww",
});

const procesar = async () => {
  let nextCursor = null;
  const maxResults = 100;

  do {
    try {
      const result = await cloudinary.search
        .expression("folder:galeria_iglesia")
        .with_field("context")
        .max_results(maxResults)
        .next_cursor(nextCursor)
        .execute();

      for (const r of result.resources) {
        const publicId = r.public_id;
        let anio = r.context?.custom?.fecha_toma?.substring(0, 4);

        if (!anio) {
          const match = publicId.match(/\/(\d{4})[-_]/);
          if (match) {
            anio = match[1];
          }
        }

        if (anio) {
          console.log(`✅ ${publicId} → Tag: ${anio}`);
          await cloudinary.uploader.add_tag(anio, publicId);
        } else {
          console.log(`⚠️  ${publicId} sin año detectable`);
        }
      }

      nextCursor = result.next_cursor;
    } catch (err) {
      console.error("❌ Error:", err.message);
      break;
    }
  } while (nextCursor);
};

procesar();
