const express = require('express');
const { Readable } = require('stream');
const {
    ClientSecretCredential, 
    getBearerTokenProvider 
} = require('@azure/identity');

const { APS_CLIENT_ID, APS_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
const port = process.env.PORT || 3000;

const app = express();

app.use(express.static('wwwroot'));
// endpoints
app.post('/auth/token', async (req, res) => {
    const token = await createToken(APS_CLIENT_ID, APS_CLIENT_SECRET, 'data:read viewables:read');

    res.status(200).json(token);
});

app.post('/auth/chat', async (req, res) => {
    const credential = new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);
    const scope = 'https://cognitiveservices.azure.com/.default';
    const tokenProvider = getBearerTokenProvider(credential, scope);
    const token = await tokenProvider();

    res.status(200).json({
        token
    });
});

app.get('/twins/:twinId/views/:viewId/thumbnail', async (req, res) => {
    const token = await createToken(APS_CLIENT_ID, APS_CLIENT_SECRET, 'data:read viewables:read');
    const response = await fetch(`https://tandem.autodesk.com/api/v1/twins/${req.params.twinId}/views/${req.params.viewId}/thumbnail`, {
        headers: {
            'Authorization': `Bearer ${token.access_token}`
        }
    });
    Readable.fromWeb(response.body).pipe(res);
});

async function createToken(clientID, clientSecret, scope) {
    const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    const options = new URLSearchParams({
        'grant_type': 'client_credentials',
        'scope': scope
    });
    const response = await fetch(`https://developer.api.autodesk.com/authentication/v2/token?${options}`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`
        }
    });
    const token = await response.json();

    return token;
}

// start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
