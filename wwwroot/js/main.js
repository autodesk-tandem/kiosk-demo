import {
    initializeViewer,
    startViewer,
    loadFacility,
    getVisibleRooms,
    getFacetDef,
    getLevelViews,
    getRoomInfoFromStreams,
    getRoomProps,
    getRoomWaypoints } from './tandem.js';
import { mergeMaps } from './util.js';

// constants
const facilityId = 'urn:adsk.dtt:IZ1ILnNBRn-MgN08VXDHSw';
// the label of the view group that contains views for each level
const viewLevelsGroup = 'Levels';
const viewWaypointsGroup = 'Waypoints';

const displayMode2Attr = {
    'type': 'Room Type',
    'status': 'Room Status'
};

// color maps for room types and statuses
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

// map of display mode to element id of the legend
const legendMap = {
    'type': 'legend-type',
    'status': 'legend-status'
};

// map of room attribute to element id
const roomAttrMap = {
    'Room Status': 'room-status',
    'Room Type': 'room-type',
    'CO2': 'co2-value',
    'Humidity': 'humidity-value',
    'Temperature': 'temperature-value',
    'Area': 'room-area'
};

let currentLevel;

// main code
const levelsElement = document.getElementById('levels');
const roomsElement = document.getElementById('rooms');
const roomDetailsElement = document.getElementById('room-details');
const roomNameElement = document.getElementById('room-name');
const waypointThumbnailElement = document.getElementById('waypoint-thumbnail');
const waypointImageElement = document.getElementById('waypoint-thumbnail-image');

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
const levelViews = await getLevelViews(facility, viewLevelsGroup);
const levelNames = Array.from(levelViews.keys()).sort();

populateLevels(levelsElement, levelNames);
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

    if (!btn) {
        continue;
    }
    btn.addEventListener('change', async (event) => {
        await onDisplayModeChange(event.target.value);
    });
}
// collect room info (streams & props)
const roomInfos = await getRoomInfoFromStreams(facility);
const roomProps = await getRoomProps(facility, Object.keys(roomAttrMap));
const roomNames = Array.from(roomProps.keys());
const roomWaypoints = await getRoomWaypoints(facility, viewWaypointsGroup, roomNames);

mergeMaps(roomProps, roomInfos);

/**
 * Populates list of levels.
 * 
 * @param {HTMLElement} container
 * @param {Array<string>} names 
 */
function populateLevels(container, names) {
    container.innerHTML = '';
    for (const name of names) {
        const levelElement = document.createElement('li');
        
        levelElement.innerText = name;
        levelElement.dataset.level = name;
        levelElement.addEventListener('click', async (event) => {
            await onLevelClick(event.target, event?.target?.dataset?.level);
        });
        container.appendChild(levelElement);
    }
}

/**
 * Populates list of rooms.
 * 
 * @param {HTMLElement} container
 * @param {Array<string>} names 
 */
function populateRooms(container, names, waypoints) {
    container.innerHTML = '';
    for (const name of names) {
        const roomElement = document.createElement('li');
        
        roomElement.innerText = name;
        roomElement.dataset.room = name;
        roomElement.addEventListener('click', async (event) => {
            await onRoomClick(event.target, event?.target?.dataset?.room);
        });
        roomElement.addEventListener('mouseover', (event) => {
            onRoomMouseOver(event?.target?.dataset?.room);
        });
        roomElement.addEventListener('mouseleave', (event) => {
            onRoomMouseLeave();
        });
        if (waypoints.has(name)) {
            const waypointElement = document.createElement('span');

            waypointElement.innerText = '';
            waypointElement.classList.add('waypoint');
            waypointElement.dataset.room = name;
            waypointElement.addEventListener('click', async (event) => {
                event.stopPropagation();
                await onWaypointClick(event.target, event?.target?.dataset?.room);
            });
            waypointElement.addEventListener('mouseover', async (event) => {
                onWaypointMouseOver(event.target, event?.target?.dataset?.room);
            });
            waypointElement.addEventListener('mouseleave', async (event) => {
                onWaypointMouseLeave();
            });
            roomElement.appendChild(waypointElement);
        }
        container.appendChild(roomElement);
    }
}

