import * as crypto from 'crypto'

export const generateStringHex = (len: number): string => {
    return crypto
        .randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len)
        .toUpperCase() // return required number of characters
}

export const generateStringUtf8 = (len: number): string => {
    return crypto.randomBytes(len).toString('base64url') // convert to utf8 format
}
