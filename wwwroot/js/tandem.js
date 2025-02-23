/**
 * Initializes the viewer.
 * 
 * @returns {Promise<void>}
 */
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

/**
 * Starts the viewer.
 * 
 * @returns {Autodesk.Viewing.GuiViewer3D}
 */
export function startViewer(elementName) {
    const viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById(elementName), {
        extensions: ['Autodesk.BoxSelection'],
        screenModeDelegate: Autodesk.Viewing.NullScreenModeDelegate,
        theme: 'light-theme'
    });

    viewer.start();
    return viewer;
}

/**
 * Loads facility and displays it in the viewer.
 * 
 * @param {Autodesk.Viewing.GuiViewer3D} viewer 
 * @param {Autodesk.Tandem.DtApp} app 
 * @param {string} facilityId 
 * @returns {Promise<Autodesk.Tandem.DtFacility>}
 */
export async function loadFacility(viewer, app, facilityId, useDefaultView = false) {
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
    let initialView;

    if (useDefaultView) {
        const views = await facility.getSavedViewsList();
        const defaultView = views.find(v => v.default);
        const view = await app.views.fetchSpecificView(facility, defaultView.id);
        
        initialView = view ?? false;
    }
    await app.displayFacility(facility, initialView, viewer);

    if (initialView) {
        await app.views.setCurrentView(facility, initialView);
    }
    return facility;
}

/**
 * Get visible rooms in the facility.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @returns {Map<string, { dbId: number, model: Autodesk.Viewing.Model}>}
 */
export function getVisibleRooms(facility) {
    // get models & levels which are displayed in current view based on filter
    const modelsDef = facility.facetsManager.facetDefs.find(f => f.id === 'models');
    const levelsDef = facility.facetsManager.facetDefs.find(f => f.id === 'levels');
    const roomMap = new Map();

    for (const modelId of modelsDef.filter.values()) {
        const model = facility.models[modelId];
        const modelData = model.getData();

        for (const room of modelData.rooms) {
            const levelId = modelData.dbId2levelId[room.dbId];
            const level = modelData.levels.find(l => l.dbId === levelId);

            if (levelsDef.filter.has(level?.name)) {
                roomMap.set(room.name, { dbId: room.dbId, model: model });
            }
        }
    }
    return roomMap;
}

/**
 * Return or creates new facet definition for give attribute name. Returns tuple of
 * facet definitions and facet definition for the attribute.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @param {string} attrName 
 * @returns {Promise<[Autodesk.Tandem.FacetDef[], Autodesk.Tandem.FacetDef]>}
 */
export async function getFacetDef(facility, attrName) {
    // find attribute
    let attr;

    for (const model of facility.modelsList) {
        const attrs = await model.getAttributes({ native: true });
        const tmp = attrs.find(a => a.name === attrName);

        if (tmp) {
            attr = tmp;
            break;
        }
    }
    //
    let facetDefs = facility.facetsManager.getFacetDefs();
    let facetDef = facetDefs.find(f => f.settings.attributeHash === attr.hash);

    if (!facetDef) {
        // create facet definition
        const facetSettings = {
            id: Autodesk.Tandem.FacetTypes.attributes,
            attributeHash: attr.hash
        };
        facetDefs = await facility.facetsManager.addFacetDef(facetSettings, 3);
        facetDef = facetDefs.find(d => d.settings.attributeHash === attr.hash);
    }
    if (facetDef.filter.size === 0) {
        for (const value of facetDef.attribute.allowedValues.list) {
            facetDef.filter.add(value);
        }
        facetDef.filter.add('(Undefined)');
    }
    return [ facetDefs, facetDef ];
}

/**
 * Get rooms in the facility. The assumption is that each room has unique name.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @returns {Map<string, { dbId: number, model: Autodesk.Viewing.Model}>}
 */
export function getRooms(facility) {
    const roomMap = new Map();

    for (const model of facility.modelsList) {
        const modelData = model.getData();

        for (const room of modelData.rooms) {
            roomMap.set(room.name, { dbId: room.dbId, model: model });
        }
    }
    return roomMap;
}

/**
 * Returns room information from streams. The assumption is that each room has unique name.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @returns {Promise<Map<string, { [key: string]: number | string; }>>}
 */
export async function getRoomInfoFromStreams(facility) {
    const streamInfos = await facility.streamMgr.getAllStreamInfos();
    const streamIds = streamInfos.map(s => s.dbId);
    const streamData = await facility.streamMgr.getLastReadings(streamIds, true);
    // get rooms
    const result = new Map();

    for (const model of facility.modelsList) {
        for (const room of model.getData().rooms) {
            const streamInfo = streamInfos.find(s => s.hostElement.model.id === model.id && s.hostElement.hostId === room.dbId);

            if (!streamInfo) {
                continue;
            }
            const roomData = {};

            for (const attr of streamInfo.streamAttrs) {
                const index = streamIds.indexOf(streamInfo.dbId);
                const value = streamData[index][attr.id]?.val;

                if (value !== undefined) {
                    roomData[attr.name] = value;
                }
            }
            if (Object.keys(roomData).length > 0) {
                result.set(room.name, roomData);
            }
        }
    }
    return result;
}

/**
 * Creates map of room properties.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @param {Array<string>} propNames 
 * @returns {Promise<Map<string, { [key: string]: any; }>>}
 */
export async function getRoomProps(facility, propNames) {
    const result = new Map();
    const views = await facility.getSavedViewsList();

    for (const model of facility.modelsList) {
        const modelData = model.getData();
        const rooms = modelData.rooms;
        const dbIds = rooms.map(r => r.dbId);

        if (dbIds.length === 0) {
            continue;
        }
        const items = await model.getPropertiesDt(dbIds);

        for (const room of rooms) {
            const item = items.find(i => i.element.dbId === room.dbId);

            if (!item) {
                continue;
            }
            const roomData = {};

            for (const prop of item.element.properties) {
                if (propNames.includes(prop.displayName) && prop.displayValue) {
                    roomData[prop.displayName] = prop.displayValue;
                }
            }
            // add level name. in our case the level name is actually name of the corresponding view
            const levelId = modelData.dbId2levelId[item.element.dbId];
            const level = modelData.levelMap[levelId];

            if (level) {
                // find related view
                for (const view of views) {
                    if (view.facets.filters.levels.has(level.name)) {
                        roomData['Level'] = view.viewName;
                        break;
                    }
                }
            }
            if (Object.keys(roomData).length > 0) {
                result.set(room.name, roomData);
            }
        }
    }
    return result;
}

/**
 * Returns map of level views.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @param {string} viewGroup 
 * @returns {Promise<Map<string, object>>}
 */
export async function getLevelViews(facility, viewGroup) {
    const result = new Map();
    const views = await facility.getSavedViewsList();

    for (const view of views) {
        if (view.label !== viewGroup) {
            continue;
        }
        result.set(view.viewName, view);
    }
    return result;
}

/**
 * Returns map of room waypoints.
 * 
 * @param {Autodesk.Tandem.DtFacility} facility 
 * @param {string} viewGroup 
 * @param {string[]} roomNames 
 * @returns {Promise<Map<string, object>>}
 */
export async function getRoomWaypoints(facility, viewGroup, roomNames) {
    const result = new Map();
    const views = await facility.getSavedViewsList();

    for (const view of views) {
        if (view.label !== viewGroup) {
            continue;
        }
        if (roomNames.includes(view.viewName)) {
            result.set(view.viewName, view);
        }
    }
    return result;
}
