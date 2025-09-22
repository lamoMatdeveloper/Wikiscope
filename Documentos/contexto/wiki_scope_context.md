# WikiScope — context.md

> **Tagline**: *AI‑powered personalized exploration and summarization of Wikipedia, with verifiable citations and a navigable knowledge graph.*

---

## 1) Resumen del reto
Wikipedia es una mina de conocimiento, pero encontrar rápidamente lo **relevante para una persona concreta** es difícil. **WikiScope** propone un dashboard que:
- Busca, filtra y **resume artículos** con **citas exactas** a secciones/párrafos.
- Construye un **grafo navegable** (tópicos ↔ artículos ↔ categorías ↔ referencias).
- Aprende del **perfil de usuario** para priorizar lo relevante (personalización transparente y editable).

**Objetivo de hackathon (MVP 48–72h)**: un flujo E2E que dado un tema y un perfil breve de intereses, entregue **un briefing verificable** (TL;DR, bullets, términos clave, timeline, pros/cons, open questions) con **links** y **mapa** de artículos relacionados.

---

## 2) Alcance (v1)
**Incluye**
- Búsqueda (keyword + sugerencias).
- Resumen automático con **citas alineadas** a oraciones del artículo.
- Grafo local de vínculos (links salientes/entrantes + categorías) por tema.
- **Personalización ligera**: pesos por tópicos y nivel (introductorio ↔ avanzado).
- Guardado de **colecciones** (briefings) y **notas** del usuario.

**Excluye (v1)**
- Edición en Wikipedia.
- Idiomas múltiples simultáneos (empezar con **en** y **es** con conmutador simple).
- Modelos pesados de entrenamiento propio (usar APIs/embeddings listos).

---

## 3) Usuarios objetivo (JTBD)
1. **Estudiante curioso**: “Dame un TL;DR confiable y llévame por el mapa del tema”.
2. **Investigador junior**: “Quiero panorama + puerta a papers (a través de referencias)”.
3. **Profes/creators**: “Necesito una guía verificable y citada para preparar material”.

**Métricas de éxito**
- T1: ≤ **8 s** a primer TL;DR con ≥ 3 citas.
- T2: ≥ **70%** clics en al menos 1 cita/expansión del grafo.
- T3: **>4/5** en encuesta de utilidad/claridad del briefing.

---

## 4) Datos y APIs
**Fuente principal**: **MediaWiki API** (Wikipedia). Rutas útiles:
- **REST Summary**: `/api/rest_v1/page/summary/{title}` → extracto + thumbnail.
- **Action API Search**: `/w/api.php?action=query&list=search&srsearch=...&format=json`.
- **Page Content (parse)**: `/w/api.php?action=parse&page={title}&prop=text|sections&formatversion=2`.
- **Links & Categories**: `prop=links|linkshere|categories`.
- **Backlinks**: `list=backlinks`.
- **Pageviews (opcional)**: `wikimedia.org/api/rest_v1/metrics/pageviews/...`.

**Buenas prácticas**
- Respetar **rate limits** y añadir **User-Agent** identificable.
- **Cache** por título+revId (invalidar cuando cambie revId).
- Respetar licencia **CC BY-SA 4.0** y **atribución** explícita.

---

## 5) Arquitectura (propuesta)
**Frontend**: Next.js/React + Tailwind. Componentes clave: SearchBar, TLDRCard, EvidenceBlock, GraphView, PersonaTuner, NoteDrawer, Collections.

**Backend**: FastAPI (o Node/Express). Módulos:
- *Fetcher*: wrappers de MediaWiki (con cache Redis).
- *Chunker*: segmenta HTML → Markdown → oraciones/fragmentos ~512–1k tokens.
- *Embedder*: embeddings (ej. `text-embedding-3-large` o alternativo local) → **Vector DB** (pgvector/FAISS).
- *Retriever*: BM25 + vector + **reranker** (ej. `bge-reranker`) para precisión.
- *Summarizer*: LLM con **citability** (ver §8) → TL;DR + bullets + citas ancladas.
- *Graph Builder*: extrae links/categorías y produce JSON del grafo.
- *Personalizer*: perfiles por tópicos (weights) + feedback loop (pin/boost/mute).

**Infra**
- DB: Postgres (+pgvector) para perfiles, colecciones, logs.
- Cache: Redis.
- Observabilidad: logs estructurados + trazas (OpenTelemetry) + métricas latencia.

---

