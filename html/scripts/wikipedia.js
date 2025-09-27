// WikiAPI: utilidades de Wikipedia/Wikimedia Commons para el cliente
// Uso: window.WikiAPI.searchArticles(...), searchFiles(...), pageMedia(...), fileInfo(...)
// Nota: Todas las llamadas usan origin=* para CORS y no requieren claves.

(function(){
  const WikiAPI = {};

  const q = (params)=> Object.entries(params)
    .filter(([,v])=> v!==undefined && v!==null && v!=='')
    .map(([k,v])=> `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const fetchJson = async (url)=>{
    const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  };

  // 1) Buscar artículos en Wikipedia
  WikiAPI.searchArticles = async (query, { lang='es', limit=5 }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'query', list:'search', srsearch:query, srlimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    return (data?.query?.search||[]).map(s=>({ title:s.title, snippet:s.snippet, pageid:s.pageid }));
  };

  // 2) Resumen de un artículo
  WikiAPI.pageSummary = async (title, { lang='es' }={})=>{
    const t = encodeURIComponent(title.replace(/\s/g,'_'));
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${t}`;
    return await fetchJson(url);
  };

  // 3) Buscar archivos (imágenes) en Commons por texto
  WikiAPI.searchFiles = async (query, { limit=6 }={})=>{
    const url = `https://commons.wikimedia.org/w/api.php?${q({
      action:'query', list:'search', srsearch:query, srnamespace:6, srlimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const titles = (data?.query?.search||[]).map(s=> s.title.startsWith('File:')? s.title : `File:${s.title}`);
    return Promise.all(titles.map(t=> WikiAPI.fileInfo(t)));
  };

  // 4) Info de un archivo (imagen) en Commons
  WikiAPI.fileInfo = async (fileTitle, { thumbWidth=640 }={})=>{
    const url = `https://commons.wikimedia.org/w/api.php?${q({
      action:'query', titles:fileTitle, prop:'imageinfo',
      iiprop:'url|mime|size|extmetadata', iiurlwidth:thumbWidth, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages||{};
    const first = Object.values(pages)[0];
    const ii = first?.imageinfo?.[0]||{};
    const meta = ii.extmetadata||{};
    return {
      title: fileTitle,
      url: ii.url,
      thumb: ii.thumburl || ii.url,
      width: ii.width, height: ii.height, mime: ii.mime,
      license: {
        name: meta.LicenseShortName?.value || meta.License?.value || '',
        url: meta.LicenseUrl?.value || ''
      },
      credit: meta.Credit?.value || '',
      artist: meta.Artist?.value || ''
    };
  };

  // 5) Medios usados por una página de Wikipedia (lista de File:... y sus URLs)
  WikiAPI.pageMedia = async (title, { lang='es', limit=6, thumbWidth=640 }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'query', prop:'images', titles:title, imlimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages||{};
    const first = Object.values(pages)[0];
    const images = (first?.images||[]).map(i=> i.title).filter(t=> /^File:/i.test(t));
    const detailed = await Promise.all(images.slice(0,limit).map(t=> WikiAPI.fileInfo(t, { thumbWidth })));
    return detailed;
  };

  // 6) Categorías de una página
  WikiAPI.categories = async (title, { lang='es', limit=20 }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'query', prop:'categories', titles:title, clshow:'!hidden', cllimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages||{};
    const first = Object.values(pages)[0];
    return (first?.categories||[]).map(c=> c.title.replace(/^Category:/,''));
  };

  // 7) Enlaces internos (ns=0) de una página
  WikiAPI.links = async (title, { lang='es', limit=20 }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'query', prop:'links', titles:title, plnamespace:0, pllimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages||{};
    const first = Object.values(pages)[0];
    return (first?.links||[]).map(l=> l.title);
  };

  // 8) Enlaces externos de una página
  WikiAPI.externalLinks = async (title, { lang='es', limit=20 }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'query', prop:'extlinks', titles:title, ellimit:limit, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages||{};
    const first = Object.values(pages)[0];
    return (first?.extlinks||[]).map(e=> e['*']).filter(Boolean);
  };

  // 9) Pageviews (últimos 30 días)
  WikiAPI.pageviews = async (title, { lang='es', days=30 }={})=>{
    const project = `${lang}.wikipedia`;
    const article = encodeURIComponent(title.replace(/\s/g,'_'));
    const end = new Date(); end.setDate(end.getDate()-1);
    const start = new Date(end); start.setDate(end.getDate()-days+1);
    const fmt = (d)=> `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}.org/all-access/user/${article}/daily/${fmt(start)}00/${fmt(end)}00`;
    try{
      const data = await fetchJson(url);
      const items = data?.items||[];
      const total = items.reduce((s,i)=> s + (i.views||0), 0);
      const avg = items.length ? total/items.length : 0;
      return { total, avg, days: items.length };
    }catch(_){ return { total:0, avg:0, days:0 }; }
  };

  // 10) Secciones
  WikiAPI.sections = async (title, { lang='es' }={})=>{
    const url = `https://${lang}.wikipedia.org/w/api.php?${q({
      action:'parse', page:title, prop:'sections', formatversion:2, format:'json', origin:'*'
    })}`;
    const data = await fetchJson(url);
    return (data?.parse?.sections||[]).map(s=> ({ index:s.index, line:s.line, level: s.level }));
  };

  // 11) Construir briefing básico con datos verificables
  WikiAPI.buildBriefing = async (query, { lang='es' }={})=>{
    const [first] = await WikiAPI.searchArticles(query, { lang, limit: 1 });
    if(!first) return null;
    const title = first.title;
    const [summary, media, cats, links, exts, pv, secs] = await Promise.all([
      WikiAPI.pageSummary(title,{lang}),
      WikiAPI.pageMedia(title,{lang, limit:3, thumbWidth:480}).catch(()=>[]),
      WikiAPI.categories(title,{lang, limit:12}).catch(()=>[]),
      WikiAPI.links(title,{lang, limit:12}).catch(()=>[]),
      WikiAPI.externalLinks(title,{lang, limit:10}).catch(()=>[]),
      WikiAPI.pageviews(title,{lang, days:30}).catch(()=>({})),
      WikiAPI.sections(title,{lang}).catch(()=>[])
    ]);
    return {
      query,
      title,
      url: summary?.content_urls?.desktop?.page || summary?.content_urls?.mobile?.page || '',
      thumbnail: summary?.thumbnail?.source || '',
      description: summary?.description || '',
      extract: summary?.extract || '',
      media,
      categories: cats,
      links,
      external: exts,
      pageviews: pv,
      sections: secs
    };
  };

  // Exponer en window
  window.WikiAPI = WikiAPI;
})();
