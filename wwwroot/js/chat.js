const AI_BASE_PATH = 'https://cog-sandbox-dev-eastus-002.openai.azure.com';
const AI_MODEL = 'gpt-4o-mini';
const API_VERSION = '2024-10-21';
const url = `${AI_BASE_PATH}/openai/deployments/${AI_MODEL}/chat/completions?api-version=${API_VERSION}`;

const tools = [
    {
        type: 'function',
        function: {
            name: 'query_rooms',
            description: 'Query rooms of the building.',
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
                        description: 'Optional parameter to apply the query. Can be used on min/max queries.',
                        enum: [ 'area', 'temperature', '' ]
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

export async function processMessage(prompt, context) {
    // get token
    const tokenResponse = await fetch('/auth/chat', {
        method: 'POST'
    });
    const token = await tokenResponse.json();
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
                'Authorization': `Bearer ${token.token}`,
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
            if (choice.finish_reason === 'stop') {
                message = choice.message.content;
                processMessages = false;
                break;
            }
        }
    }
    return message;
}

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

function queryRooms(args, context) {
    const { type, filter, parameter } = args;
    const paramPropMap = {
        'area': 'Area',
    };
    let rooms = [];
    let value;
    
    if (filter) {
        for (const [ name, props ] of context.roomProps.entries()) {
            let match =  (filter.level.length === 0 || (props['Level']?.toLocaleLowerCase() === filter.level.toLocaleLowerCase())) &&
                (filter.status.length === 0 || (props['Room Status']?.toLocaleLowerCase() === filter.status.toLocaleLowerCase()));

            if (match) {
                const item = {
                    name,
                    level: props['Level'],
                };

                rooms.push(item);
            }
        }
    } else {
        rooms = Array.from(context.roomProps.entries()).map(([ name, props ]) => {
            return {
                name,
                level: props['Level'],
            }});
    }
    // add parameter values
    if (parameter) {
        const propName = paramPropMap[parameter];

        for (const room of rooms) {
            const props = context.roomProps.get(room.name);
        
            room['parameters'] = {};
            room['parameters'][parameter] = props[propName];
        }
    }
    switch (type) {
        case 'avg':
            response = `The average ${parameter} of rooms is 20 degrees.`;
            break;
        case 'count':
            value = rooms.length;
            break;
        case 'max':
            const items = rooms.reduce((acc, room) => {
                if (room.parameters[parameter] > acc.value) {
                    acc.value = room.parameters[parameter];
                    acc.items = [room];
                } else if (room.parameters[parameter] === acc.value) {
                    acc.items.push(room);
                }
                return acc;
            }, { value: -Infinity, items: [] });

            value = items.value;
            rooms = items.items;
            break;
        case 'min':
            break;
        case 'sum':
            value = rooms.reduce((acc, room) => acc + room.parameters[parameter], 0);
            break;
        default:
            break;
    }
    const result = {};
    
    if (value !== undefined) {
        result['value'] = value;
    }
    if (rooms.length > 0) {
        result['rooms'] = rooms;
    }
    return result;
}

function selectRooms(args, context) {
    context.selector(args.names);
    return 'success';
}