/**
 * Called when user clicks on the name in the list of levels. Sets current view based on the name.
 * Populates list of rooms.
 * 
 * @param {HTMLElement} element
 * @param {string} name 
 * @returns {Promise<void>}
 */
async function onLevelClick(element, name) {
    console.log(`level selected: ${name}`);
    // remove existing selection and set new one
    const selected = element.parentElement.querySelector('.selected');

    if (selected) {
        selected.classList.remove('selected');
    }
    element.classList.add('selected');
    const view = levelViews.get(name);

    if (!view) {
        return;
    }
    await app.views.setCurrentView(facility, view);
    // hide level labels
    facility.hud.layers.setLayerVisibility(Autodesk.Tandem.DtConstants.HUD_LAYER.LEVELS.id, false);
    // we store room map for subsequent calls
    roomMap = getVisibleRooms(facility);
    const roomNames = Array.from(roomMap.keys()).sort();

    populateRooms(roomsElement, roomNames, roomWaypoints);
    // store current level
    currentLevel = name;
}

/**
 * Called when user click on the name in the list of rooms. Selects room in the viewer.
 * 
 * @param {HTMLElement} element
 * @param {string} name 
 * @returns {Promise<void>}
 */
async function onRoomClick(element, name) {
    console.log(`room selected: ${name}`);
    // remove existing selection and set new one
    const selected = element.parentElement.querySelector('.selected');

    if (selected) {
        selected.classList.remove('selected');
    }
    element.classList.add('selected');
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
    displayRoomInfo(name, roomProps, roomAttrMap, roomDetailsElement);
}

/**
 * Clears room highlight and hides room information.
 * 
 */
function onRoomMouseLeave() {
    facility.facetsManager.facetsEffects.clearHoveringOverlay();
    roomDetailsElement.style.display = 'none';
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

async function onWaypointClick(element, name) {
    console.log(`waypoint selected: ${name}`);
    const view = roomWaypoints.get(name);

    if (!view) {
        return;
    }
    await app.views.setCurrentView(facility, view);
}

async function onWaypointMouseOver(element, name) {
    const view = roomWaypoints.get(name);

    if (!view) {
        return;
    }
    const url = '/twins/urn:adsk.dtt:IZ1ILnNBRn-MgN08VXDHSw/views/H3e8rzSyRcGqb5lMs2V1ZA/thumbnail';

    if (waypointImageElement.src !== url) {
        waypointImageElement.src = url;
    }
    const clientRect = element.getBoundingClientRect();

    waypointThumbnailElement.style.left = `${clientRect.left + 20}px`;
    waypointThumbnailElement.style.top = `${clientRect.top + 20}px`;
    waypointThumbnailElement.style.display = 'block';
}

async function onWaypointMouseLeave(element, name) {
    waypointThumbnailElement.style.display = 'none';
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
 * @param {Map<string, { [key: string]: number | string; }>} roomProps 
 * @param {{ [key: string]: string; }} roomAttrMap 
 * @param {HTMLElement} element 
 * @returns 
 */
function displayRoomInfo(name, roomProps, roomAttrMap, element)
{
    const roomData = roomProps.get(name);

    if (!roomData) {
        element.style.display = 'none';
        return;
    }
    roomNameElement.innerText = name;
    for (const [name, elementId] of Object.entries(roomAttrMap)) {
        const childElement = document.getElementById(elementId);

        if (!childElement) {
            continue;
        }
        const value = roomData[name];
        
        // number of decimal places is hardcoded to 2
        if (value === undefined) {
            childElement.innerText = '';
        } else if (typeof value === 'number') {
            childElement.innerText = value.toFixed(2);
        } else {
            childElement.innerText = value.toString();
        }
    }
    element.style.display = '';
}
