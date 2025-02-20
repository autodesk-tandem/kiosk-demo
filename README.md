# Tandem Kiosk Demo Application
A sample kiosk application to display rooms in the office building. The sample demonstrates how to use the embedded Tandem viewer to display information from a digital twin.

## Overview
The sample provides a quick overview of the facility:
- List of levels
- List of roms per level
- Thematic display of rooms based on room type or status
- Sensor information for room
- AI powered chat bot

## Prerequisites
- Registered APS application
- Access to the facility
- [Node.js](https://nodejs.org/)

## Setup
1. Clone this project.
2. Install dependencies: `npm install`
3. Specify environment variables:
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET`
   - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
   - `SESSION_SECRET`

## Run
- Start server: `npm start`
- Open your browser and navigate to [http://localhost:3000](http://localhost:3000)