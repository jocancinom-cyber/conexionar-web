// =====================================================================
// CONEXIONAR — GET /api/admin-add-clase
// =====================================================================
// Endpoint de mantención para agregar una clase nueva sin tocar Supabase
// a mano. Se llama con parámetros en la URL, ej:
//
// /api/admin-add-clase?title=Alineamiento+suave&type=alineamiento
//   &level=principiante&duration_minutes=30&instructor=Emma+Marin
//   &vimeo_id=123456789
//
// Parámetros:
//   title             (obligatorio)
//   type              alineamiento | harmonic | meditacion | pranayama (obligatorio)
//   level             principiante | intermedio | avanzado | todo_nivel (obligatorio)
//   duration_minutes  número de minutos (obligatorio)
//   instructor        nombre de la profesora (obligatorio)
//   vimeo_id          ID numérico del video en Vimeo (obligatorio)
//   description       texto libre (opcional)
//   is_sample         "true" si es la clase gratis de muestra (opcional)
//
// Crea la fila en "classes", la vincula al video en "class_videos", y le
// pide a Vimeo la miniatura del video para dejarla lista de una.
// =====================================================================
const { insertClass, insertClassVideo, updateClassThumbnail } = require("../lib/supabase-admin");

const SITE_URL = process.env.SITE_URL || "https://nuevo.conexionar.com";
const TIPOS_VALIDOS = ["alineamiento", "harmonic", "meditacion", "pranayama"];
const NIVELES_VALIDOS = ["principiante", "intermedio", "avanzado", "todo_nivel"];

module.exports = async (req, res) => {
  try {
    const q = req.query;
    const faltantes = ["title", "type", "level", "duration_minutes", "instructor", "vimeo_id"].filter((k) => !q[k]);
    if (faltantes.length) {
      return res.status(400).json({ error: `Faltan parámetros: ${faltantes.join(", ")}` });
    }
    if (!TIPOS_VALIDOS.includes(q.type)) {
      return res.status(400).json({ error: `type inválido. Usa: ${TIPOS_VALIDOS.join(", ")}` });
    }
    if (!NIVELES_VALIDOS.includes(q.level)) {
      return res.status(400).json({ error: `level inválido. Usa: ${NIVELES_VALIDOS.join(", ")}` });
    }

    const nuevaClase = await insertClass({
      title: q.title,
      description: q.description || null,
      type: q.type,
      level: q.level,
      duration_minutes: parseInt(q.duration_minutes, 10),
      instructor: q.instructor,
      is_sample: q.is_sample === "true",
      published: true,
    });

    await insertClassVideo(nuevaClase.id, q.vimeo_id);

    let thumbnail_url = null;
    try {
      const oembedRes = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${q.vimeo_id}`)}&width=640`,
        { headers: { Referer: SITE_URL, Origin: SITE_URL } }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.thumbnail_url) {
          await updateClassThumbnail(nuevaClase.id, oembed.thumbnail_url);
          thumbnail_url = oembed.thumbnail_url;
        }
      }
    } catch (e) {
      // Si falla la miniatura no bloqueamos la creación de la clase.
    }

    return res.status(200).json({ ok: true, class_id: nuevaClase.id, title: nuevaClase.title, thumbnail_url });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
