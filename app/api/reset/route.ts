import { NextResponse } from 'next/server';

export async function GET() {
  // Return a response that clears client-side storage
  return new NextResponse(
    `<html>
      <body>
        <script>
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/';
        </script>
        <p>Resetting session...</p>
      </body>
    </html>`,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
}