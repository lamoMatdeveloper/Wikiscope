{
  "supabase": {
    "url": "<existing-supabase-url>",
    "anonKey": "<existing-anon-key>"
  },
  "deepseek": {
    "proxyUrl": "https://your-secure-proxy.example.com/api/deepseek",
    "apiBase": "https://api.deepseek.com",
    "model": "deepseek-chat",
    "models": ["deepseek-chat","deepseek-coder"],
    "headers": {
      "Authorization": "Bearer {{SERVER_SIDE_TOKEN}}"
    }
  },
  "openai": {
    "proxyUrl": "",
    "apiBase": "https://api.openai.com/v1",
    "model": "chatgpt-5-nano",
    "models": ["chatgpt-5-nano","gpt-4o-mini"],
    "headers": {
      "Authorization": "Bearer {{OPENAI_API_KEY}}"
    }
  },
  "wikipedia": {
    "defaultLang": "es"
  }
}
