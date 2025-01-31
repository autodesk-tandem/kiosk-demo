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
