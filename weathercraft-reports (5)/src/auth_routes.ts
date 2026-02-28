import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send('Error: No code provided');
  }

  try {
    // We use localhost for the internal call to ensure connectivity within the container
    const response = await axios.post(`http://localhost:3000/api/auth/exchange`, {
      code
    }, {
      headers: {
        // We need to forward the cookie if we were doing session checks, but here we are establishing it.
      }
    });
    
    // The API response contains the Set-Cookie header. We need to forward it.
    if (response.headers['set-cookie']) {
      res.setHeader('Set-Cookie', response.headers['set-cookie']);
    }

    res.send(`
      <html>
        <body style="background: #1a1a1a; color: white; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <div style="text-align: center;">
            <h1 style="color: #5C9E38; font-size: 24px;">AUTHENTICATION SUCCESSFUL</h1>
            <p>Linking neural pathways...</p>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }, 1500);
            </script>
          </div>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('Callback Error:', error.message);
    res.send(`
      <html>
        <body style="background: #1a1a1a; color: red; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <div>
            <h1>CONNECTION FAILED</h1>
            <p>${error.response?.data?.error || 'Unknown error'}</p>
            <p>Check server logs.</p>
          </div>
        </body>
      </html>
    `);
  }
});

export default router;
