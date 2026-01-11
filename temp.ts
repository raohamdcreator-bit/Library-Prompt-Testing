import { NextResponse } from 'next/server'

export function middleware() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <title>Prism — AI Prompt Engineering Platform</title>

  <meta property="og:title" content="Prism — AI Prompt Engineering Platform" />
  <meta property="og:description" content="Turn simple prompts into optimized, model-specific prompts for ChatGPT, Claude, Gemini & more." />
  <meta property="og:image" content="https://prism-app.online/og-image.png" />
  <meta property="og:url" content="https://prism-app.online" />
  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://prism-app.online/og-image.png" />
</head>
<body></body>
</html>
  `.trim()

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
