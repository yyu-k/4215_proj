export function error(objects: any, message?: string) {
    if (typeof message == 'undefined') {
        message = objects
    } else {
        message = message + JSON.stringify(objects)
    }
    throw new Error(message)
}

// for debugging: return a string that shows the bits
// of a given word
export function word_to_string(word: number) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setFloat64(0, word);
    let binStr = '';
    for (let i = 0; i < 8; i++) {
        binStr += ('00000000' +
                   view.getUint8(i).toString(2)).slice(-8) +
                   ' ';
    }
    return binStr
}
