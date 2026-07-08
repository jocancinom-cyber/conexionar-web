// =====================================================================
// CONEXIONAR — GET /api/admin-sync-thumbnails
// =====================================================================
// Endpoint de mantención: recorre todas las clases, busca el video de
// Vimeo asociado a cada una (class_videos.vimeo_id) y le pide a Vimeo
// la miniatura oficial de ese video (a través de su API pública de
// oEmbed, que no requiere token). Esa miniatura se guarda en
// classes.thumbnail_url, así la biblioteca muestra el mismo fotograma
// que el video en vez de un cuadro vacío.
//
// Se puede volver a llamar cuando se agreguen clases nuevas — es seguro
// llamarlo varias veces, solo actualiza el thumbnail de cada clase.
// =====================================================================
const { getAllClassVideos, updateClassThumbnail } = require("../lib/supabase-admin");

module.exports = async (req, res) => {
  try {
    const videos = await getAllClassVideos();
    if (!videos.length) {
      return res.status(200).json({ ok: true, mensaje: "No hay videos en class_videos.", actualizadas: 0 });
    }

    const resultados = [];

    for (const v of videos) {
      try {
        const oembedRes = await fetch(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${v.vimeo_id}`)}&width=640`
        );
        if (!oembedRes.ok) {
          resultados.push({ class_id: v.class_id, vimeo_id: v.vimeo_id, ok: false, error: `oEmbed ${oembedRes.status}` });
          continue;
        }
        const oembed = await oembedRes.json();
        if (!oembed.thumbnail_url) {
          resultados.push({ class_id: v.class_id, vimeo_id: v.vimeo_id, ok: false, error: "sin thumbnail_url" });
          continue;
        }
        await updateClassThumbnail(v.class_id, oembed.thumbnail_url);
        resultados.push({ class_id: v.class_id, vimeo_id: v.vimeo_id, ok: true, thumbnail_url: oembed.thumbnail_url });
      } catch (err) {
        resultados.push({ class_id: v.class_id, vimeo_id: v.vimeo_id, ok: false, error: String(err) });
      }
    }

    const actualizadas = resultados.filter((r) => r.ok).length;
    return res.status(200).json({ ok: true, actualizadas, total: videos.length, detalle: resultados });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