## 6) Esquema de datos (simplificado)
```mermaid
erDiagram
  USER ||--o{ SESSION : has
  USER ||--o{ PROFILE_TOPIC : tunes
  USER ||--o{ COLLECTION : saves
  COLLECTION ||--o{ NOTE : contains
  ARTICLE ||--o{ CHUNK : includes
  ARTICLE ||--o{ EDGE : links

  USER{ id uuid, email text }
  SESSION{ id uuid, user_id uuid, query text, created_at timestamptz }
  PROFILE_TOPIC{ user_id uuid, topic text, weight float }
  ARTICLE{ id uuid, title text, lang text, rev_id int, url text }
  CHUNK{ id uuid, article_id uuid, idx int, text text, embedding vector }
  EDGE{ id uuid, src_article uuid, dst_title text, kind text }
  COLLECTION{ id uuid, user_id uuid, name text }
  NOTE{ id uuid, collection_id uuid, article_id uuid, body text, quote text }
```

---

## 7) UX: vistas & flujo
**A. Home**
- SearchBar (con sugerencias)
- PersonaTuner (chips: *Intro*, *Avanzado*, *Historia*, *Aplicaciones*, *Datos*)
- Trending (por pageviews, opcional)

**B. Resultados**
- Lista de artículos con *relevance score*, badges (longitud, fecha, popularidad)

**C. Briefing (Artículo)**
- **TL;DR** (5–8 bullets) con **[1][2][3]** y hover → cita exacta.
- Secciones: *Conceptos*, *Línea de tiempo*, *Pros/Contras*, *Controversias*, *Preguntas Abiertas*, *Más allá de Wikipedia* (refs → external links).
- **EvidenceBlock**: tabla cita ↔ URL/ancora/section.
- **GraphView**: mini-mapa navegable (depth 1–2).
- **Acciones**: *Guardar en colección*, *Añadir nota*, *Exportar* (Markdown/JSON).

**D. Colecciones**
- Boards con tarjetas (título, highlights, progreso leído).

**E. Panel de ajustes**
- Idioma (en/es), tono del TL;DR (académico ↔ divulgación), longitud, preferencia de formato.

**Animación/feedback**
- Skeletons rápidos, chips interactivos, toasts con tiempo y nº de citas encontradas.

---

## 8) Diseño de IA (retrieval → reasoning → report)
**Pipeline**
1) **Search**: query → top N títulos (Action API) + expand por redirects.
2) **Fetch**: summary + parse HTML → Markdown → **chunking** por secciones.
3) **Index**: embeddings a vector DB; guardar metadatos (section, offset, revId).
4) **Retrieve**: BM25 ∪ vector; **rerank** (cross-encoder) top K.
5) **Grounded Summarization** (con citabilidad):
   - Instruir al LLM: *solo puedes afirmar lo que está en los pasajes; cada bullet debe tener ≥1 cita.*
   - Formato de salida con etiquetas `[CIT:x]` mapeadas a `source.url#section`.
6) **Personalize**: reordenar bullets/secciones según perfil (weights) **sin** ocultar info.
7) **Critic Reinforcement** (opcional): segundo pase corto para chequear contradicciones.

**Prompt plantilla (resumen con citas)**
```
Tarea: Escribe un briefing fiel y verificable sobre "{topic}".
Usa EXCLUSIVAMENTE los pasajes proporcionados (con campos: text, url, section, revId).
Requisitos:
- 5–8 bullets, tono {tone}, longitud {len}.
- Tras cada afirmación añade [CIT:i] referenciando el pasaje i que la respalda.
- No inventes. Si falta evidencia, marca "[evidencia insuficiente]".
Salida JSON:
{
  "tldr": [ {"text": "...", "cites": [i,j]}, ... ],
  "terms": ["..."],
  "timeline": [ {"when": "YYYY", "what": "...", "cites": [k]} ],
  "open_questions": ["?", ...]
}
```

**Razonamiento verificado**
- Chequeo automático: cada `tldr[i]` debe tener ≥1 `cite` y URL válida que contenga el texto.
- Métrica de **factualidad**: % de oraciones con soporte exacto (string match ± fuzz 0.9).

---

## 9) Personalización
- **Perfil explícito**: slider por tópicos (ej. *Historia*, *Aplicaciones*, *Datos*, *Biografías*).
- **Feedback**: *boost/pin/mute* en artículos/tópicos; se guardan como `PROFILE_TOPIC.weight`.
- **Transparencia**: barra lateral muestra por qué se priorizó cada punto (regla simple: score = relevance × weight × recency).

---

## 10) Evaluación & métricas
- **Latencia**: p50/p95 por etapa (search, fetch, embed, summarize).
- **Cobertura**: nº de citas únicas por briefing.
- **Factualidad**: pass-rate del verificador (≥ 0.85 ideal para p95).
- **Engagement**: CTR en citas y nodos del grafo.
- **Retención**: nº colecciones creadas/usuario.

