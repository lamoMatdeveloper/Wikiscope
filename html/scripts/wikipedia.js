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

  // Exponer en window
  window.WikiAPI = WikiAPI;
})();

