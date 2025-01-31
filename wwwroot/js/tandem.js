export function initializeViewer() {
    return new Promise((resolve, reject) => {
        const options = {
            env: 'DtProduction',
            api: 'dt',
            getAccessToken: getToken,
            productId: 'Digital Twin',
            corsWorker: true,
            useCookie: false
        };

        Autodesk.Viewing.Initializer(options, () => {
            resolve();
        });
    });
}

async function createToken() {
    const response = await fetch('/auth/token', {
        method: 'POST'
    });
    const data = await response.json();
  
    return data;
}

function getToken(callback) {
    createToken().then((token) => {
        callback(token.access_token, token.expires_in);
    });
} 

export function startViewer() {
    const viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('viewer'), {
        extensions: ['Autodesk.BoxSelection'],
        screenModeDelegate: Autodesk.Viewing.NullScreenModeDelegate,
        theme: 'light-theme'
    });

    viewer.start();
    return viewer;
}

export async function loadFacility(viewer, app, facilityId) {
    const facility = await app.getFacility(facilityId);
    await app.displayFacility(facility, false, viewer);

    return facility;
}
