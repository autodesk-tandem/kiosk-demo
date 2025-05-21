# Tandem Kiosk Demo Application
A sample kiosk application to display rooms in the office building. The sample demonstrates how to use the embedded Tandem viewer to display information from a digital twin.

## Overview
The sample provides a quick overview of the facility:
- List of levels
- List of rooms per level
- Predefined room views (waypoints)
- Thematic display of rooms based on room type or status
- Sensor information for room
- AI powered chat bot

The goal of the demo is to illustrate use of embedded Tandem viewer and its API.

## Prerequisites
- Registered APS application
- Access to the facility
- [Node.js](https://nodejs.org/)

## Setup
1. Clone this project.
2. Install dependencies: `npm install`
3. Specify environment variables:
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` - APS application credentials.
   - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` - Azure credentials for OpenAI access.
   - `SESSION_SECRET` - the secret used to sign the session ID cookie.

## Run
- Start server: `npm start`
- Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## How it works?

When page is loaded it automatically loads pre-configured facility. The demo uses [2-Legged authentication](https://aps.autodesk.com/en/docs/oauth/v2/developers_guide/App-types/Machine-to-machine/) to access the facility - no additional input from user is required.
After facility is fully loaded the application loads information about available levels, rooms and their properties. This is all stored in memory to reduce extra calls to the server.

### Levels & Rooms

The sample uses following approach to display levels:
- Each level has a dedicated view under the **Levels** group. This allows control over view orientation, element visibility, and other settings.
- Displaying a level involves setting a specific pre-configured view.

The demo displays list of rooms for each level (resp. view). The application uses cross highlighting to indicate which room is selected in the list.

### Room Information

When the mouse hovers over a room name in the list, additional details about the room are displayed. These details include:
- Room properties (e.g., type, status)
- Associated sensor streams (e.g., CO2, Humidity, Temperature)

### Waypoints

Waypoints are predefined room views stored under the **Waypoints** group. The application retrieves thumbnails of these views from Tandem. When a waypoint is selected, the application sets the corresponding predefined view.

### Coloring

The application allows dynamic coloring of rooms based on their type or status. This feature dynamically creates color filters and applies colors based on the selected option.

### Twin Assistant

This feature demonstrates a possible approach for integrating Tandem with a **Large Language Model (LLM)**. It uses the concept of [function calling](https://platform.openai.com/docs/guides/function-calling), which enables the LLM to call externally defined functions with parameters extracted from the conversation.

In the demo there are two functions:
- **query_rooms**: Finds rooms based on provided criteria.
- **select_rooms**: Selects rooms based on their names.

The demo communicates with OpenAI hosted on Azure using its [REST API](https://platform.openai.com/docs/api-reference/introduction).