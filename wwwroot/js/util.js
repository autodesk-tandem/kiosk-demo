export function mergeMaps(firstMap, secondMap) {
    for (const [ name, data ] of firstMap.entries()) {
        const second = secondMap.get(name);
    
        if (!second) {
            continue;
        }
        for (const key in second) {
            data[key] = second[key];
        }
        firstMap.set(name, data);
    }
    return firstMap;
}