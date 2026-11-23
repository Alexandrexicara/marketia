import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

const imageTypes = new Set(['image/jpeg','image/png','image/webp','image/avif']);
const videoTypes = new Set(['video/mp4','video/webm','video/quicktime']);
const imageLimit = 15 * 1024 * 1024;
const videoLimit = 200 * 1024 * 1024;

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  return true;
}

export async function ensureMediaSchema(pool) {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_media (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
      object_key TEXT NOT NULL UNIQUE,
      file_name VARCHAR(180) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
      public_url TEXT NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_business_media_business ON business_media(business_id,created_at)');
}

export function registerMediaRoutes(app, { pool, auth, requireDatabase }) {
  app.get('/api/businesses/:id/media', requireDatabase, auth, async (req,res) => {
    try {
      const owned = await pool.query('SELECT id FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1',[req.params.id,req.userId]);
      if (!owned.rowCount) return res.status(404).json({error:'Empresa não encontrada.'});
      const result = await pool.query("SELECT id,media_type,file_name,mime_type,size_bytes,public_url,created_at FROM business_media WHERE business_id=$1 AND status='ready' ORDER BY created_at DESC",[req.params.id]);
      res.json({media:result.rows});
    } catch(e) { console.error('Media list:',e.message); res.status(500).json({error:'Não foi possível listar os arquivos.'}); }
  });

  app.post('/api/businesses/:id/media/upload-url', requireDatabase, auth, async (req,res) => {
    if (!configureCloudinary()) return res.status(503).json({error:'Cloudinary ainda não foi configurado no servidor.'});
    const { fileName, mimeType, sizeBytes } = req.body || {};
    const type = imageTypes.has(mimeType) ? 'image' : videoTypes.has(mimeType) ? 'video' : null;
    if (!type) return res.status(400).json({error:'Formato não permitido. Use JPG, PNG, WebP, AVIF, MP4, WebM ou MOV.'});
    const maxBytes = type === 'image' ? imageLimit : videoLimit;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxBytes) return res.status(400).json({error:type === 'image' ? 'Cada imagem pode ter até 15 MB.' : 'Cada vídeo pode ter até 200 MB.'});
    try {
      const owned = await pool.query('SELECT b.id,b.tenant_id FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1',[req.params.id,req.userId]);
      if (!owned.rowCount) return res.status(404).json({error:'Empresa não encontrada.'});
      const counts = await pool.query("SELECT COUNT(*) FILTER (WHERE media_type='image' AND status IN ('pending','ready'))::int AS images, COUNT(*) FILTER (WHERE media_type='video' AND status IN ('pending','ready'))::int AS videos FROM business_media WHERE business_id=$1",[req.params.id]);
      if (type === 'image' && counts.rows[0].images >= 10) return res.status(409).json({error:'Limite de 10 imagens por empresa atingido.'});
      if (type === 'video' && counts.rows[0].videos >= 2) return res.status(409).json({error:'Limite de 2 vídeos por empresa atingido.'});
      const id = randomUUID();
      const safeName = String(fileName || 'arquivo').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100) || 'arquivo';
      const folder = `marketia/${owned.rows[0].tenant_id}/${req.params.id}`;
      const publicId = `${randomUUID()}-${safeName.replace(/\.[^.]+$/,'').slice(0,80)}`;
      const timestamp = Math.floor(Date.now()/1000);
      const signatureParams = { folder, public_id: publicId, timestamp };
      const signature = cloudinary.utils.api_sign_request(signatureParams, process.env.CLOUDINARY_API_SECRET);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${type}/upload`;
      await pool.query("INSERT INTO business_media(id,tenant_id,business_id,media_type,object_key,file_name,mime_type,size_bytes,public_url,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')",[id,owned.rows[0].tenant_id,req.params.id,type,`${folder}/${publicId}`,safeName,mimeType,sizeBytes,'pending']);
      res.status(201).json({
        id, uploadUrl, method:'POST', resourceType:type, publicId, folder,
        fields:{api_key:process.env.CLOUDINARY_API_KEY,timestamp:String(timestamp),folder,public_id:publicId,signature}
      });
    } catch(e) { console.error('Media upload signature:',e.message); res.status(500).json({error:'Não foi possível preparar o envio.'}); }
  });

  app.post('/api/businesses/:id/media/:mediaId/complete', requireDatabase, auth, async (req,res) => {
    if (!configureCloudinary()) return res.status(503).json({error:'Cloudinary ainda não foi configurado no servidor.'});
    try {
      const pending = await pool.query("SELECT m.id,m.object_key,m.media_type,m.file_name,m.mime_type,m.size_bytes FROM business_media m JOIN businesses b ON b.id=m.business_id JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE m.id=$1 AND m.business_id=$2 AND tm.user_id=$3 AND m.status='pending' LIMIT 1",[req.params.mediaId,req.params.id,req.userId]);
      if (!pending.rowCount) return res.status(404).json({error:'Upload não encontrado.'});
      const row = pending.rows[0];
      const resourceType = row.media_type === 'video' ? 'video' : 'image';
      const asset = await cloudinary.api.resource(row.object_key,{resource_type:resourceType,type:'upload'});
      if (!asset?.secure_url || asset.public_id !== row.object_key) return res.status(400).json({error:'O arquivo não foi confirmado pelo Cloudinary.'});
      const result = await pool.query("UPDATE business_media SET status='ready',public_url=$2,size_bytes=$3 WHERE id=$1 RETURNING id,public_url,media_type,file_name,mime_type,size_bytes,created_at",[row.id,asset.secure_url,asset.bytes || row.size_bytes]);
      res.json({media:result.rows[0]});
    } catch(e) {
      if (e?.http_code === 404) return res.status(400).json({error:'O arquivo ainda não chegou ao Cloudinary. Tente concluir novamente.'});
      console.error('Media complete:',e.message); res.status(500).json({error:'Não foi possível concluir o envio.'});
    }
  });

  app.delete('/api/businesses/:id/media/:mediaId', requireDatabase, auth, async (req,res) => {
    if (!configureCloudinary()) return res.status(503).json({error:'Cloudinary ainda não foi configurado no servidor.'});
    try {
      const found = await pool.query('SELECT m.id,m.object_key,m.media_type FROM business_media m JOIN businesses b ON b.id=m.business_id JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE m.id=$1 AND m.business_id=$2 AND tm.user_id=$3',[req.params.mediaId,req.params.id,req.userId]);
      if (!found.rowCount) return res.status(404).json({error:'Arquivo não encontrado.'});
      const resourceType = found.rows[0].media_type === 'video' ? 'video' : 'image';
      await cloudinary.uploader.destroy(found.rows[0].object_key,{resource_type:resourceType,invalidate:true});
      await pool.query('DELETE FROM business_media WHERE id=$1',[req.params.mediaId]);
      res.json({ok:true});
    } catch(e) { console.error('Media delete:',e.message); res.status(500).json({error:'Não foi possível excluir o arquivo.'}); }
  });
}
