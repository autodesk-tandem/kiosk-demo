// this points to the OpenAI API endpoint hosted on Azure
const AI_BASE_PATH = 'https://cog-sandbox-dev-eastus-002.openai.azure.com';
const AI_MODEL = 'gpt-4o-mini';
const API_VERSION = '2024-10-21';
const url = `${AI_BASE_PATH}/openai/deployments/${AI_MODEL}/chat/completions?api-version=${API_VERSION}`;

// definition of tools which are available for LLM to use.
// query_rooms: Finds rooms based on provided criteria.
// select_rooms**: Selects rooms based on their names.
const tools = [
    {
        type: 'function',
        function: {
            name: 'query_rooms',
            description: 'Query rooms of the building. The result is JSON object with optional value and list of rooms names. The value is calculated based on the type of the query. The result is in generic units.',
            parameters: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        description: 'The type of the query.',
                        enum: [ 'avg', 'count', 'filter', 'max', 'min', 'sum' ]
                    },
                    filter: {
                        type: ['object','null'],
                        description: 'Optional filter to apply.',
                        properties: {
                            level: {
                                type: 'string',
                                description: 'The level filter'
                            },
                            status: {
                                type: ['string', 'null'],
                                description: 'The status filter',
                                enum: [ 'available', 'occupied', '' ]
                            }
                        },
                        required: [ 'level', 'status' ],
                        additionalProperties: false
                    },
                    parameter: {
                        type: ['string','null'],
                        description: 'Optional parameter to apply the query. Can be used on avg, min, max, sum queries.',
                        enum: [ 'area', 'co2', 'humidity', 'temperature', '' ]
                    }
                },
                required: [ 'type', 'filter','parameter' ],
                additionalProperties: false
            },
            strict: true
        }
    },
    {
        type: 'function',
        function: {
            name: 'select_rooms',
            description: 'Select specified rooms.',
            parameters: {
                type: 'object',
                properties: {
                    names: {
                        type: 'array',
                        description: 'List of room names to select.',
                        items: {
                            type: 'string'
                        }
                    }
                },
                required: [ 'names' ],
                additionalProperties: false
            },
            strict: true
        }
    }
];

// system prompt for the assistant
const systemPrompt = `You\'re an assistant that provides real-time insights about building by querying internal API.
    Your goal is to interpret user request, call appropriate function and generate clear response.

    Capabilities:
    - search for rooms based on provided criteria

    Instructions:
    1. Understand user intent and extract relevant details.
    2. Call API tools to fetch data.
    3. Process and summarize results.
    4. Generate a human-readable response.
    5. Ask clarifying questions if needed.
    6. Handle errors gracefully.
    `;

/**
 * Process the message using the AI model. It calls Open API and returns result.
 * 
 * @param {string} prompt - user prompt
 * @param {object} context - context object with room properties and selector function
 * @return {string} - response from LLM
 */
export async function processMessage(prompt, context) {
    // get token to call OpenAI API
    const tokenResponse = await fetch('/auth/chat', {
        method: 'POST'
    });
    const { token } = await tokenResponse.json();
    // send message
    const messages = [
        {
            role: 'system',
            content: systemPrompt
        },
        {
            role: 'user',
            content: prompt
        }
    ];
    let processMessages = true;
    let message;

    while (processMessages) {
        // send message and process result
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: messages,
                tools: tools
            })
        });
        const result = await response.json();

        for (const choice of result.choices) {
            // process tool calls
            if (choice.finish_reason === 'tool_calls') {
                for (const tool of choice.message.tool_calls) {
                    const name = tool.function.name;
                    const args = JSON.parse(tool.function.arguments);
                    const functionResult = callFunction(name, args, context);

                    if (functionResult) {
                        messages.push(choice.message);
                        messages.push({
                            role: 'tool',
                            tool_call_id: tool.id,
                            content: JSON.stringify(functionResult)
                        });
                    }
                }
            }
            // nothing to process
            if (choice.finish_reason === 'stop') {
                message = choice.message.content;
                processMessages = false;
                break;
            }
        }
    }
    return message;
}

