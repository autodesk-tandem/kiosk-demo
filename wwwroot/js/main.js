import {
    initializeViewer,
    startViewer,
    loadFacility,
    getVisibleRooms,
    getFacetDef,
    getRoomInfoFromStreams } from './tandem.js';

// constants
const facilityId = 'urn:adsk.dtt:IZ1ILnNBRn-MgN08VXDHSw';
const viewGroup = 'Levels';
const displayMode2Attr = {
    'type': 'Room Type',
    'status': 'Room Status'
};

const colorMaps = {
    'type': {
        '(Undefined)': '#C0C0C0',
        'Meeting Room': '#B6FF00',
        'Office': '#FFD800',
        'Resource': '#0094FF',
        'spaces:multiple': '#5A5A5A'
    },
    'status': {
        '(Undefined)': '#C0C0C0',
        'Available': '#B6FF00',
        'Occupied': '#FF6A00',
        'spaces:multiple': '#5A5A5A'
    }
};

const legendMap = {
    'type': 'legend-type',
    'status': 'legend-status'
};

const roomAttrMap = {
    'CO2': 'co2-value',
    'Humidity': 'humidity-value',
    'Temperature': 'temperature-value'
};

await initializeViewer();
console.log('initialized');
const viewer = await startViewer('viewer');
const app = new Autodesk.Tandem.DtApp();
const facility = await loadFacility(viewer, app, facilityId);
// turn off levels layer
facility.hud.layers.setLayerVisibility(Autodesk.Tandem.DtConstants.HUD_LAYER.LEVELS.id, false);
// wait until facility is loaded
await facility.waitForAllModels();
console.log('facility loaded');
// load views - we have one view for each level
const views = await app.views.fetchFacilityViews(facility);
const viewNames = views.filter(view => view.label === viewGroup).map(view => view.viewName).sort();

populateLevels(viewNames);
// we store map of currently displayed rooms
let roomMap;

// subscribe to display options
const btnIds = [
    'display-mode-default',
    'display-mode-type',
    'display-mode-status'
];

for (const btnId of btnIds) {
    const btn = document.getElementById(btnId);

    btn.addEventListener('change', async (event) => {
        await onDisplayModeChange(event.target.value);
    });
}
// collect room info from streams
const roomInfos = await getRoomInfoFromStreams(facility);
const divRoomDetails = document.getElementById('room-details');

/**
 * Populates list of levels.
 * 
 * @param {Array<string>} names 
 */
function populateLevels(names) {
    const container = document.getElementById('levels');

    container.innerHTML = '';
    for (const name of names) {
        const levelElement = document.createElement('li');
        
        levelElement.innerText = name;
        levelElement.dataset.level = name;
        levelElement.addEventListener('click', async (event) => {
            await onLevelClick(event?.target?.dataset?.level);
        });
        container.appendChild(levelElement);
    }
}

/**
 * Populates list of rooms.
 * 
 * @param {Array<string>} names 
 */
function populateRooms(names) {
    const container = document.getElementById('rooms');

    container.innerHTML = '';
    for (const name of names) {
        const roomElement = document.createElement('li');
        
        roomElement.innerText = name;
        roomElement.dataset.room = name;
        roomElement.addEventListener('click', async (event) => {
            await onRoomClick(event?.target?.dataset?.room);
        });
        roomElement.addEventListener('mouseover', (event) => {
            onRoomMouseOver(event?.target?.dataset?.room);
        });
        roomElement.addEventListener('mouseleave', (event) => {
            onRoomMouseLeave();
        });
        container.appendChild(roomElement);
    }
}

/**
 * Called when user clicks on the name in the list of levels. Sets current view based on the name.
 * Populates list of rooms.
 * 
 * @param {string} name 
 * @returns {Promise<void>}
 */
async function onLevelClick(name) {
    console.log(`level selected: ${name}`);
    const view = views.find(v => v.viewName === name);

    if (!view) {
        return;
    }
    await app.views.setCurrentView(facility, view);
    // hide level labels
    facility.hud.layers.setLayerVisibility(Autodesk.Tandem.DtConstants.HUD_LAYER.LEVELS.id, false);
    // we store room map for subsequent calls
    roomMap = getVisibleRooms(facility);
    const roomNames = Array.from(roomMap.keys()).sort();

    populateRooms(roomNames);
}

/**
 * Called when user click on the name in the list of rooms. Selects room in the viewer.
 * 
 * @param {string} name 
 * @returns {Promise<void>}
 */
async function onRoomClick(name) {
    console.log(`room selected: ${name}`);
    if (!roomMap) {
        return;
    }
    const roomData = roomMap.get(name);

    if (!roomData) {
        return;
    }
    const selection = [
        {
            model: roomData.model,
            selection: [roomData.dbId]
        }
    ];
    // select element
    viewer.setAggregateSelection(selection);
}

/**
 * Called when mouse is over the name in the list of rooms. Highlights room in the viewer.
 * Displays room informatio.
 * 
 * @param {string} name 
 */
function onRoomMouseOver(name) {
    const item = roomMap?.get(name);

    if (!item) {
        return;
    }
    const node = {
        roomSrcModel: item.model,
        dbId: item.dbId
    };
    facility.facetsManager.facetsEffects.addSpaceHighlight(node);
    // display room data
    displayRoomInfo(name, roomInfos, roomAttrMap, divRoomDetails);
}

/**
 * Clears room highlight and hides room information.
 * 
 */
function onRoomMouseLeave() {
    facility.facetsManager.facetsEffects.clearHoveringOverlay();
    divRoomDetails.style.display = 'none';
}

/**
 * Called when user changes display mode. Sets theme based on the mode.
 * 
 * @param {string} mode 
 * @returns {Promise<void>}
 */
async function onDisplayModeChange(mode) {
    updateLegend(mode);
    if (mode === 'default') {
        facility.facetsManager.applyTheme();
        return;
    }
    const attrName = displayMode2Attr[mode];
    const [ facetDefs, facetDef ] = await getFacetDef(facility, attrName);
    const settings = facetDefs.map(facetDef => facetDef.getSettings());

    await facility.facetsManager.setSettings(settings);
    facility.facetsManager.updateFacets();
    const settingsId = facetDef.getSettings().id;
    const colorMap = colorMaps[mode];

    facility.facetsManager.applyTheme(settingsId, colorMap);
}

/**
 * Updates legend based on the mode.
 * 
 * @param {string} mode 
 */
function updateLegend(mode) {
    for (const [ type, id ] of Object.entries(legendMap)) {
        const legend = document.getElementById(id);

        if (!legend) {
            continue;
        }
        if (type === mode) {
            legend.style.display = '';
        } else {
            legend.style.display = 'none';
        }
    }
}

/**
 * Displays room information.
 * 
 * @param {string} name 
 * @param {Map<string, { [key: string]: number | string; }>} roomInfos 
 * @param {Map<string, string>} roomAttrMap 
 * @param {HTMLDivElement} element 
 * @returns 
 */
function displayRoomInfo(name, roomInfos,roomAttrMap, element)
{
    const roomData = roomInfos.get(name);

    if (!roomData) {
        element.style.display = 'none';
        return;
    }
    for (const [key, value] of Object.entries(roomData)) {
        const elementId = roomAttrMap[key];
        const childElement = document.getElementById(elementId);

        if (!childElement) {
            continue;
        }
        childElement.innerText = value.toString();
    }
    element.style.display = '';
}
