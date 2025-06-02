import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY ='1d';

interface TokenPayload {
    userId: string;
    username: string;
    isAdmin: boolean;
}

export const generateAccessToken = (payload: TokenPayload): string =>{
    return jwt.sign(payload, ACCESS_TOKEN_SECRET,{
        expiresIn: ACCESS_TOKEN_EXPIRY,
    })
}

export const generateRefreshToken = (paylaod: TokenPayload): string => {
    return jwt.sign(paylaod, REFRESH_TOKEN_SECRET,{
        expiresIn: REFRESH_TOKEN_EXPIRY,
    })
}

export const verifyAccessToken = (token:string): TokenPayload =>{
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
}

export const verifyRefreshToken = ( token:string): TokenPayload =>{
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
}