Tests automáticos (smoke):
- Títulos con paréntesis/diacríticos.
- Artículos muy largos vs. stub.
- RevId cambia → invalidar cache.

---

## 11) Ética y legal
- Atribución y **licencia CC BY-SA 4.0** claramente visibles en cada briefing.
- Enlace al **historial de ediciones** del artículo (transparencia de versión).
- **No ocultar** info por personalización: sólo reordenar.
- Disclaimers de **sesgos** (sistémicos y de cobertura).
- Respeto a `robots.txt` y límites de uso.

---

## 12) Roadmap (14 días sugeridos)
**Día 1–2**: setup, wrappers API, cache, parse + chunking, UI básica de búsqueda.

**Día 3–5**: embeddings + vector DB, retrieval híbrido, primer TL;DR con citas.

**Día 6–8**: GraphView (depth 1), colecciones, notas, export (Markdown).

**Día 9–10**: personalización ligera, verificador de citas, métricas básicas.

**Día 11–12**: multilenguaje (en/es), panel de ajustes, pageviews ranking.

**Día 13–14**: polish, accesibilidad, demos, script de carga de temas ejemplo.

---

## 13) Riesgos & mitigaciones
- **HTML complejo** → parsing inconsistente → usar `mwparserfromhell` / `readability` / HTML→Markdown robusto; tests por plantillas.
- **Latency** en artículos largos → paginar secciones y resumir incrementalmente.
- **Hallucinations** → plantillas estrictas + verificador + mostrar *evidencia insuficiente*.
- **Rate limits** → cache agresivo por revId + backoff exponencial.

---

## 14) API: ejemplos
**Search**
```
GET https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=Quantum%20computing&format=json
```

**Summary**
```
GET https://en.wikipedia.org/api/rest_v1/page/summary/Quantum_computing
```

**Parse (HTML + sections)**
```
GET https://en.wikipedia.org/w/api.php?action=parse&page=Quantum_computing&prop=text|sections&formatversion=2&format=json
```

---

## 15) Export & formato de salida (MVP)
```json
{
  "topic": "Quantum computing",
  "lang": "en",
  "generated_at": "2025-09-21T20:00:00Z",
  "tldr": [
    {"text": "QC uses quantum bits (qubits) to...", "cites": [1,3]},
    {"text": "Key models include...", "cites": [2]}
  ],
  "terms": ["qubit", "superposition", "entanglement"],
  "timeline": [ {"when": "1980s", "what": "Deutsch model", "cites": [5]} ],
  "evidence": [
    {"id": 1, "url": "https://en.wikipedia.org/wiki/Quantum_computing#Overview", "quote": "..."}
  ],
  "graph": { "nodes": [...], "edges": [...] }
}
```

---

## 16) Stack sugerido
- **FE**: Next.js, Tailwind, d3-force (GraphView), Zustand.
- **BE**: FastAPI/uvicorn o Node/Express.
- **Embeddings**: `text-embedding-3-large` / `nomic-embed-text` (alternativas open).
- **Rerank**: `bge-reranker-base` (onnx) para coste/latencia.
- **Vector DB**: pgvector (Postgres) o FAISS local.
- **Cache**: Redis.

---

## 17) Glosario
- **Chunk**: fragmento de texto indexado con metadatos.
- **Reranker**: modelo que ordena pasajes más relevantes post-retrieval.
- **Citability**: capacidad de trazar cada afirmación a su fuente exacta.

---

## 18) Próximos + (stretch)
- **Modo docente**: guiones de clase y quizzes automáticos por tema.
- **Multi‑corpus**: integrar **OpenAlex** vía DOI detectados en referencias.
- **Comparador** de versiones (diff de resúmenes entre revId A/B).
- **Resumen multimodal**: mini‑galería de imágenes con captions citados.

---

## 19) Licencia
- Código: MIT.
- Contenido generado: respeta y re‑publica con **CC BY-SA 4.0** + atribución y links al historial.

---

## 20) Checklists
**Demo list (5 min):**
- Buscar “CRISPR”.
- Ver TL;DR con 5 bullets y 5 citas.
- Abrir 2 citas → ver párrafo exacto.
- Grafo depth‑1 con 10 nodos.
- Guardar colección “BioTech 101” y exportar Markdown.

**PRD sanity:**
- Latencia < 8 s p95.
- 0 afirmaciones sin cita.
- 100% URLs de citas vivas.

