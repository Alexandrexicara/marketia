export function registerExtendedRoutes(app, { pool, auth, requireDatabase, slugify }) {
  const accessBusiness = async (businessId, userId) => pool.query(
    "SELECT b.id,b.tenant_id,b.name,b.slug,b.segment,b.description,b.city,b.state FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1",
    [businessId, userId]
  );

  app.patch('/api/businesses/:id/offerings/:offeringId', requireDatabase, auth, async (req, res) => {
    const allowed = ['name','description','price','image_url','status','kind'];
    const fields = Object.keys(req.body || {}).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo válido informado.' });
    if (req.body.kind && !['product','service'].includes(req.body.kind)) return res.status(400).json({ error: 'Tipo inválido.' });
    if (req.body.status && !['draft','published','archived'].includes(req.body.status)) return res.status(400).json({ error: 'Status inválido.' });
    const values = fields.map(k => k === 'price' && req.body[k] !== null && req.body[k] !== '' ? Number(req.body[k]) : (req.body[k] === '' ? null : req.body[k]));
    const setters = fields.map((k,i) => `${k}=$${i+1}`);
    values.push(req.params.offeringId,req.params.id,req.userId);
    try {
      const result = await pool.query(
        `UPDATE offerings o SET ${setters.join(',')} FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE o.id=$${fields.length+1} AND o.business_id=$${fields.length+2} AND b.id=o.business_id AND tm.user_id=$${fields.length+3} RETURNING o.*`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Produto ou serviço não encontrado.' });
      res.json({ offering: result.rows[0] });
    } catch (e) { console.error('Offering update:',e.message); res.status(500).json({ error: 'Não foi possível atualizar.' }); }
  });

  app.delete('/api/businesses/:id/offerings/:offeringId', requireDatabase, auth, async (req,res) => {
    try {
      const result = await pool.query(
        "DELETE FROM offerings o USING businesses b,tenant_memberships tm WHERE o.id=$1 AND o.business_id=$2 AND b.id=o.business_id AND tm.tenant_id=b.tenant_id AND tm.user_id=$3 RETURNING o.id",
        [req.params.offeringId,req.params.id,req.userId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Produto ou serviço não encontrado.' });
      res.json({ ok:true });
    } catch(e) { console.error('Offering delete:',e.message); res.status(500).json({ error:'Não foi possível excluir.' }); }
  });

  app.patch('/api/leads/:id', requireDatabase, auth, async (req,res) => {
    const allowed=['status','notes'];
    const fields=Object.keys(req.body||{}).filter(k=>allowed.includes(k));
    if(!fields.length) return res.status(400).json({error:'Nenhum campo válido.'});
    if(req.body.status && !['new','contacted','qualified','converted','lost'].includes(req.body.status)) return res.status(400).json({error:'Status inválido.'});
    const values=fields.map(k=>req.body[k]); const setters=fields.map((k,i)=>`${k}=$${i+1}`);
    values.push(req.params.id,req.userId);
    try {
      const result=await pool.query(`UPDATE leads l SET ${setters.join(',')},updated_at=NOW() FROM tenant_memberships tm WHERE l.id=$${fields.length+1} AND tm.tenant_id=l.tenant_id AND tm.user_id=$${fields.length+2} RETURNING l.*`,values);
      if(!result.rowCount) return res.status(404).json({error:'Lead não encontrado.'});
      res.json({lead:result.rows[0]});
    } catch(e){console.error('Lead update:',e.message);res.status(500).json({error:'Não foi possível atualizar o lead.'});}
  });

  app.get('/api/analytics/overview', requireDatabase, auth, async (req,res) => {
    try {
      const {rows}=await pool.query(
        `SELECT COUNT(DISTINCT b.id)::int AS businesses,
          (SELECT COUNT(*)::int FROM leads l JOIN tenant_memberships tm2 ON tm2.tenant_id=l.tenant_id WHERE tm2.user_id=$1) AS leads,
          (SELECT COUNT(*)::int FROM page_events e JOIN tenant_memberships tm3 ON tm3.tenant_id=e.tenant_id WHERE tm3.user_id=$1 AND e.event_type='page_view' AND e.created_at >= NOW()-INTERVAL '30 days') AS views_30d,
          (SELECT COUNT(*)::int FROM page_events e JOIN tenant_memberships tm4 ON tm4.tenant_id=e.tenant_id WHERE tm4.user_id=$1 AND e.event_type='lead_submit' AND e.created_at >= NOW()-INTERVAL '30 days') AS contacts_30d
          FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE tm.user_id=$1`,
        [req.userId]
      );
      const daily=await pool.query(`SELECT DATE(e.created_at) AS day,COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,COUNT(*) FILTER (WHERE event_type='lead_submit')::int AS contacts FROM page_events e JOIN tenant_memberships tm ON tm.tenant_id=e.tenant_id WHERE tm.user_id=$1 AND e.created_at >= NOW()-INTERVAL '14 days' GROUP BY DATE(e.created_at) ORDER BY day`,[req.userId]);
      res.json({overview:rows[0],daily:daily.rows});
    } catch(e){console.error('Analytics:',e.message);res.status(500).json({error:'Não foi possível carregar métricas.'});}
  });

  app.post('/api/public/business/:slug/events', requireDatabase, async (req,res) => {
    const eventType=req.body?.eventType;
    if(!['page_view','click_whatsapp','click_website'].includes(eventType)) return res.status(400).json({error:'Evento inválido.'});
    try {
      const result=await pool.query("SELECT id,tenant_id FROM businesses WHERE slug=$1 AND status='published' LIMIT 1",[req.params.slug]);
      if(!result.rowCount) return res.status(404).json({error:'Página não encontrada.'});
      await pool.query("INSERT INTO page_events(tenant_id,business_id,event_type,source) VALUES($1,$2,$3,$4)",[result.rows[0].tenant_id,result.rows[0].id,eventType,String(req.body?.source||'direct').slice(0,80)]);
      res.status(201).json({ok:true});
    } catch(e){console.error('Public event:',e.message);res.status(500).json({error:'Não foi possível registrar visita.'});}
  });

  app.get('/api/campaigns', requireDatabase, auth, async (req,res) => {
    try {
      const result=await pool.query("SELECT c.* FROM campaigns c JOIN tenant_memberships tm ON tm.tenant_id=c.tenant_id WHERE tm.user_id=$1 ORDER BY c.created_at DESC LIMIT 200",[req.userId]);
      res.json({campaigns:result.rows});
    } catch(e){console.error('Campaign list:',e.message);res.status(500).json({error:'Não foi possível listar campanhas.'});}
  });

  app.post('/api/campaigns', requireDatabase, auth, async (req,res) => {
    const {businessId,name,channel='organic',objective='awareness',budget=0}=req.body||{};
    if(!businessId||!name?.trim()) return res.status(400).json({error:'Escolha uma empresa e informe o nome da campanha.'});
    if(!['organic','google_ads','meta_ads'].includes(channel)) return res.status(400).json({error:'Canal inválido.'});
    if(Number(budget)<0 || !Number.isFinite(Number(budget))) return res.status(400).json({error:'Orçamento inválido.'});
    try {
      const access=await accessBusiness(businessId,req.userId);
      if(!access.rowCount) return res.status(404).json({error:'Empresa não encontrada.'});
      const result=await pool.query("INSERT INTO campaigns(tenant_id,business_id,name,channel,objective,budget,status) VALUES($1,$2,$3,$4,$5,$6,'draft') RETURNING *",[access.rows[0].tenant_id,businessId,name.trim(),channel,objective,Number(budget)]);
      res.status(201).json({campaign:result.rows[0],notice:'Campanha salva como rascunho. Nenhum anúncio foi publicado ou cobrado.'});
    } catch(e){console.error('Campaign create:',e.message);res.status(500).json({error:'Não foi possível criar campanha.'});}
  });

  app.patch('/api/campaigns/:id', requireDatabase, auth, async (req,res) => {
    const allowed=['name','objective','status','starts_at','ends_at'];
    const fields=Object.keys(req.body||{}).filter(k=>allowed.includes(k));
    if(!fields.length) return res.status(400).json({error:'Nenhum campo válido.'});
    if(req.body.status && !['draft','approved','paused','completed'].includes(req.body.status)) return res.status(400).json({error:'Status inválido. A ativação externa exige integração autorizada.'});
    const values=fields.map(k=>req.body[k]);const setters=fields.map((k,i)=>`${k}=$${i+1}`);values.push(req.params.id,req.userId);
    try{
      const result=await pool.query(`UPDATE campaigns c SET ${setters.join(',')},updated_at=NOW() FROM tenant_memberships tm WHERE c.id=$${fields.length+1} AND tm.tenant_id=c.tenant_id AND tm.user_id=$${fields.length+2} RETURNING c.*`,values);
      if(!result.rowCount)return res.status(404).json({error:'Campanha não encontrada.'});
      res.json({campaign:result.rows[0]});
    }catch(e){console.error('Campaign update:',e.message);res.status(500).json({error:'Não foi possível atualizar.'});}
  });

  app.get('/api/content/drafts', requireDatabase, auth, async (req,res) => {
    try{
      const result=await pool.query("SELECT d.* FROM marketing_drafts d JOIN tenant_memberships tm ON tm.tenant_id=d.tenant_id WHERE tm.user_id=$1 ORDER BY d.created_at DESC LIMIT 100",[req.userId]);
      res.json({drafts:result.rows});
    }catch(e){console.error('Draft list:',e.message);res.status(500).json({error:'Não foi possível listar conteúdos.'});}
  });

  app.post('/api/content/generate', requireDatabase, auth, async (req,res) => {
    const {businessId,topic,channel='instagram',objective='engagement',tone='friendly'}=req.body||{};
    if(!businessId||!topic?.trim())return res.status(400).json({error:'Escolha a empresa e informe o assunto.'});
    try{
      const access=await accessBusiness(businessId,req.userId);
      if(!access.rowCount)return res.status(404).json({error:'Empresa não encontrada.'});
      const b=access.rows[0],safeTopic=topic.trim().slice(0,160);
      const hooks={
        instagram:`✨ Você já conhece ${safeTopic}?`,
        facebook:`Uma novidade para quem procura ${safeTopic}!`,
        whatsapp:`Olá! Quero apresentar ${safeTopic} para você.`,
        linkedin:`Como ${safeTopic} pode fazer a diferença no seu negócio`,
        blog:`Tudo o que você precisa saber sobre ${safeTopic}`
      };
      const intro=tone==='formal'?`A ${b.name} apresenta uma solução pensada para atender você.`:tone==='direct'?'Se você procura qualidade e praticidade, vale conhecer.':'Tem novidade boa por aqui! Preparamos uma opção especial para quem busca qualidade e confiança.';
      const cta=objective==='sales'?'Fale com nossa equipe e solicite seu orçamento.':objective==='traffic'?'Acesse nossa página e conheça todos os detalhes.':'Compartilhe com alguém que também possa gostar!';
      const contentText=`${hooks[channel]||hooks.instagram}\n\n${intro}\n\n${safeTopic} faz parte do que a ${b.name} oferece em ${b.segment||'seu segmento'}. ${b.description||''}\n\n${cta}\n\n#${slugify(b.name).replace(/-/g,'')} #${slugify(safeTopic).replace(/-/g,'')} #NegóciosLocais`;
      const saved=await pool.query("INSERT INTO marketing_drafts(tenant_id,business_id,channel,objective,topic,tone,content) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[b.tenant_id,businessId,channel,objective,safeTopic,tone,contentText]);
      res.status(201).json({draft:saved.rows[0],generator:'template_engine',notice:'Rascunho criado com modelos de conteúdo. Para geração por IA generativa, falta configurar um provedor e sua chave.'});
    }catch(e){console.error('Content generate:',e.message);res.status(500).json({error:'Não foi possível criar o conteúdo.'});}
  });

  app.patch('/api/content/drafts/:id', requireDatabase, auth, async (req,res) => {
    const {status,content}=req.body||{};
    if(status&&!['draft','approved','archived'].includes(status))return res.status(400).json({error:'Status inválido.'});
    if(!status && typeof content!=='string')return res.status(400).json({error:'Informe conteúdo ou status.'});
    try{
      const result=await pool.query("UPDATE marketing_drafts d SET content=COALESCE($1,d.content),status=COALESCE($2,d.status),updated_at=NOW() FROM tenant_memberships tm WHERE d.id=$3 AND tm.tenant_id=d.tenant_id AND tm.user_id=$4 RETURNING d.*",[typeof content==='string'?content:null,status||null,req.params.id,req.userId]);
      if(!result.rowCount)return res.status(404).json({error:'Rascunho não encontrado.'});
      res.json({draft:result.rows[0]});
    }catch(e){console.error('Draft update:',e.message);res.status(500).json({error:'Não foi possível atualizar.'});}
  });

  app.get('/sitemap.xml', async (_req,res) => {
    if(!pool)return res.status(503).type('text/plain').send('Database unavailable');
    try{
      const result=await pool.query("SELECT slug,updated_at FROM businesses WHERE status='published' ORDER BY updated_at DESC");
      const origin=(process.env.PUBLIC_SITE_URL||'https://marketdigitalia.netlify.app').replace(/\/$/,'');
      const urls=result.rows.map(row=>`<url><loc>${origin}/empresa/${encodeURIComponent(row.slug)}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`).join('');
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url>${urls}</urlset>`);
    }catch(e){console.error('Sitemap:',e.message);res.status(500).type('text/plain').send('Sitemap unavailable');}
  });
  app.get('/robots.txt',(_req,res)=>{
    const origin=(process.env.PUBLIC_SITE_URL||'https://marketdigitalia.netlify.app').replace(/\/$/,'');
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${process.env.API_PUBLIC_URL||'https://marketia-54ra.onrender.com'}/sitemap.xml\n`);
  });
}
