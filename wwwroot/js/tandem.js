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
    let facility = await app.getFacility(facilityId);

    if (!facility) {
        // this is workaround for the case when facility is not in the current team
        const teams = await app.getTeams();

        for (const team of teams) {
            const facilities = await team.getFacilities();
            const tmp = facilities.find(f => f.twinId === facilityId);
            
            if (tmp) {
                facility = tmp;
                break;
            }
        }
    }
    await app.displayFacility(facility, false, viewer);

    return facility;
}

/**
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @returns {Map<string, { dbId: number, model: Autodesk.Viewing.Model}>}
 */
export function getVisibleRooms(facility) {
    // get levels
    const modelsDef = facility.facetsManager.facetDefs.find(f => f.id === 'models');
    const levelsDef = facility.facetsManager.facetDefs.find(f => f.id === 'levels');
    const roomMap = new Map();

    for (const modelId of modelsDef.filter.values()) {
        const model = facility.models[modelId];

        for (const room of model.getData().rooms) {
            const levelId = model.getData().dbId2levelId[room.dbId];
            const level = model.getData().levels.find(l => l.dbId === levelId);

            if (levelsDef.filter.has(level?.name)) {
                roomMap.set(room.name, { dbId: room.dbId, model: model });
            }
        }
    }
    return roomMap;
}
