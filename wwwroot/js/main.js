import { initializeViewer, startViewer, loadFacility } from './tandem.js';

// constants
const facilityId = 'urn:adsk.dtt:IZ1ILnNBRn-MgN08VXDHSw';

await initializeViewer();
console.log('initialized');
const viewer = await startViewer();
const app = new Autodesk.Tandem.DtApp();
const facility = await loadFacility(viewer, app, facilityId);

await facility.waitForAllModels();
console.log('facility loaded');
// load views - we have one view for each level
const views = await app.views.fetchFacilityViews(facility);
const viewNames = views.map(view => view.viewName).sort((a, b) => a.localeCompare(b));

populateLevels(viewNames);

function populateLevels(names) {
    const container = document.getElementById('levels');

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

async function onLevelClick(name) {
    console.log(`level selected: ${name}`);
    const view = views.find(v => v.viewName === name);

    await app.views.setCurrentView(facility, view);
}