/**
 * Helper function to call appropriate function based on name.
 * 
 * @param {*} name 
 * @param {*} args 
 * @param {*} context 
 * @returns 
 */
function callFunction(name, args, context) {
    const functionMap = {
        'query_rooms': queryRooms,
        'select_rooms': selectRooms
    };
    const fn = functionMap[name];

    if (fn) {
        console.log(`Calling function: ${name}`);
        return fn(args, context);
    }
    return '';
}

/**
 * Runs query on rooms based on provided arguments.
 * 
 * @param {object} args - input arguments from LLM.
 * @param {object} context - context. In this case it's basically map of room properties.
 * @returns {Array<object>} - result of query.
 */
function queryRooms(args, context) {
    const { type, filter, parameter } = args;
    const paramPropMap = {
        'area': 'Area',
        'co2': 'CO2',
        'humidity': 'Humidity',
        'temperature': 'Temperature'
    };
    let rooms = [];
    let value;
    
    if (filter) {
        for (const [ name, props ] of context.roomProps) {
            const match =  (filter.level.length === 0 || (props['Level']?.toLocaleLowerCase() === filter.level.toLocaleLowerCase())) &&
                (filter.status.length === 0 || (props['Room Status']?.toLocaleLowerCase() === filter.status.toLocaleLowerCase()));

            if (match) {
                const item = {
                    name
                };

                rooms.push(item);
            }
        }
    } else {
        rooms = Array.from(context.roomProps.entries()).map(([ name ]) => {
            return {
                name
            }});
    }
    // add parameter values
    if (parameter) {
        const propName = paramPropMap[parameter];

        for (const room of rooms) {
            const props = context.roomProps.get(room.name);
            const value = props[propName] ?? null;
            
            if (value !== null) {
                room['parameters'] = {};
                room['parameters'][parameter] = value;
            }
        }
    }
    // based on type of query, calculate value and filter rooms
    switch (type) {
        case 'avg':
            {
                const items = rooms.reduce((acc, room) => {
                    const paramValue = room.parameters?.[parameter] ?? null;

                    if (paramValue !== null) {
                        acc.value += room.parameters[parameter];
                        acc.items.push(room);
                    }
                    return acc;
                }, { value: 0.0, items: [] });

                value = items.items.length > 0 ? items.value / items.items.length : 0.0;
                rooms = items.items;
            }
            break;
        case 'count':
            value = rooms.length;
            break;
        case 'max':
            {
                const items = rooms.reduce((acc, room) => {
                    const paramValue = room.parameters?.[parameter] ?? null;

                    if (paramValue !== null) {
                        if (paramValue > acc.value) {
                            acc.value = paramValue;
                            acc.items = [room];
                        } else if (paramValue === acc.value) {
                            acc.items.push(room);
                        }
                    }
                    return acc;
                }, { value: -Infinity, items: [] });

                value = items.value;
                rooms = items.items;
            }
            break;
        case 'min':
            {
                const items = rooms.reduce((acc, room) => {
                    const paramValue = room.parameters?.[parameter] ?? null;

                    if (paramValue !== null) {
                        if (paramValue < acc.value) {
                            acc.value = paramValue;
                            acc.items = [room];
                        } else if (paramValue === acc.value) {
                            acc.items.push(room);
                        }
                    }
                    return acc;
                }, { value: Infinity, items: [] });

                value = items.value;
                rooms = items.items;
            }
            break;
        case 'sum':
            value = rooms.reduce((acc, room) => {
                const paramValue = room.parameters?.[parameter] ?? null;

                if (paramValue !== null) {
                    acc += paramValue;
                }
                return acc;
            }, 0);
            break;
        default:
            break;
    }
    // create result
    const result = {};
    
    if (value !== undefined) {
        result['value'] = value;
    }
    if (rooms.length > 0) {
        result['rooms'] = rooms.map(r => r.name);
    }
    return result;
}

/**
 * Selects rooms based on input from LLM.
 * 
 * @param {object} args - input arguments from LLM.
 * @param {object} context - context object with selector function.
 * @returns {string} - success message
 */
function selectRooms(args, context) {
    context.selector(args.names);
    return 'success';
}
