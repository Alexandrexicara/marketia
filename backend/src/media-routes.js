import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const imageTypes = new Set(['image/jpeg','image/png','image/webp','image/avif']);
const videoTypes = new Set(['video/mp4','video/webm','video/quicktime']);
const imageLimit = 15 * 1024 * 1024;
const videoLimit = 200 * 1024 * 1024;

function storageClient() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
  });
}

export function registerMediaRoutes(app, { pool, auth, requireDatabase }) {
  app.get('/api/businesses/:id/media', requireDatabase, auth, async (req,res) => {
    try {
      const owned = await pool.query('SELECT id FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1',[req.params.id,req.userId]);
      if (!owned.rowCount) return res.status(404).json({error:'Empresa não encontrada.'});
      const result = await pool.query("SELECT id,media_type,file_name,mime_type,size_bytes,public_url,created_at FROM business_media WHERE business_id=$1 AND status='ready' ORDER BY created_at",[req.params.id]);
      res.json({media:result.rows});
    } catch(e) { console.error('Media list:',e.message); res.status(500).json({error:'Não foi possível listar os arquivos.'}); }
  });

  app.post('/api/businesses/:id/media/upload-url', requireDatabase, auth, async (req,res) => {
    const client = storageClient();
    if (!client || !process.env.R2_PUBLIC_URL) return res.status(503).json({error:'Armazenamento de mídia ainda não foi configurado.'});
    const { fileName, mimeType, sizeBytes } = req.body || {};
    const type = imageTypes.has(mimeType) ? 'image' : videoTypes.has(mimeType) ? 'video' : null;
    if (!type) return res.status(400).json({error:'Formato não permitido. Use JPG, PNG, WebP, AVIF, MP4, WebM ou MOV.'});
    const maxBytes = type === 'image' ? imageLimit : videoLimit;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxBytes) return res.status(400).json({error:type === 'image' ? 'Cada imagem pode ter até 15 MB.' : 'Cada vídeo pode ter até 200 MB.'});
    try {
      const owned = await pool.query('SELECT b.id,b.tenant_id,b.slug FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1',[req.params.id,req.userId]);
      if (!owned.rowCount) return res.status(404).json({error:'Empresa não encontrada.'});
      const counts = await pool.query("SELECT COUNT(*) FILTER (WHERE media_type='image' AND status IN ('pending','ready'))::int AS images, COUNT(*) FILTER (WHERE media_type='video' AND status IN ('pending','ready'))::int AS videos FROM business_media WHERE business_id=$1",[req.params.id]);
      if (type === 'image' && counts.rows[0].images >= 10) return res.status(409).json({error:'Limite de 10 imagens por empresa atingido.'});
      if (type === 'video' && counts.rows[0].videos >= 2) return res.status(409).json({error:'Limite de 2 vídeos por empresa atingido.'});
      const id = randomUUID();
      const safeName = String(fileName || 'arquivo').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100) || 'arquivo';
      const key = `businesses/${owned.rows[0].tenant_id}/${req.params.id}/${id}-${safeName}`;
      const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/,'')}/${key.split('/').map(encodeURIComponent).join('/')}`;
      await pool.query("INSERT INTO business_media(id,tenant_id,business_id,media_type,object_key,file_name,mime_type,size_bytes,public_url,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')",[id,owned.rows[0].tenant_id,req.params.id,type,key,safeName,mimeType,sizeBytes,publicUrl]);
      const uploadUrl = await getSignedUrl(client,new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,ContentType:mimeType,ContentLength:sizeBytes}),{expiresIn:600});
      res.status(201).json({id,uploadUrl,publicUrl,method:'PUT',headers:{'Content-Type':mimeType},expiresIn:600});
    } catch(e) { console.error('Media upload URL:',e.message); res.status(500).json({error:'Não foi possível preparar o envio.'}); }
  });

  app.post('/api/businesses/:id/media/:mediaId/complete', requireDatabase, auth, async (req,res) => {
    try {
      const result = await pool.query("UPDATE business_media m SET status='ready' FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE m.id=$1 AND m.business_id=$2 AND b.id=m.business_id AND tm.user_id=$3 AND m.status='pending' RETURNING m.id,m.public_url,m.media_type,m.file_name,m.mime_type,m.size_bytes",[req.params.mediaId,req.params.id,req.userId]);
      if (!result.rowCount) return res.status(404).json({error:'Upload não encontrado.'});
      res.json({media:result.rows[0]});
    } catch(e) { console.error('Media complete:',e.message); res.status(500).json({error:'Não foi possível concluir o envio.'}); }
  });

  app.delete('/api/businesses/:id/media/:mediaId', requireDatabase, auth, async (req,res) => {
    const client = storageClient();
    if (!client) return res.status(503).json({error:'Armazenamento de mídia ainda não foi configurado.'});
    try {
      const found = await pool.query('SELECT m.id,m.object_key FROM business_media m JOIN businesses b ON b.id=m.business_id JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE m.id=$1 AND m.business_id=$2 AND tm.user_id=$3',[req.params.mediaId,req.params.id,req.userId]);
      if (!found.rowCount) return res.status(404).json({error:'Arquivo não encontrado.'});
      await client.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:found.rows[0].object_key}));
      await pool.query('DELETE FROM business_media WHERE id=$1',[req.params.mediaId]);
      res.json({ok:true});
    } catch(e) { console.error('Media delete:',e.message); res.status(500).json({error:'Não foi possível excluir o arquivo.'}); }
  });
}
