import {
    initializeViewer,
    startViewer,
    loadFacility,
    getVisibleRooms,
    getFacetDef } from './tandem.js';

// constants
const facilityId = 'urn:adsk.dtt:IZ1ILnNBRn-MgN08VXDHSw';
const displayMode2Attr = {
    'type': 'Room Type',
    'status': 'Room Status'
};

const colorMaps = {
    'type': {
        '(Undefined)': '#C0C0C0',
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

await initializeViewer();
console.log('initialized');
const viewer = await startViewer();
const app = new Autodesk.Tandem.DtApp();
const facility = await loadFacility(viewer, app, facilityId);
// turn off levels layer
facility.hud.layers.setLayerVisibility(Autodesk.Tandem.DtConstants.HUD_LAYER.LEVELS.id, false);
// wait until facility is loaded
await facility.waitForAllModels();
console.log('facility loaded');
// load views - we have one view for each level
const views = await app.views.fetchFacilityViews(facility);
const viewNames = views.map(view => view.viewName).sort();

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

//
function populateLevels(names) {
    const container = document.getElementById('levels');

    container.innerHTML = '';
    for (const name of names) {
        const levelElement = document.createElement('div');
        
        levelElement.innerText = name;
        levelElement.dataset.level = name;
        levelElement.addEventListener('click', async (event) => {
            await onLevelClick(event?.target?.dataset?.level);
        });
        container.appendChild(levelElement);
    }
}

function populateRooms(names) {
    const container = document.getElementById('rooms');

    container.innerHTML = '';
    for (const name of names) {
        const roomElement = document.createElement('div');
        
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

async function onLevelClick(name) {
    console.log(`level selected: ${name}`);
    const view = views.find(v => v.viewName === name);

    if (!view) {
        return;
    }
    await app.views.setCurrentView(facility, view);
    // we store room map for subsequent calls
    roomMap = getVisibleRooms(facility);
    const roomNames = Array.from(roomMap.keys()).sort();

    populateRooms(roomNames);
}

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
}

function onRoomMouseLeave() {
    facility.facetsManager.facetsEffects.clearHoveringOverlay();
}

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
